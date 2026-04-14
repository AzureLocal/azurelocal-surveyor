/**
 * XLSX exporter — SheetJS (#18: richer multi-sheet export).
 * Exports the full plan to a workbook matching the Excel sheet structure.
 * Sheets: Hardware Inputs, Capacity Report, Compute Report, Volume Detail,
 *         Workload Planner, AVD Planning, SOFS Planner, AKS, VMs, MABS,
 *         Health Check, Advanced Settings
 */

import * as XLSX from 'xlsx'
import type { SurveyorState } from '../state/store'
import { computeCapacity, round2 } from '../engine/capacity'
import { computeVolumeSummary, computeQuickStart } from '../engine/volumes'
import { computeCompute } from '../engine/compute'
import { computeAvd } from '../engine/avd'
import { computeSofs } from '../engine/sofs'
import { computeAks } from '../engine/aks'
import { computeMabs } from '../engine/mabs'
import { computeAllCustomWorkloads } from '../engine/custom-workloads'
import { computeAllServicePresets, getCatalogEntry, computeServicePreset } from '../engine/service-presets'
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

export function exportXlsx(state: Pick<SurveyorState, 'hardware' | 'advanced' | 'volumes' | 'workloads' | 'avd' | 'sofs' | 'aks' | 'virtualMachines' | 'mabs' | 'avdEnabled' | 'sofsEnabled' | 'mabsEnabled' | 'servicePresets' | 'customWorkloads'>): void {
  const capacity = computeCapacity(state.hardware, state.advanced)
  const volumeSummary = computeVolumeSummary(state.volumes, capacity)
  const compute = computeCompute(state.hardware, state.advanced)
  const avd = computeAvd(state.avd, state.advanced.overrides)
  const sofs = computeSofs(state.sofs, state.advanced.overrides)
  const aks = computeAks(state.aks)
  const mabsResult = computeMabs(state.mabs)
  const quickStart = computeQuickStart(capacity)

  // Aggregate workload totals
  let totalVCpus = 0, totalMemoryGB = 0, totalStorageTB = 0
  if (state.avdEnabled) { totalVCpus += avd.totalVCpus; totalMemoryGB += avd.totalMemoryGB; totalStorageTB += avd.totalStorageTB }
  if (state.aks.enabled) { totalVCpus += aks.totalVCpus; totalMemoryGB += aks.totalMemoryGB; totalStorageTB += aks.totalStorageTB }
  if (state.virtualMachines?.enabled) {
    const vm = state.virtualMachines
    totalVCpus += (vm.vmCount * vm.vCpusPerVm) / vm.vCpuOvercommitRatio
    totalMemoryGB += vm.vmCount * vm.memoryPerVmGB
    totalStorageTB += (vm.vmCount * vm.storagePerVmGB) / 1024
  }
  if (state.sofsEnabled) { totalVCpus += sofs.sofsVCpusTotal; totalMemoryGB += sofs.sofsMemoryTotalGB; totalStorageTB += sofs.totalStorageTB }
  if (state.mabsEnabled) { totalVCpus += mabsResult.mabsVCpus; totalMemoryGB += mabsResult.mabsMemoryGB; totalStorageTB += mabsResult.totalStorageTB + mabsResult.mabsOsDiskTB }
  const presetTotals = computeAllServicePresets(state.servicePresets)
  totalVCpus    += presetTotals.totalVCpus
  totalMemoryGB += presetTotals.totalMemoryGB
  totalStorageTB += presetTotals.totalStorageTB
  const customTotals = computeAllCustomWorkloads(state.customWorkloads)
  totalVCpus    += customTotals.totalVCpus
  totalMemoryGB += customTotals.totalMemoryGB
  totalStorageTB += customTotals.totalStorageTB

  const workloadSummary = {
    totalVCpus: Math.round(totalVCpus),
    totalMemoryGB: Math.round(totalMemoryGB),
    totalStorageTB: round2(totalStorageTB),
  }

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
  const capRows: Row[] = [
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
  ]

  // Quick-start reference
  if (quickStart.rows.length > 0) {
    const row = quickStart.rows[0]
    capRows.push(
      [],
      ['--- Quick-Start Reference ---', '', ''],
      ['Equal Volume Count', row.volumeCount, `1 per node (${row.resiliencyLabel})`],
      ['Calculator Size (TB)', row.calculatorSizeTB, 'Effective usable ÷ volume count'],
      ['WAC Size (TiB)', row.wacSizeTiB, 'Binary-unit value for New-Volume -Size'],
      ['WAC Size (GiB)', row.wacSizeGiB, 'Whole GiB for WAC input'],
      ['Pool Footprint (TB)', row.poolFootprintTB, 'Total pool space consumed'],
      ['Fits in Pool', row.fits ? 'YES' : 'NO', `${row.utilizationPct}% utilization`],
    )
  }

  XLSX.utils.book_append_sheet(wb, makeSheet(
    ['Metric', 'Value', 'Notes'],
    capRows,
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
  if (state.virtualMachines?.enabled) {
    const vm = state.virtualMachines
    wlRows.push([
      'Virtual Machines',
      Math.round((vm.vmCount * vm.vCpusPerVm) / vm.vCpuOvercommitRatio),
      vm.vmCount * vm.memoryPerVmGB,
      round2((vm.vmCount * vm.storagePerVmGB) / 1024),
      'Enabled',
    ])
  }
  if (state.sofsEnabled) wlRows.push(['SOFS Guest Cluster', sofs.sofsVCpusTotal, sofs.sofsMemoryTotalGB, round2(sofs.totalStorageTB), 'Enabled'])
  if (state.mabsEnabled) wlRows.push(['MABS (Azure Backup Server)', mabsResult.mabsVCpus, mabsResult.mabsMemoryGB, round2(mabsResult.totalStorageTB + mabsResult.mabsOsDiskTB), 'Enabled'])
  if (presetTotals.totalVCpus > 0) wlRows.push(['Arc-Enabled Services', presetTotals.totalVCpus, presetTotals.totalMemoryGB, presetTotals.totalStorageTB, 'Enabled'])
  if (customTotals.totalVCpus > 0) wlRows.push(['Custom Workloads', customTotals.totalVCpus, customTotals.totalMemoryGB, customTotals.totalStorageTB, 'Enabled'])

  if (wlRows.length > 0) {
    wlRows.push([])
    wlRows.push(['TOTAL', workloadSummary.totalVCpus, workloadSummary.totalMemoryGB, workloadSummary.totalStorageTB, ''])
  }

  XLSX.utils.book_append_sheet(wb, makeSheet(
    ['Scenario', 'vCPUs', 'Memory (GB)', 'Storage (TB)', 'Status'],
    wlRows.length > 0 ? wlRows : [['No scenarios enabled', null, null, null, null]],
  ), 'Workload Planner')

  // ── Sheet 6: AVD Planning ─────────────────────────────────────────────────
  if (state.avdEnabled) {
    const avdRows = [
      ['Session Host Groups', state.avd.pools.length],
      ['Total Users', avd.totalUsers],
      ['Concurrent Users (sizing)', avd.totalConcurrentUsers || 'Use total users'],
      ['Growth Buffer (%)', state.avd.growthBufferPct],
      ['User Type Mix Enabled', state.avd.userTypeMixEnabled ? 'Yes' : 'No'],
      ['Total Session Hosts', avd.sessionHostCount],
      ['Total vCPUs', avd.totalVCpus],
      ['Total Memory (GB)', avd.totalMemoryGB],
      ['Cluster Storage on Azure Local (TB)', avd.totalStorageTB],
      ['External Profile and Office Storage (TB)', avd.totalExternalStorageTB],
      ['Total Bandwidth (Mbps)', avd.totalBandwidthMbps],
      [],
      ['--- Per-Pool Detail ---', ''],
      ...state.avd.pools.flatMap((pool, index) => {
        const poolResult = avd.pools.find((item) => item.id === pool.id)
        if (!poolResult) return []
        return [
          [`Pool ${index + 1}`, pool.name],
          ['Total Users', pool.totalUsers],
          ['Concurrent Users (sizing)', pool.concurrentUsers || 'Use total users'],
          ['Workload Type', pool.workloadType],
          ['Multi-Session', pool.multiSession ? 'Yes' : 'No (single-session VDI)'],
          ['Profile Size (GB)', pool.profileSizeGB],
          ['Office Container Enabled', pool.officeContainerEnabled ? 'Yes' : 'No'],
          ['Office Container Size (GB)', pool.officeContainerSizeGB],
          ['Data Disk Per Host (GB)', pool.dataDiskPerHostGB || 'None'],
          ['Profile Storage Location', pool.profileStorageLocation],
          ['Users Per Session Host', poolResult.usersPerHost],
          ['Session Host Count', poolResult.sessionHostCount],
          ['Sizing Users', poolResult.sizingUsers],
          ['vCPUs Per Host', poolResult.vCpusPerHost],
          ['Memory Per Host (GB)', poolResult.memoryPerHostGB],
          ['Limiting Factor', poolResult.limitingFactor],
          ['Effective Profile Size (GB)', poolResult.effectiveProfileSizeGB],
          ['OS Disk Storage (TB)', poolResult.totalOsStorageTB],
          ['Data Disk Storage (TB)', poolResult.totalDataDiskStorageTB],
          ['Profile Storage (TB)', poolResult.totalProfileStorageTB],
          ['Office Container Storage (TB)', poolResult.totalOfficeContainerStorageTB],
          ['Cluster Storage (TB)', poolResult.totalStorageTB],
          ['External Storage (TB)', poolResult.externalizedStorageTB],
          ['Bandwidth Per User (Mbps)', poolResult.bandwidthPerUserMbps],
          ['Total Bandwidth (Mbps)', poolResult.totalBandwidthMbps],
          [],
        ]
      }),
    ]

    XLSX.utils.book_append_sheet(wb, makeSheet(
      ['Parameter', 'Value'],
      avdRows,
    ), 'AVD Planning')
  }

  // ── Sheet 7: SOFS Planner ─────────────────────────────────────────────────
  if (state.sofsEnabled) {
    XLSX.utils.book_append_sheet(wb, makeSheet(
      ['Parameter', 'Value'],
      [
        ['User Count', state.sofs.userCount],
        ['Concurrent Users', state.sofs.concurrentUsers || 'Use total users'],
        ['Profile Size (GB)', state.sofs.profileSizeGB],
        ['Redirected Folder Size (GB)', state.sofs.redirectedFolderSizeGB],
        ['Container Type', state.sofs.containerType],
        ['Internal Mirror Type', state.sofs.internalMirror],
        ['SOFS Guest VM Count', state.sofs.sofsGuestVmCount],
        ['vCPUs / SOFS VM', state.sofs.sofsVCpusPerVm],
        ['Memory / SOFS VM (GB)', state.sofs.sofsMemoryPerVmGB],
        ['Auto-Size Drives/Node', state.sofs.autoSizeDrivesPerNode || 'Disabled'],
        [],
        ['--- Results ---', ''],
        ['Total Profile Storage (TB)', sofs.totalProfileStorageTB],
        ['Total Redirected Storage (TB)', sofs.totalRedirectedStorageTB],
        ['Total Logical Storage (TB)', sofs.totalStorageTB],
        ['Internal Mirror Factor', `${sofs.internalMirrorFactor}×`],
        ['Internal Footprint (TB)', sofs.internalFootprintTB],
        ['Total SOFS vCPUs', sofs.sofsVCpusTotal],
        ['Total SOFS Memory (GB)', sofs.sofsMemoryTotalGB],
        ['Steady-State IOPS / User', sofs.steadyStateIopsPerUser],
        ['Login Storm IOPS / User', sofs.loginStormIopsPerUser],
        ['Total Steady-State IOPS', sofs.totalSteadyStateIops],
        ['Total Login Storm IOPS (peak)', sofs.totalLoginStormIops],
        ['Auto-Size Drive Size (TB)', sofs.autoSizeDriveSizeTB || 'Disabled'],
      ],
    ), 'SOFS Planner')
  }

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
        ['Resiliency', state.aks.resiliency],
        [],
        ['--- Results ---', ''],
        ['Total Nodes', aks.totalNodes],
        ['Control Plane vCPUs', aks.totalControlPlaneVCpus],
        ['Worker vCPUs', aks.totalWorkerVCpus],
        ['Total vCPUs', aks.totalVCpus],
        ['Control Plane Memory (GB)', aks.totalControlPlaneMemoryGB],
        ['Worker Memory (GB)', aks.totalWorkerMemoryGB],
        ['Total Memory (GB)', aks.totalMemoryGB],
        ['OS Disk (TB)', round2(aks.osDiskTB)],
        ['Total Storage (TB)', round2(aks.totalStorageTB)],
      ],
    ), 'AKS')
  }

  // ── Sheet 9: Virtual Machines ─────────────────────────────────────────────
  if (state.virtualMachines?.enabled) {
    const vm = state.virtualMachines
    const effectiveVCpus = Math.round((vm.vmCount * vm.vCpusPerVm) / vm.vCpuOvercommitRatio)
    XLSX.utils.book_append_sheet(wb, makeSheet(
      ['Parameter', 'Value'],
      [
        ['VM Count', vm.vmCount],
        ['vCPUs / VM', vm.vCpusPerVm],
        ['Memory / VM (GB)', vm.memoryPerVmGB],
        ['Storage / VM (GB)', vm.storagePerVmGB],
        ['Resiliency', vm.resiliency],
        ['vCPU Overcommit Ratio', `${vm.vCpuOvercommitRatio}:1`],
        [],
        ['--- Results ---', ''],
        ['Raw vCPU Demand', vm.vmCount * vm.vCpusPerVm],
        ['Effective vCPUs (after overcommit)', effectiveVCpus],
        ['Total Memory (GB)', vm.vmCount * vm.memoryPerVmGB],
        ['Total Storage (TB)', round2((vm.vmCount * vm.storagePerVmGB) / 1024)],
      ],
    ), 'Virtual Machines')
  }

  // ── Sheet 10: MABS ────────────────────────────────────────────────────────
  if (state.mabsEnabled) {
    XLSX.utils.book_append_sheet(wb, makeSheet(
      ['Parameter', 'Value'],
      [
        ['Protected Data (TB)', state.mabs.protectedDataTB],
        ['Daily Change Rate (%)', state.mabs.dailyChangeRatePct],
        ['On-Prem Retention (days)', state.mabs.onPremRetentionDays],
        ['Scratch Cache (%)', state.mabs.scratchCachePct],
        ['MABS VM vCPUs', state.mabs.mabsVCpus],
        ['MABS VM Memory (GB)', state.mabs.mabsMemoryGB],
        ['MABS VM OS Disk (GB)', state.mabs.mabsOsDiskGB],
        ['Scratch Volume Resiliency', state.mabs.scratchResiliency],
        ['Backup Volume Resiliency', state.mabs.backupResiliency],
        ['Internal Mirror', state.mabs.internalMirror],
        [],
        ['--- Results ---', ''],
        ['Scratch Volume (TB)', mabsResult.scratchVolumeTB],
        ['Backup Data Volume (TB)', mabsResult.backupDataVolumeTB],
        ['Total Logical Storage (TB)', mabsResult.totalStorageTB],
        ['Internal Mirror Factor', `${mabsResult.internalMirrorFactor}×`],
        ['Internal Footprint (TB)', mabsResult.internalFootprintTB],
        ['MABS VM vCPUs', mabsResult.mabsVCpus],
        ['MABS VM Memory (GB)', mabsResult.mabsMemoryGB],
        ['MABS VM OS Disk (TB)', mabsResult.mabsOsDiskTB],
      ],
    ), 'MABS')
  }

  // ── Sheet 11: Arc-Enabled Services ───────────────────────────────────────
  const enabledPresets = state.servicePresets.filter((p) => p.enabled && p.instanceCount > 0)
  if (enabledPresets.length > 0) {
    const presetRows: Row[] = enabledPresets.map((inst) => {
      const entry = getCatalogEntry(inst.catalogId)
      if (!entry) return [inst.catalogId, inst.instanceCount, null, null, null, null]
      const t = computeServicePreset(inst)
      return [
        entry.shortName,
        inst.instanceCount,
        inst.vCpusOverride ?? entry.defaultVCpusPerInstance,
        inst.memoryGBOverride ?? entry.defaultMemoryGBPerInstance,
        inst.storageTBOverride ?? entry.defaultStorageTBPerInstance,
        t.totalVCpus,
        t.totalMemoryGB,
        t.totalStorageTB,
        entry.defaultPvcResiliency,
      ]
    })
    presetRows.push([])
    presetRows.push(['TOTAL', null, null, null, null, presetTotals.totalVCpus, presetTotals.totalMemoryGB, presetTotals.totalStorageTB, ''])

    XLSX.utils.book_append_sheet(wb, makeSheet(
      ['Service', 'Instances', 'vCPUs/Instance', 'Memory/Instance (GB)', 'Storage/Instance (TB)', 'Total vCPUs', 'Total Memory (GB)', 'Total Storage (TB)', 'PVC Resiliency'],
      presetRows,
    ), 'Arc Services')
  }

  // ── Custom Workloads sheet ────────────────────────────────────────────────
  const enabledCustom = state.customWorkloads.filter((w) => w.enabled)
  if (enabledCustom.length > 0) {
    const cwRows: Row[] = enabledCustom.map((w) => [
      w.name,
      w.description || '',
      w.vmCount,
      w.vCpusPerVm,
      w.vmCount * w.vCpusPerVm,
      w.memoryPerVmGB,
      w.vmCount * w.memoryPerVmGB,
      w.osDiskPerVmGB,
      round2((w.vmCount * w.osDiskPerVmGB) / 1024),
      w.storageTB,
      w.resiliency,
      w.internalMirrorFactor > 1 ? `${w.internalMirrorFactor}×` : 'None',
      round2(w.storageTB * w.internalMirrorFactor),
      w.bandwidthMbps > 0 ? w.bandwidthMbps : 'Not specified',
    ])
    cwRows.push([])
    cwRows.push(['TOTAL', '', '', '', customTotals.totalVCpus, '', customTotals.totalMemoryGB, '', '', '', '', '', '', ''])

    XLSX.utils.book_append_sheet(wb, makeSheet(
      ['Name', 'Description', 'VMs', 'vCPUs/VM', 'Total vCPUs', 'RAM/VM (GB)', 'Total RAM (GB)', 'OS Disk/VM (GB)', 'OS Disk Total (TB)', 'Storage (TB)', 'Resiliency', 'Internal Mirror', 'Storage Footprint (TB)', 'Bandwidth (Mbps)'],
      cwRows,
    ), 'Custom Workloads')
  }

  // ── Sheet 12/13: Health Check ─────────────────────────────────────────────
  const healthRows: Row[] = []

  // Summary row
  healthRows.push([
    health.passed ? 'PASSED' : 'FAILED',
    '',
    '',
    `${health.errorCount} errors, ${health.warningCount} warnings, ${health.infoCount} info`,
  ])
  healthRows.push([])

  // Per-volume detail
  if (health.volumeDetails.length > 0) {
    healthRows.push(['--- Volume Validation ---', '', '', ''])
    for (const vd of health.volumeDetails) {
      healthRows.push([
        vd.status === 'pass' ? 'PASS' : 'FAIL',
        vd.name,
        vd.resiliency,
        vd.failReason ?? `${vd.poolFootprintTB} TB pool footprint`,
      ])
    }
    healthRows.push([])
  }

  // Issues
  if (health.issues.length > 0) {
    healthRows.push(['--- Issues ---', '', '', ''])
    for (const i of health.issues) {
      healthRows.push([
        i.severity === 'error' ? 'FAIL' : i.severity === 'warning' ? 'WARN' : 'INFO',
        i.code,
        i.severity.toUpperCase(),
        i.message,
      ])
    }
  } else {
    healthRows.push(['PASS', '', '', 'All health checks passed — no issues found.'])
  }

  healthRows.push([])
  healthRows.push(['Pool Utilization (%)', health.utilizationPct, `${round2(health.totalPoolFootprintTB)} TB of ${round2(health.availablePoolTB)} TB`, ''])

  XLSX.utils.book_append_sheet(wb, makeSheet(
    ['Status', 'Code / Name', 'Severity / Resiliency', 'Message / Detail'],
    healthRows,
  ), 'Health Check')

  // ── Sheet 12: Advanced Settings ───────────────────────────────────────────
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
