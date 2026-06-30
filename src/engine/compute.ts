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
  const nodeCount    = Math.max(1, isFinite(inputs.nodeCount) ? inputs.nodeCount : 1)
  const coresPerNode = Math.max(1, isFinite(inputs.coresPerNode) ? inputs.coresPerNode : 1)
  const memoryPerNodeGB = Math.max(0, isFinite(inputs.memoryPerNodeGB) ? inputs.memoryPerNodeGB : 0)
  const { hyperthreadingEnabled } = inputs
  const { vCpuOversubscriptionRatio, systemReservedVCpus, systemReservedMemoryGB } = settings

  // CPU — hyperthreading doubles logical core count
  const physicalCores = coresPerNode * nodeCount
  const logicalCoresPerNode = hyperthreadingEnabled ? coresPerNode * 2 : coresPerNode
  const logicalCores = logicalCoresPerNode * nodeCount

  const systemReservedVCpusTotal = systemReservedVCpus * nodeCount
  // Usable vCPUs = (logical cores × oversubscription ratio) - reserved
  const rawVCpus = logicalCores * vCpuOversubscriptionRatio
  const usableVCpus = Math.max(0, rawVCpus - systemReservedVCpusTotal)

  // N+1 failover: capacity with one node down (WAF compute resiliency — node drain / failure)
  const nodesN1 = Math.max(0, nodeCount - 1)
  const rawVCpusN1 = logicalCoresPerNode * nodesN1 * vCpuOversubscriptionRatio
  const systemReservedN1 = systemReservedVCpus * nodesN1
  const usableVCpusN1 = Math.max(0, rawVCpusN1 - systemReservedN1)

  // N+2 failover: capacity with two nodes down (WAF compute resiliency — two-node drain)
  const nodesN2 = Math.max(0, nodeCount - 2)
  const rawVCpusN2 = logicalCoresPerNode * nodesN2 * vCpuOversubscriptionRatio
  const systemReservedN2 = systemReservedVCpus * nodesN2
  const usableVCpusN2 = Math.max(0, rawVCpusN2 - systemReservedN2)

  // Memory
  const physicalMemoryGB = memoryPerNodeGB * nodeCount
  const systemReservedMemoryGBTotal = systemReservedMemoryGB * nodeCount
  const usableMemoryGB = Math.max(0, physicalMemoryGB - systemReservedMemoryGBTotal)

  // N+1 memory
  const physicalMemoryN1 = memoryPerNodeGB * nodesN1
  const systemReservedMemoryN1 = systemReservedMemoryGB * nodesN1
  const usableMemoryGBN1 = Math.max(0, physicalMemoryN1 - systemReservedMemoryN1)

  // N+2 memory
  const physicalMemoryN2 = memoryPerNodeGB * nodesN2
  const systemReservedMemoryN2 = systemReservedMemoryGB * nodesN2
  const usableMemoryGBN2 = Math.max(0, physicalMemoryN2 - systemReservedMemoryN2)

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
    usableVCpusN2,
    usableMemoryGBN1,
    usableMemoryGBN2,
    physicalMemoryGB,
    systemReservedMemoryGB: systemReservedMemoryGBTotal,
    usableMemoryGB,
    numaDomainsEstimate,
  }
}
