import type { AksInputs, AksResult } from './types'

/**
 * AKS on Azure Local sizing.
 *
 * Mirrors the "AKS" scenario section of the Workload Planner sheet.
 *
 * Control plane node specs (Microsoft standard):
 *   - 4 vCPUs, 16 GB RAM per control plane node
 *   - 200 GB OS disk per node (default, configurable)
 *
 * Worker node specs are user-defined.
 */

const CONTROL_PLANE_VCPUS_PER_NODE = 4
const CONTROL_PLANE_MEMORY_GB_PER_NODE = 16

export function computeAks(inputs: AksInputs): AksResult {
  let totalControlPlaneNodes = 0
  let totalWorkerNodes = 0
  let totalControlPlaneVCpus = 0
  let totalWorkerVCpus = 0
  let totalControlPlaneMemoryGB = 0
  let totalWorkerMemoryGB = 0
  let osDiskTB = 0
  let totalPvcTB = 0

  for (const cluster of inputs.clusters) {
    const cpNodes = cluster.controlPlaneNodesPerCluster
    const wkNodes = cluster.workerNodesPerCluster
    const totalClusterNodes = cpNodes + wkNodes

    totalControlPlaneNodes += cpNodes
    totalWorkerNodes += wkNodes
    totalControlPlaneVCpus += cpNodes * CONTROL_PLANE_VCPUS_PER_NODE
    totalWorkerVCpus += wkNodes * cluster.vCpusPerWorker
    totalControlPlaneMemoryGB += cpNodes * CONTROL_PLANE_MEMORY_GB_PER_NODE
    totalWorkerMemoryGB += wkNodes * cluster.memoryPerWorkerGB
    osDiskTB += (totalClusterNodes * cluster.osDiskPerNodeGB) / 1024
    totalPvcTB += cluster.persistentVolumesTB
  }

  const totalNodes = totalControlPlaneNodes + totalWorkerNodes
  const totalVCpus = totalControlPlaneVCpus + totalWorkerVCpus
  const totalMemoryGB = totalControlPlaneMemoryGB + totalWorkerMemoryGB
  osDiskTB = round2(osDiskTB)
  const totalStorageTB = round2(osDiskTB + totalPvcTB)

  return {
    totalNodes,
    totalControlPlaneVCpus,
    totalWorkerVCpus,
    totalVCpus,
    totalControlPlaneMemoryGB,
    totalWorkerMemoryGB,
    totalMemoryGB,
    osDiskTB,
    totalStorageTB,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
