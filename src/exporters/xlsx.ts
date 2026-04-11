/**
 * XLSX exporter — SheetJS (#18: richer multi-sheet export).
 * Exports the full plan to a workbook matching the Excel sheet structure.
 * Sheets: Hardware Inputs, Capacity Report, Compute Report, Volume Detail,
 *         Workload Planner, AVD Planning, SOFS Planner, Health Check, Advanced Settings
 */

import * as XLSX from 'xlsx'
import type { SurveyorState } from '../state/store'
import { computeCapacity, round2 } from '../engine/capacity'
import { computeVolumeSummary } from '../engine/volumes'
import { computeCompute } from '../engine/compute'
import { computeAvd } from '../engine/avd'
import { computeSofs } from '../engine/sofs'
import { computeWorkloadSummary } from '../engine/workloads'
import { computeAks } from '../engine/aks'
import { runHealthCheck } from '../engine/healthcheck'

type Row = (string | number | boolean | null)[]

/** Helper: build a sheet with a bold header row + data rows. */
function makeSheet(header: string[], rows: Row[]): XLSX.WorkSheet {
  const aoa: Row[] = [header, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Bold header row
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (!ws[addr]) continue
    ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: '0F3057' }, patternType: 'solid' } }
  }

  // Auto column widths
  const colWidths = header.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[i] ?? '').length)
    )
    return { wch: Math.min(maxLen + 2, 50) }
  })
  ws['!cols'] = colWidths

  return ws
}

