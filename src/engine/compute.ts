import type { HardwareInputs, AdvancedSettings, ComputeResult } from './types'

/**
 * Compute CPU and memory capacity for the cluster.
 *
 * Data flow mirrors the "Compute Report" sheet:
 *   Hardware Inputs → physicalCores → hyperthreading → logicalCores
 *   → (minus systemReserved) → usableVCpus
 *   Hardware Inputs → physicalMemory → (minus systemReserved) → usableMemory
 *
 * Hyperthreading: when enabled, logical vCPUs = physical cores × 2.
 * The oversubscription ratio is applied to LOGICAL cores.
 */
export function computeCompute(
  inputs: HardwareInputs,
  settings: AdvancedSettings
): ComputeResult {
  const { nodeCount, coresPerNode, memoryPerNodeGB, hyperthreadingEnabled } = inputs
  const { vCpuOversubscriptionRatio, systemReservedVCpus, systemReservedMemoryGB } = settings

  // CPU — hyperthreading doubles logical core count
  const physicalCores = coresPerNode * nodeCount
  const logicalCoresPerNode = hyperthreadingEnabled ? coresPerNode * 2 : coresPerNode
  const logicalCores = logicalCoresPerNode * nodeCount

  const systemReservedVCpusTotal = systemReservedVCpus * nodeCount
  // Usable vCPUs = (logical cores × oversubscription ratio) - reserved
  const rawVCpus = logicalCores * vCpuOversubscriptionRatio
  const usableVCpus = Math.max(0, rawVCpus - systemReservedVCpusTotal)

  // Memory
  const physicalMemoryGB = memoryPerNodeGB * nodeCount
  const systemReservedMemoryGBTotal = systemReservedMemoryGB * nodeCount
  const usableMemoryGB = Math.max(0, physicalMemoryGB - systemReservedMemoryGBTotal)

  // NUMA — modern Intel/AMD server CPUs typically have 2 NUMA domains per node
  const numaDomainsEstimate = nodeCount * 2

  return {
    physicalCores,
    logicalCores,
    hyperthreadingEnabled,
    systemReservedVCpus: systemReservedVCpusTotal,
    usableVCpus,
    physicalMemoryGB,
    systemReservedMemoryGB: systemReservedMemoryGBTotal,
    usableMemoryGB,
    numaDomainsEstimate,
  }
}
