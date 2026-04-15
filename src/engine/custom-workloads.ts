import type { CustomWorkload } from './types'

function computeTotals(workload: CustomWorkload) {
  const totalVCpus = workload.vmCount * workload.vCpusPerVm
  const totalMemGB = workload.vmCount * workload.memoryPerVmGB
  const osDiskTB = (workload.vmCount * workload.osDiskPerVmGB) / 1024
  // Apply internal mirror factor: data storage footprint = logical × mirror
  const storageTB = workload.storageTB * (workload.internalMirrorFactor ?? 1)
  const totalStorageTB = osDiskTB + storageTB

  return { totalVCpus, totalMemGB, osDiskTB, storageTB, totalStorageTB }
}

export function computeAllCustomWorkloads(workloads: CustomWorkload[]) {
  let totalVCpus = 0
  let totalMemoryGB = 0
  let totalStorageTB = 0

  for (const workload of workloads) {
    if (!workload.enabled) continue

    const totals = computeTotals(workload)
    totalVCpus += totals.totalVCpus
    totalMemoryGB += totals.totalMemGB
    totalStorageTB += totals.totalStorageTB
  }

  return {
    totalVCpus,
    totalMemoryGB,
    totalStorageTB: Math.round(totalStorageTB * 100) / 100,
  }
}