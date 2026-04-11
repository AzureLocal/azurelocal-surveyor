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

  // N+1 failover: capacity with one node down
  const rawVCpusN1 = logicalCoresPerNode * (nodeCount - 1) * vCpuOversubscriptionRatio
  const systemReservedN1 = systemReservedVCpus * (nodeCount - 1)
  const usableVCpusN1 = Math.max(0, rawVCpusN1 - systemReservedN1)

  // Memory
  const physicalMemoryGB = memoryPerNodeGB * nodeCount
  const systemReservedMemoryGBTotal = systemReservedMemoryGB * nodeCount
  const usableMemoryGB = Math.max(0, physicalMemoryGB - systemReservedMemoryGBTotal)

  // N+1 memory
  const physicalMemoryN1 = memoryPerNodeGB * (nodeCount - 1)
  const systemReservedMemoryN1 = systemReservedMemoryGB * (nodeCount - 1)
  const usableMemoryGBN1 = Math.max(0, physicalMemoryN1 - systemReservedMemoryN1)

  // NUMA — modern Intel/AMD server CPUs typically have 2 NUMA domains per node
  const numaDomainsEstimate = nodeCount * 2

  return {
    nodeCount,
    physicalCores,
    logicalCores,
    logicalCoresPerNode,
    hyperthreadingEnabled,
    systemReservedVCpus: systemReservedVCpusTotal,
    usableVCpus,
    usableVCpusN1,
    usableMemoryGBN1,
    physicalMemoryGB,
    systemReservedMemoryGB: systemReservedMemoryGBTotal,
    usableMemoryGB,
    numaDomainsEstimate,
  }
}
