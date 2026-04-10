import type { WorkloadSpec, WorkloadSummaryResult } from './types'

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

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
