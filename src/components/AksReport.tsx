/**
 * AksReport — dedicated AKS solution summary for the Reports tab.
 * Shown only when AKS is enabled (Phase 13A).
 * Per-cluster breakdown: control plane, worker nodes, vCPU, memory, PVC storage.
 */
import { useSurveyorStore } from '../state/store'
import type { AksCluster } from '../engine/types'

const CONTROL_PLANE_VCPUS_PER_NODE = 4
const CONTROL_PLANE_MEMORY_GB_PER_NODE = 16

function Row({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <tr className={`border-t border-gray-100 dark:border-gray-800 ${highlight ? 'bg-brand-50 dark:bg-brand-900/20 font-semibold' : ''}`}>
      <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm">
        {label}
        {sub && <div className="text-xs text-gray-400 font-normal">{sub}</div>}
      </td>
      <td className="px-4 py-2 text-right text-sm">{value}</td>
    </tr>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold">{title}</div>
      {children}
    </div>
  )
}

function ClusterCard({ cluster }: { cluster: AksCluster }) {
  const cpVCpus  = cluster.controlPlaneNodesPerCluster * CONTROL_PLANE_VCPUS_PER_NODE
  const cpMemGB  = cluster.controlPlaneNodesPerCluster * CONTROL_PLANE_MEMORY_GB_PER_NODE
  const wkVCpus  = cluster.workerNodesPerCluster * cluster.vCpusPerWorker
  const wkMemGB  = cluster.workerNodesPerCluster * cluster.memoryPerWorkerGB
  const totalNodes = cluster.controlPlaneNodesPerCluster + cluster.workerNodesPerCluster
  const osDiskTB = Math.round((totalNodes * cluster.osDiskPerNodeGB) / 1024 * 100) / 100

  return (
    <Section title={`Cluster: ${cluster.name}`}>
      <table className="w-full">
        <tbody>
          <Row label="Control plane nodes" value={String(cluster.controlPlaneNodesPerCluster)}
            sub={cluster.controlPlaneNodesPerCluster === 1 ? 'Single node (dev/test)' : 'HA — 3 nodes'} />
          <Row label="Control plane: vCPUs" value={`${cpVCpus} (${CONTROL_PLANE_VCPUS_PER_NODE}/node)`} />
          <Row label="Control plane: RAM" value={`${cpMemGB} GB (${CONTROL_PLANE_MEMORY_GB_PER_NODE} GB/node)`} />
          <Row label="Worker nodes" value={String(cluster.workerNodesPerCluster)} />
          <Row label="Worker node spec" value={`${cluster.vCpusPerWorker} vCPU / ${cluster.memoryPerWorkerGB} GB RAM`} />
          <Row label="Worker pool: vCPUs" value={String(wkVCpus)} />
          <Row label="Worker pool: RAM" value={`${wkMemGB} GB`} />
          <Row label="Total vCPUs (cluster)" value={String(cpVCpus + wkVCpus)} highlight />
          <Row label="Total RAM (cluster)" value={`${cpMemGB + wkMemGB} GB`} highlight />
          <Row label="OS disk per node" value={`${cluster.osDiskPerNodeGB} GB`} />
          <Row label="OS disk (all nodes)" value={`${osDiskTB} TB`} />
          {cluster.persistentVolumesTB > 0 && (
            <Row label="Persistent volumes (PVC)" value={`${cluster.persistentVolumesTB} TB`}
              sub="PVC storage allocated for this cluster (includes Arc service preset storage)" />
          )}
          <Row label="Total storage (cluster)" value={`${Math.round((osDiskTB + cluster.persistentVolumesTB) * 100) / 100} TB`} highlight />
        </tbody>
      </table>
    </Section>
  )
}

export default function AksReport() {
  const state = useSurveyorStore()
  const { clusters } = state.aks

  // Compute totals
  let totalNodes = 0, totalVCpus = 0, totalMemGB = 0, totalOsTB = 0, totalPvcTB = 0
  for (const c of clusters) {
    const cpNodes = c.controlPlaneNodesPerCluster
    const allNodes = cpNodes + c.workerNodesPerCluster
    totalNodes   += allNodes
    totalVCpus   += cpNodes * CONTROL_PLANE_VCPUS_PER_NODE + c.workerNodesPerCluster * c.vCpusPerWorker
    totalMemGB   += cpNodes * CONTROL_PLANE_MEMORY_GB_PER_NODE + c.workerNodesPerCluster * c.memoryPerWorkerGB
    totalOsTB    += (allNodes * c.osDiskPerNodeGB) / 1024
    totalPvcTB   += c.persistentVolumesTB
  }
  const totalStorageTB = Math.round((totalOsTB + totalPvcTB) * 100) / 100

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">AKS Report</h2>
        <p className="text-sm text-gray-500 mt-1">
          Per-cluster breakdown of control plane and worker node resources, PVC storage, and total compute for AKS on Azure Local.
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold">AKS Summary</div>
        <table className="w-full">
          <tbody>
            <Row label="Clusters" value={String(clusters.length)} />
            <Row label="Total nodes" value={String(totalNodes)} />
            <Row label="Total vCPUs" value={String(totalVCpus)} highlight />
            <Row label="Total RAM" value={`${totalMemGB} GB`} highlight />
            <Row label="Total storage" value={`${totalStorageTB} TB`}
              sub="OS disks + persistent volumes across all clusters" />
          </tbody>
        </table>
      </div>

      {/* Per-cluster breakdown */}
      {clusters.map((cluster) => (
        <ClusterCard key={cluster.id} cluster={cluster} />
      ))}
    </div>
  )
}