export function exportXlsx(state: Pick<SurveyorState, 'hardware' | 'advanced' | 'volumes' | 'workloads' | 'avd' | 'sofs' | 'aks' | 'infraVms' | 'devTestVms' | 'backupArchive' | 'customVms' | 'avdEnabled' | 'sofsEnabled'>): void {
  const capacity = computeCapacity(state.hardware, state.advanced)
  const volumeSummary = computeVolumeSummary(state.volumes, capacity)
  const compute = computeCompute(state.hardware, state.advanced)
  const avd = computeAvd(state.avd, state.advanced.overrides)
  const sofs = computeSofs(state.sofs, state.advanced.overrides)
  const aks = computeAks(state.aks)
  const workloadSummary = computeWorkloadSummary(state.workloads)
  const health = runHealthCheck({
    hardware: state.hardware,
    settings: state.advanced,
    volumes: state.volumes,
    capacity,
    compute,
    workloadSummary,
  })

  const wb = XLSX.utils.book_new()
  wb.Props = {
    Title: 'Azure Local Surveyor — Cluster Plan',
    Author: 'Azure Local Surveyor',
    CreatedDate: new Date(),
  }

  // ── Sheet 1: Hardware Inputs ──────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, makeSheet(
    ['Parameter', 'Value'],
    [
      ['Node Count', state.hardware.nodeCount],
      ['Capacity Drives / Node', state.hardware.capacityDrivesPerNode],
      ['Capacity Drive Size (TB)', state.hardware.capacityDriveSizeTB],
      ['Capacity Media Type', state.hardware.capacityMediaType.toUpperCase()],
      ['Cache Drives / Node', state.hardware.cacheDrivesPerNode],
      ['Cache Drive Size (TB)', state.hardware.cacheDriveSizeTB],
      ['Cache Media Type', state.hardware.cacheMediaType.toUpperCase()],
      ['Cores / Node (Physical)', state.hardware.coresPerNode],
      ['Hyperthreading', state.hardware.hyperthreadingEnabled ? 'Enabled' : 'Disabled'],
      ['Memory / Node (GB)', state.hardware.memoryPerNodeGB],
      ['Volume Provisioning', state.hardware.volumeProvisioning],
    ],
  ), 'Hardware Inputs')

  // ── Sheet 2: Capacity Report ──────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, makeSheet(
    ['Metric', 'Value', 'Notes'],
    [
      ['Raw Pool (TB)', capacity.rawPoolTB, 'All capacity drives × drive size'],
      ['Usable Per Drive (TB)', capacity.usablePerDriveTB, `Drive size × ${state.advanced.capacityEfficiencyFactor} efficiency factor`],
      ['Total Usable (TB)', capacity.totalUsableTB, 'Usable per drive × drives × nodes'],
      ['Reserve Drives', capacity.reserveDrives, 'min(nodeCount, 4) — S2D rebuild reserve'],
      ['Reserve (TB)', capacity.reserveTB, 'Reserve drives × usable per drive'],
      ['Infra Volume Pool Footprint (TB)', round2(capacity.infraVolumeTB), 'System CSV pool footprint'],
      ['Available for Volumes (TB)', round2(capacity.availableForVolumesTB), 'Pool space for user volumes'],
      ['Available for Volumes (TiB)', round2(capacity.availableForVolumesTiB), 'OS-visible value (WAC/PowerShell)'],
      ['Resiliency Type', capacity.resiliencyType, ''],
      ['Resiliency Factor', capacity.resiliencyFactor, ''],
      ['Effective Usable (TB)', round2(capacity.effectiveUsableTB), 'Plan workloads against this number'],
      ['Volume Utilization (%)', round2(volumeSummary.utilizationPct), `${volumeSummary.totalPlannedTB} TB planned`],
    ],
  ), 'Capacity Report')

  // ── Sheet 3: Volume Detail ────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, makeSheet(
    ['Name', 'Resiliency', 'Planned Size (TB)', 'Pool Footprint (TB)', 'WAC Size (GB)', 'WAC Size (TB)'],
    [
      ...volumeSummary.volumes.map((v) => [
        v.name,
        v.resiliency,
        v.calculatorSizeTB,
        round2(v.calculatorSizeTB / capacity.resiliencyFactor),
        v.wacSizeGB,
        v.wacSizeTB,
      ]),
      [],
      ['', 'Total Planned (TB)', volumeSummary.totalPlannedTB, null, null, null],
      ['', 'Remaining Usable (TB)', volumeSummary.remainingUsableTB, null, null, null],
      ['', 'Utilization (%)', volumeSummary.utilizationPct, null, null, null],
    ] as Row[],
  ), 'Volume Detail')

  // ── Sheet 4: Compute Report ───────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, makeSheet(
    ['Metric', 'Value', 'Notes'],
    [
      ['Physical Cores (all nodes)', compute.physicalCores, ''],
      ['Logical Cores (all nodes)', compute.logicalCores, compute.hyperthreadingEnabled ? 'Hyperthreading ×2' : 'HT disabled'],
      ['Logical Cores Per Node', compute.logicalCoresPerNode, ''],
      ['System Reserved vCPUs (all nodes)', compute.systemReservedVCpus, 'Hyper-V, Arc VM agent, OS processes'],
      ['Usable vCPUs (all nodes)', compute.usableVCpus, 'Available for workloads'],
      ['Usable vCPUs N+1 (one node down)', compute.usableVCpusN1, 'Capacity with one node failed'],
      ['Physical Memory (GB)', compute.physicalMemoryGB, ''],
      ['System Reserved Memory (GB)', compute.systemReservedMemoryGB, ''],
      ['Usable Memory (GB)', compute.usableMemoryGB, 'Available for workloads'],
      ['Usable Memory N+1 (GB)', compute.usableMemoryGBN1, 'Capacity with one node failed'],
      ['NUMA Domains (estimate)', compute.numaDomainsEstimate, ''],
    ],
  ), 'Compute Report')

  // ── Sheet 5: Workload Planner ─────────────────────────────────────────────
  const wlRows: Row[] = []
  if (state.avdEnabled) wlRows.push(['AVD (Azure Virtual Desktop)', avd.totalVCpus, avd.totalMemoryGB, round2(avd.totalStorageTB), 'Enabled'])
  if (state.aks.enabled) wlRows.push(['AKS on Azure Local', aks.totalVCpus, aks.totalMemoryGB, round2(aks.totalStorageTB), 'Enabled'])
  if (state.infraVms.enabled) wlRows.push([
    'Infrastructure VMs',
    Math.round((state.infraVms.vmCount * state.infraVms.vCpusPerVm) / state.infraVms.vCpuOvercommitRatio),
    state.infraVms.vmCount * state.infraVms.memoryPerVmGB,
    round2((state.infraVms.vmCount * state.infraVms.storagePerVmGB) / 1024),
    'Enabled',
  ])
  if (state.devTestVms.enabled) wlRows.push([
    'Dev/Test VMs',
    Math.round((state.devTestVms.vmCount * state.devTestVms.vCpusPerVm) / state.devTestVms.vCpuOvercommitRatio),
    state.devTestVms.vmCount * state.devTestVms.memoryPerVmGB,
    round2((state.devTestVms.vmCount * state.devTestVms.storagePerVmGB) / 1024),
    'Enabled',
  ])
  if (state.backupArchive.enabled) wlRows.push(['Backup / Archive', 0, 0, round2(state.backupArchive.storageTB), 'Enabled'])
  if (state.customVms.enabled) wlRows.push([
    'Custom VMs',
    Math.round((state.customVms.vmCount * state.customVms.vCpusPerVm) / state.customVms.vCpuOvercommitRatio),
    state.customVms.vmCount * state.customVms.memoryPerVmGB,
    round2((state.customVms.vmCount * state.customVms.storagePerVmGB) / 1024),
    'Enabled',
  ])
  if (state.sofsEnabled) wlRows.push(['SOFS Guest Cluster', sofs.sofsVCpusTotal, sofs.sofsMemoryTotalGB, round2(sofs.totalStorageTB), 'Enabled'])

  XLSX.utils.book_append_sheet(wb, makeSheet(
    ['Scenario', 'vCPUs', 'Memory (GB)', 'Storage (TB)', 'Status'],
    wlRows.length > 0 ? wlRows : [['No scenarios enabled', null, null, null, null]],
  ), 'Workload Planner')

  // ── Sheet 6: AVD Planning ─────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, makeSheet(
    ['Parameter', 'Value'],
    [
      ['Total Users', state.avd.totalUsers],
      ['Concurrent Users (sizing)', state.avd.concurrentUsers || 'Use total users'],
      ['Workload Type', state.avd.workloadType],
      ['Multi-Session', state.avd.multiSession ? 'Yes' : 'No (single-session VDI)'],
      ['Profile Size (GB)', state.avd.profileSizeGB],
      ['Growth Buffer (%)', state.avd.growthBufferPct],
      ['Office Container Enabled', state.avd.officeContainerEnabled ? 'Yes' : 'No'],
      ['Office Container Size (GB)', state.avd.officeContainerSizeGB],
      ['Data Disk Per Host (GB)', state.avd.dataDiskPerHostGB || 'None'],
      ['Profile Storage Location', state.avd.profileStorageLocation],
      [],
      ['--- Results ---', ''],
      ['Users Per Session Host', avd.usersPerHost],
      ['Session Host Count', avd.sessionHostCount],
      ['vCPUs Per Host', avd.vCpusPerHost],
      ['Memory Per Host (GB)', avd.memoryPerHostGB],
      ['Total vCPUs', avd.totalVCpus],
      ['Total Memory (GB)', avd.totalMemoryGB],
      ['Effective Profile Size (GB)', avd.effectiveProfileSizeGB],
      ['OS Disk Storage (TB)', avd.totalOsStorageTB],
      ['Profile Storage with Growth (TB)', avd.profileStorageWithGrowthTB],
      ['Office Container Storage (TB)', avd.totalOfficeContainerStorageTB],
      ['Data Disk Storage (TB)', avd.totalDataDiskStorageTB],
      ['Total AVD Storage (TB)', avd.totalStorageTB],
      ['Bandwidth Per User (Mbps)', avd.bandwidthPerUserMbps],
      ['Total Bandwidth (Mbps)', avd.totalBandwidthMbps],
    ],
  ), 'AVD Planning')

  // ── Sheet 7: SOFS Planner ─────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, makeSheet(
    ['Parameter', 'Value'],
    [
      ['User Count', state.sofs.userCount],
      ['Concurrent Users', state.sofs.concurrentUsers || 'Use total users'],
      ['Profile Size (GB)', state.sofs.profileSizeGB],
      ['Redirected Folder Size (GB)', state.sofs.redirectedFolderSizeGB],
      ['Container Type', state.sofs.containerType],
      ['SOFS Guest VM Count', state.sofs.sofsGuestVmCount],
      ['vCPUs / SOFS VM', state.sofs.sofsVCpusPerVm],
      ['Memory / SOFS VM (GB)', state.sofs.sofsMemoryPerVmGB],
      [],
      ['--- Results ---', ''],
      ['Total Profile Storage (TB)', sofs.totalProfileStorageTB],
      ['Total Redirected Storage (TB)', sofs.totalRedirectedStorageTB],
      ['Total SOFS Storage (TB)', sofs.totalStorageTB],
      ['Total SOFS vCPUs', sofs.sofsVCpusTotal],
      ['Total SOFS Memory (GB)', sofs.sofsMemoryTotalGB],
      ['Steady-State IOPS', sofs.totalSteadyStateIops],
      ['Login Storm IOPS (peak)', sofs.totalLoginStormIops],
      ['Auto-Size Drive Size (TB)', sofs.autoSizeDriveSizeTB || 'Disabled'],
    ],
  ), 'SOFS Planner')

  // ── Sheet 8: AKS ─────────────────────────────────────────────────────────
  if (state.aks.enabled) {
    XLSX.utils.book_append_sheet(wb, makeSheet(
      ['Parameter', 'Value'],
      [
        ['Cluster Count', state.aks.clusterCount],
        ['Control Plane Nodes / Cluster', state.aks.controlPlaneNodesPerCluster],
        ['Worker Nodes / Cluster', state.aks.workerNodesPerCluster],
        ['vCPUs / Worker', state.aks.vCpusPerWorker],
        ['Memory / Worker (GB)', state.aks.memoryPerWorkerGB],
        ['OS Disk / Node (GB)', state.aks.osDiskPerNodeGB],
        ['Persistent Volumes (TB)', state.aks.persistentVolumesTB],
        ['Data Services (TB)', state.aks.dataServicesTB],
        [],
        ['--- Results ---', ''],
        ['Total Nodes', aks.totalNodes],
        ['Total vCPUs', aks.totalVCpus],
        ['Total Memory (GB)', aks.totalMemoryGB],
        ['Total Storage (TB)', round2(aks.totalStorageTB)],
      ],
    ), 'AKS')
  }

  // ── Sheet 9: Health Check ─────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, makeSheet(
    ['Status', 'Code', 'Severity', 'Message'],
    health.issues.length > 0
      ? health.issues.map((i) => [
          i.severity === 'error' ? 'FAIL' : i.severity === 'warning' ? 'WARN' : 'INFO',
          i.code,
          i.severity.toUpperCase(),
          i.message,
        ])
      : [['PASS', '', '', 'All health checks passed — no issues found.']],
  ), 'Health Check')

  // ── Sheet 10: Advanced Settings ───────────────────────────────────────────
  const overrides = state.advanced.overrides ?? {}
  XLSX.utils.book_append_sheet(wb, makeSheet(
    ['Setting', 'Value', 'Default', 'Notes'],
    [
      ['Capacity Efficiency Factor', state.advanced.capacityEfficiencyFactor, 0.92, 'Applied per drive (ReFS + NVMe overhead)'],
      ['Infra Volume Size (TB)', state.advanced.infraVolumeSizeTB, 0.25, 'Azure Local system CSV logical size'],
      ['vCPU Oversubscription Ratio', state.advanced.vCpuOversubscriptionRatio, 4, 'Logical cores × ratio = total vCPUs'],
      ['System Reserved Memory / Node (GB)', state.advanced.systemReservedMemoryGB, 8, 'Hyper-V, Arc, OS reservation'],
      ['System Reserved vCPUs / Node', state.advanced.systemReservedVCpus, 4, 'Hyper-V, Arc VM agent, OS'],
      ['Default Resiliency', state.advanced.defaultResiliency, 'three-way-mirror', ''],
      [],
      ['--- Active Overrides ---', '', '', ''],
      ['Drive Usable Override (TB)', overrides.driveUsableTb ?? 'none', '', 'Replaces drive size × efficiency factor'],
      ['AVD Session Hosts Override', overrides.avdSessionHostsNeeded ?? 'none', '', 'Replaces ceil(users / density)'],
      ['AVD Profile Logical TB Override', overrides.avdProfileLogicalTb ?? 'none', '', 'Replaces users × profileGB / 1024'],
      ['SOFS Profile Demand TB Override', overrides.sofsProfileDemandTb ?? 'none', '', 'Replaces userCount × profileGB / 1024'],
    ],
  ), 'Advanced Settings')

  XLSX.writeFile(wb, 'azure-local-surveyor-plan.xlsx')
}
