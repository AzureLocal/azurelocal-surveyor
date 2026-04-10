import type { HardwareInputs, AdvancedSettings, ComputeResult } from './types'

/**
 * Compute CPU and memory capacity for the cluster.
 *
 * Data flow mirrors the "Compute Report" sheet (98 formulas):
 *   Hardware Inputs → physicalCores → (minus systemReserved) → usableVCpus
 *   Hardware Inputs → physicalMemory → (minus systemReserved) → usableMemory
 */
export function computeCompute(
  inputs: HardwareInputs,
  settings: AdvancedSettings
): ComputeResult {
  // CPU
  const physicalCores = inputs.coresPerNode * inputs.nodeCount
  const systemReservedVCpus = settings.systemReservedVCpus * inputs.nodeCount
  // Usable vCPUs = (physical cores × oversubscription ratio) - reserved
  const rawVCpus = physicalCores * settings.vCpuOversubscriptionRatio
  const usableVCpus = Math.max(0, rawVCpus - systemReservedVCpus)

  // Memory
  const physicalMemoryGB = inputs.memoryPerNodeGB * inputs.nodeCount
  const systemReservedMemoryGB = settings.systemReservedMemoryGB * inputs.nodeCount
  const usableMemoryGB = Math.max(0, physicalMemoryGB - systemReservedMemoryGB)

  // NUMA — rough estimate: modern Intel/AMD server CPUs typically have 2 NUMA domains per node
  // Azure Local does not officially expose NUMA count via a formula; we estimate for planning.
  const numaDomainsEstimate = inputs.nodeCount * 2

  return {
    physicalCores,
    systemReservedVCpus,
    usableVCpus,
    physicalMemoryGB,
    systemReservedMemoryGB,
    usableMemoryGB,
    numaDomainsEstimate,
  }
}
