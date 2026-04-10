/**
 * XLSX round-trip exporter — SheetJS.
 * Exports the current plan back to an Excel workbook so customers who
 * prefer working in Excel can import the Surveyor output.
 */

import * as XLSX from 'xlsx'
import type { SurveyorState } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { computeVolumeSummary } from '../engine/volumes'
import { computeCompute } from '../engine/compute'
import { computeAvd } from '../engine/avd'
import { computeSofs } from '../engine/sofs'
import { computeWorkloadSummary } from '../engine/workloads'

export function exportXlsx(state: Pick<SurveyorState, 'hardware' | 'advanced' | 'volumes' | 'workloads' | 'avd' | 'sofs'>): void {
  const capacity = computeCapacity(state.hardware, state.advanced)
  const volumeSummary = computeVolumeSummary(state.volumes, capacity)
  const compute = computeCompute(state.hardware, state.advanced)
  const avd = computeAvd(state.avd)
  const sofs = computeSofs(state.sofs)
  const workloadSummary = computeWorkloadSummary(state.workloads)

  const wb = XLSX.utils.book_new()

  // Sheet: Hardware Inputs
  const hwSheet = XLSX.utils.aoa_to_sheet([
    ['Parameter', 'Value'],
    ['Node Count', state.hardware.nodeCount],
    ['Capacity Drives / Node', state.hardware.capacityDrivesPerNode],
    ['Capacity Drive Size (TB)', state.hardware.capacityDriveSizeTB],
    ['Capacity Media Type', state.hardware.capacityMediaType],
    ['Cache Drives / Node', state.hardware.cacheDrivesPerNode],
    ['Cache Drive Size (TB)', state.hardware.cacheDriveSizeTB],
    ['Cache Media Type', state.hardware.cacheMediaType],
    ['Cores / Node', state.hardware.coresPerNode],
    ['Memory / Node (GB)', state.hardware.memoryPerNodeGB],
  ])
  XLSX.utils.book_append_sheet(wb, hwSheet, 'Hardware Inputs')

  // Sheet: Capacity Report
  const capSheet = XLSX.utils.aoa_to_sheet([
    ['Metric', 'Value'],
    ['Raw Pool (TB)', capacity.rawPoolTB],
    ['Reserve Drives', capacity.reserveDrives],
    ['Reserve (TB)', capacity.reserveTB],
    ['Infra Volume (TB)', capacity.infraVolumeTB],
    ['Available for Volumes (TB)', capacity.availableForVolumesTB],
    ['Available for Volumes (TiB)', capacity.availableForVolumesTiB],
    ['Resiliency Type', capacity.resiliencyType],
    ['Resiliency Factor', capacity.resiliencyFactor],
    ['Effective Usable (TB)', capacity.effectiveUsableTB],
  ])
  XLSX.utils.book_append_sheet(wb, capSheet, 'Capacity Report')

  // Sheet: Volume Detail
  const volRows: unknown[][] = [
    ['Name', 'Resiliency', 'Calculator TB', 'WAC Size (GB)', 'WAC Size (TB)'],
    ...volumeSummary.volumes.map((v) => [v.name, v.resiliency, v.calculatorSizeTB, v.wacSizeGB, v.wacSizeTB]),
    [],
    ['Total Planned (TB)', volumeSummary.totalPlannedTB],
    ['Remaining Usable (TB)', volumeSummary.remainingUsableTB],
    ['Utilization (%)', volumeSummary.utilizationPct],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(volRows), 'Volume Detail')

  // Sheet: Compute Report
  const compSheet = XLSX.utils.aoa_to_sheet([
    ['Metric', 'Value'],
    ['Physical Cores', compute.physicalCores],
    ['System Reserved vCPUs', compute.systemReservedVCpus],
    ['Usable vCPUs', compute.usableVCpus],
    ['Physical Memory (GB)', compute.physicalMemoryGB],
    ['System Reserved Memory (GB)', compute.systemReservedMemoryGB],
    ['Usable Memory (GB)', compute.usableMemoryGB],
    ['NUMA Domains (estimate)', compute.numaDomainsEstimate],
  ])
  XLSX.utils.book_append_sheet(wb, compSheet, 'Compute Report')

  // Sheet: Workload Planner
  const wlRows: unknown[][] = [
    ['Name', 'VM Count', 'vCPUs / VM', 'Memory / VM (GB)', 'Storage / VM (GB)', 'Resiliency'],
    ...state.workloads.map((w) => [w.name, w.vmCount, w.vCpusPerVm, w.memoryPerVmGB, w.storagePerVmGB, w.resiliency]),
    [],
    ['Total vCPUs', workloadSummary.totalVCpus],
    ['Total Memory (GB)', workloadSummary.totalMemoryGB],
    ['Total Storage (TB)', workloadSummary.totalStorageTB],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wlRows), 'Workload Planner')

  // Sheet: AVD Planning
  const avdSheet = XLSX.utils.aoa_to_sheet([
    ['Parameter', 'Value'],
    ['Total Users', state.avd.totalUsers],
    ['Workload Type', state.avd.workloadType],
    ['Multi-Session', state.avd.multiSession],
    ['Profile Size (GB)', state.avd.profileSizeGB],
    ['Office Container Enabled', state.avd.officeContainerEnabled],
    ['Office Container Size (GB)', state.avd.officeContainerSizeGB],
    [],
    ['Result', ''],
    ['Users Per Host', avd.usersPerHost],
    ['Session Host Count', avd.sessionHostCount],
    ['Total vCPUs', avd.totalVCpus],
    ['Total Memory (GB)', avd.totalMemoryGB],
    ['Total Storage (TB)', avd.totalStorageTB],
  ])
  XLSX.utils.book_append_sheet(wb, avdSheet, 'AVD Planning')

  // Sheet: SOFS Planner
  const sofsSheet = XLSX.utils.aoa_to_sheet([
    ['Parameter', 'Value'],
    ['User Count', state.sofs.userCount],
    ['Profile Size (GB)', state.sofs.profileSizeGB],
    ['Redirected Folder Size (GB)', state.sofs.redirectedFolderSizeGB],
    ['SOFS Guest VM Count', state.sofs.sofsGuestVmCount],
    ['vCPUs / SOFS VM', state.sofs.sofsVCpusPerVm],
    ['Memory / SOFS VM (GB)', state.sofs.sofsMemoryPerVmGB],
    [],
    ['Result', ''],
    ['Total Profile Storage (TB)', sofs.totalProfileStorageTB],
    ['Total Redirected Storage (TB)', sofs.totalRedirectedStorageTB],
    ['Total Storage (TB)', sofs.totalStorageTB],
    ['Total SOFS vCPUs', sofs.sofsVCpusTotal],
    ['Total SOFS Memory (GB)', sofs.sofsMemoryTotalGB],
  ])
  XLSX.utils.book_append_sheet(wb, sofsSheet, 'SOFS Planner')

  XLSX.writeFile(wb, 'azure-local-surveyor-plan.xlsx')
}
