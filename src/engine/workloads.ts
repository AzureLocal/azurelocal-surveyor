import type {
  WorkloadSpec,
  WorkloadSummaryResult,
  AvdResult,
  AksResult,
  VmScenario,
  SofsResult,
  MabsResult,
  CustomWorkload,
} from './types'
import type { ServicePresetInstance } from './service-presets'
import { computeAllServicePresets } from './service-presets'

/**
 * Aggregate compute and storage requirements across all defined workloads.
 * Pure sum — no oversubscription applied here; that lives in compute.ts.
 */
export function computeWorkloadSummary(workloads: WorkloadSpec[]): WorkloadSummaryResult {
  const totalVCpus = workloads.reduce((s, w) => s + w.vCpusPerVm * w.vmCount, 0)
  const totalMemoryGB = workloads.reduce((s, w) => s + w.memoryPerVmGB * w.vmCount, 0)
  const totalStorageTB = round2(
    workloads.reduce((s, w) => s + (w.storagePerVmGB * w.vmCount) / 1024, 0)
  )
  return { totalVCpus, totalMemoryGB, totalStorageTB }
}

export interface WorkloadTotalsInput {
  avdEnabled: boolean
  avd: AvdResult
  aksEnabled: boolean
  aks: AksResult
  virtualMachines: VmScenario
  sofsEnabled: boolean
  sofs: SofsResult
  mabsEnabled: boolean
  mabs: MabsResult
  servicePresets: ServicePresetInstance[]
  customWorkloads: CustomWorkload[]
}

/**
 * Aggregate all enabled workload scenarios into a single summary.
 * Single source of truth used by all exporters and FinalReport.
 */
export function computeWorkloadTotals(input: WorkloadTotalsInput): WorkloadSummaryResult {
  let totalVCpus = 0
  let totalMemoryGB = 0
  let totalStorageTB = 0

  if (input.avdEnabled) {
    totalVCpus    += input.avd.totalVCpus
    totalMemoryGB += input.avd.totalMemoryGB
    totalStorageTB += input.avd.totalStorageTB
  }
  if (input.aksEnabled) {
    totalVCpus    += input.aks.totalVCpus
    totalMemoryGB += input.aks.totalMemoryGB
    totalStorageTB += input.aks.totalStorageTB
  }
  if (input.virtualMachines?.enabled) {
    const vm = input.virtualMachines
    totalVCpus    += (vm.vmCount * vm.vCpusPerVm) / vm.vCpuOvercommitRatio
    totalMemoryGB += vm.vmCount * vm.memoryPerVmGB
    totalStorageTB += (vm.vmCount * vm.storagePerVmGB) / 1024
  }
  if (input.sofsEnabled) {
    totalVCpus    += input.sofs.sofsVCpusTotal
    totalMemoryGB += input.sofs.sofsMemoryTotalGB
    totalStorageTB += input.sofs.totalStorageTB
  }
  if (input.mabsEnabled) {
    totalVCpus    += input.mabs.mabsVCpus
    totalMemoryGB += input.mabs.mabsMemoryGB
    totalStorageTB += input.mabs.totalStorageTB + input.mabs.mabsOsDiskTB
  }

  const presetTotals = computeAllServicePresets(input.servicePresets)
  totalVCpus    += presetTotals.totalVCpus
  totalMemoryGB += presetTotals.totalMemoryGB
  totalStorageTB += presetTotals.totalStorageTB

  for (const w of input.customWorkloads) {
    if (!w.enabled) continue
    totalVCpus    += w.vmCount * w.vCpusPerVm
    totalMemoryGB += w.vmCount * w.memoryPerVmGB
    totalStorageTB += (w.vmCount * w.osDiskPerVmGB) / 1024 + w.storageTB
  }

  return {
    totalVCpus: Math.round(totalVCpus),
    totalMemoryGB: Math.round(totalMemoryGB),
    totalStorageTB: round2(totalStorageTB),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
