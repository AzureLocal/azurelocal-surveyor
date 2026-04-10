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
  const {
    clusterCount,
    controlPlaneNodesPerCluster,
    workerNodesPerCluster,
    vCpusPerWorker,
    memoryPerWorkerGB,
    osDiskPerNodeGB,
    persistentVolumesTB,
    dataServicesTB,
  } = inputs

  const totalControlPlaneNodes = clusterCount * controlPlaneNodesPerCluster
  const totalWorkerNodes = clusterCount * workerNodesPerCluster
  const totalNodes = totalControlPlaneNodes + totalWorkerNodes

  const totalControlPlaneVCpus = totalControlPlaneNodes * CONTROL_PLANE_VCPUS_PER_NODE
  const totalWorkerVCpus = totalWorkerNodes * vCpusPerWorker
  const totalVCpus = totalControlPlaneVCpus + totalWorkerVCpus

  const totalControlPlaneMemoryGB = totalControlPlaneNodes * CONTROL_PLANE_MEMORY_GB_PER_NODE
  const totalWorkerMemoryGB = totalWorkerNodes * memoryPerWorkerGB
  const totalMemoryGB = totalControlPlaneMemoryGB + totalWorkerMemoryGB

  const osDiskTB = round2((totalNodes * osDiskPerNodeGB) / 1024)
  const totalStorageTB = round2(osDiskTB + persistentVolumesTB + dataServicesTB)

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
