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
import { computeServicePreset, getCatalogEntry } from './service-presets'

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
    let rawVCpus = 0
    let rawMemoryGB = 0
    for (const group of vm.groups) {
      rawVCpus    += group.vmCount * group.vCpusPerVm
      rawMemoryGB += group.vmCount * group.memoryPerVmGB
      totalStorageTB += (group.vmCount * group.storagePerVmGB) / 1024
    }
    totalVCpus    += rawVCpus / vm.vCpuOvercommitRatio
    totalMemoryGB += rawMemoryGB
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

  // Arc-dependent presets run on AKS worker nodes. When AKS is enabled their compute
  // is already counted within the AKS worker totals — only count non-AKS presets.
  // Storage always counts (needs physical PVC storage regardless of AKS state).
  for (const inst of input.servicePresets) {
    if (!inst.enabled || inst.instanceCount <= 0) continue
    const entry = getCatalogEntry(inst.catalogId)
    const t = computeServicePreset(inst)
    if (!(input.aksEnabled && entry?.requiresAks)) {
      totalVCpus    += t.totalVCpus
      totalMemoryGB += t.totalMemoryGB
    }
    totalStorageTB += t.totalStorageTB
  }

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
