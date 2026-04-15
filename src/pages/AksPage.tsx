/**
 * AksPage — AKS on Azure Local multi-cluster planning.
 * Supports add/remove cluster cards (same pattern as AVD host pools).
 * Resiliency and data services removed — handled per-volume on Volumes page
 * and via Arc service presets in Workload Planner respectively.
 */
import { useEffect, useState } from 'react'
import { useSurveyorStore } from '../state/store'
import { computeAks } from '../engine/aks'
import type { AksCluster } from '../engine/types'

const SIZING_NOTES = [
  'Control plane nodes use fixed specs: 4 vCPUs / 16 GB RAM each (Microsoft AKS Arc standard).',
  'HA control plane requires 3 nodes; dev/single-point-of-failure clusters may use 1.',
  'Worker node vCPU and memory depends on your containerized workload requirements.',
  'OS disk default is 200 GB per node — increase if your images are large or need more ephemeral storage.',
  'Persistent volumes (PVCs) are backed by Storage Spaces Direct. Set resiliency per-volume on the Volumes page.',
  'Arc-enabled data services (SQL Managed Instance, IoT Operations, AI Foundry Local, etc.) are added as service presets in the Workload Planner — not sized here.',
  'AKS Arc on Azure Local requires Azure Arc connectivity and a registered Azure Local cluster.',
]

function createDefaultCluster(index: number): AksCluster {
  return {
    id: `cluster-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `Cluster ${index}`,
    controlPlaneNodesPerCluster: 1,
    workerNodesPerCluster: 3,
    vCpusPerWorker: 4,
    memoryPerWorkerGB: 16,
    osDiskPerNodeGB: 200,
    persistentVolumesTB: 0,
  }
}

function round2(n: number) { return Math.round(n * 100) / 100 }

export default function AksPage() {
  const { aks, setAks } = useSurveyorStore()
  const result = computeAks(aks)
  const [selectedId, setSelectedId] = useState<string>(aks.clusters[0]?.id ?? '')

  const selected = aks.clusters.find((c) => c.id === selectedId) ?? aks.clusters[0]

  useEffect(() => {
    if (!selected && aks.clusters[0]) setSelectedId(aks.clusters[0].id)
  }, [selected, aks.clusters])

  function updateSelected(updates: Partial<AksCluster>) {
    if (!selected) return
    setAks({ clusters: aks.clusters.map((c) => c.id === selected.id ? { ...c, ...updates } : c) })
  }

  function addCluster() {
    const next = createDefaultCluster(aks.clusters.length + 1)
    setAks({ clusters: [...aks.clusters, next] })
    setSelectedId(next.id)
  }

  function removeSelected() {
    if (!selected || aks.clusters.length === 1) return
    const remaining = aks.clusters.filter((c) => c.id !== selected.id)
    setAks({ clusters: remaining })
    setSelectedId(remaining[0]?.id ?? '')
  }

  if (!selected) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AKS on Azure Local</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kubernetes cluster sizing for AKS enabled by Azure Arc on Azure Local.
          Add one or more clusters — each gets its own node configuration and PVC allocation.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Arc-enabled data services (SQL Managed Instance, IoT Operations, AI Foundry Local, etc.)
          are added separately as service presets in the Workload Planner.
        </p>
      </div>

      {/* ── Cluster cards ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between gap-4 bg-gray-50 dark:bg-gray-800 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">AKS Clusters</div>
            <div className="text-xs text-gray-500">Each cluster is independently sized. Totals are aggregated below.</div>
          </div>
          <button
            onClick={addCluster}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-brand-600 hover:bg-brand-700 text-white transition-colors"
          >
            Add cluster
          </button>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {aks.clusters.map((cluster) => {
            const totalNodes = cluster.controlPlaneNodesPerCluster + cluster.workerNodesPerCluster
            const osTB = round2((totalNodes * cluster.osDiskPerNodeGB) / 1024)
            const active = cluster.id === selected.id
            return (
              <button
                key={cluster.id}
                onClick={() => setSelectedId(cluster.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${active
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm">{cluster.name}</div>
                  <span className="text-[11px] uppercase tracking-wide text-gray-500">
                    {cluster.controlPlaneNodesPerCluster === 1 ? 'Dev' : 'HA'}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <div>{cluster.controlPlaneNodesPerCluster} CP + {cluster.workerNodesPerCluster} workers ({totalNodes} nodes)</div>
                  <div>{cluster.workerNodesPerCluster * cluster.vCpusPerWorker} worker vCPUs · {cluster.workerNodesPerCluster * cluster.memoryPerWorkerGB} GB RAM</div>
                  <div>{osTB} TB OS{cluster.persistentVolumesTB > 0 ? ` · ${cluster.persistentVolumesTB} TB PVC` : ''}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Cluster editor ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Editing: {selected.name}</h3>
          <p className="text-xs text-gray-500">Configure this cluster's node specs and storage.</p>
        </div>
        {aks.clusters.length > 1 && (
          <button
            onClick={removeSelected}
            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20 transition-colors"
          >
            Remove cluster
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Cluster name">
          <input type="text" className="input" value={selected.name}
            onChange={(e) => updateSelected({ name: e.target.value })} />
        </Field>

        <Field label="Control plane nodes" hint="1=dev, 3=HA">
          <select className="input" value={selected.controlPlaneNodesPerCluster}
            onChange={(e) => updateSelected({ controlPlaneNodesPerCluster: +e.target.value as 1 | 3 })}>
            <option value={1}>1 node (dev / non-HA)</option>
            <option value={3}>3 nodes (HA)</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">Fixed specs: 4 vCPUs / 16 GB RAM per control plane node.</p>
        </Field>

        <Field label="Worker nodes / cluster">
          <input type="number" min={1} className="input" value={selected.workerNodesPerCluster}
            onChange={(e) => updateSelected({ workerNodesPerCluster: Math.max(1, +e.target.value) })} />
        </Field>

        <Field label="vCPUs / worker node">
          <input type="number" min={1} className="input" value={selected.vCpusPerWorker}
            onChange={(e) => updateSelected({ vCpusPerWorker: Math.max(1, +e.target.value) })} />
        </Field>

        <Field label="RAM / worker node (GB)">
          <input type="number" min={1} className="input" value={selected.memoryPerWorkerGB}
            onChange={(e) => updateSelected({ memoryPerWorkerGB: Math.max(1, +e.target.value) })} />
        </Field>

        <Field label="OS disk / node (GB)" hint="default 200">
          <input type="number" min={10} className="input" value={selected.osDiskPerNodeGB}
            onChange={(e) => updateSelected({ osDiskPerNodeGB: Math.max(10, +e.target.value) })} />
        </Field>

        <Field label="Persistent volumes (TB)" hint="PVC storage for this cluster">
          <input type="number" min={0} step={0.1} className="input" value={selected.persistentVolumesTB}
            onChange={(e) => updateSelected({ persistentVolumesTB: Math.max(0, +e.target.value) })} />
          <p className="text-xs text-gray-400 mt-1">Resiliency is set per-volume on the Volumes page.</p>
        </Field>
      </div>

      {/* ── Aggregate results ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">
          AKS Sizing Results — {aks.clusters.length} cluster{aks.clusters.length !== 1 ? 's' : ''}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-800/30 text-left border-t border-gray-100 dark:border-gray-800">
              <th className="px-4 py-2 text-xs font-semibold text-gray-500">Component</th>
              <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">Nodes</th>
              <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">vCPUs</th>
              <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">RAM (GB)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Control plane (all clusters)</td>
              <td className="px-4 py-2 text-right">{aks.clusters.reduce((s, c) => s + c.controlPlaneNodesPerCluster, 0)}</td>
              <td className="px-4 py-2 text-right">{result.totalControlPlaneVCpus}</td>
              <td className="px-4 py-2 text-right">{result.totalControlPlaneMemoryGB}</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Worker nodes (all clusters)</td>
              <td className="px-4 py-2 text-right">{aks.clusters.reduce((s, c) => s + c.workerNodesPerCluster, 0)}</td>
              <td className="px-4 py-2 text-right">{result.totalWorkerVCpus}</td>
              <td className="px-4 py-2 text-right">{result.totalWorkerMemoryGB}</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-800 bg-brand-50 dark:bg-brand-900/20 font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right">{result.totalNodes}</td>
              <td className="px-4 py-2 text-right">{result.totalVCpus}</td>
              <td className="px-4 py-2 text-right">{result.totalMemoryGB}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Storage breakdown ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Storage Breakdown</div>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">OS disks ({result.totalNodes} nodes)</td>
              <td className="px-4 py-2 text-right">{result.osDiskTB} TB</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                Persistent volumes (PVCs)
                <div className="text-xs text-gray-400">Resiliency set per-volume on the Volumes page</div>
              </td>
              <td className="px-4 py-2 text-right">{aks.clusters.reduce((s, c) => s + c.persistentVolumesTB, 0)} TB</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-800 bg-brand-50 dark:bg-brand-900/20 font-semibold">
              <td className="px-4 py-2">Total logical storage</td>
              <td className="px-4 py-2 text-right">{result.totalStorageTB} TB</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Per-cluster breakdown (multi-cluster only) ── */}
      {aks.clusters.length > 1 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Per-Cluster Breakdown</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/30 text-left border-t border-gray-100 dark:border-gray-800">
                <th className="px-4 py-2 text-xs font-semibold text-gray-500">Cluster</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">CP nodes</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">Workers</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">vCPUs</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">RAM (GB)</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">OS (TB)</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">PVC (TB)</th>
              </tr>
            </thead>
            <tbody>
              {aks.clusters.map((cluster) => {
                const totalNodes = cluster.controlPlaneNodesPerCluster + cluster.workerNodesPerCluster
                const cpVCpus = cluster.controlPlaneNodesPerCluster * 4
                const wkVCpus = cluster.workerNodesPerCluster * cluster.vCpusPerWorker
                const cpRAM = cluster.controlPlaneNodesPerCluster * 16
                const wkRAM = cluster.workerNodesPerCluster * cluster.memoryPerWorkerGB
                const osTB = round2((totalNodes * cluster.osDiskPerNodeGB) / 1024)
                return (
                  <tr key={cluster.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2">
                      <div className="font-medium">{cluster.name}</div>
                      <div className="text-xs text-gray-400">{cluster.controlPlaneNodesPerCluster === 1 ? 'Dev' : 'HA'} control plane</div>
                    </td>
                    <td className="px-4 py-2 text-right">{cluster.controlPlaneNodesPerCluster}</td>
                    <td className="px-4 py-2 text-right">{cluster.workerNodesPerCluster}</td>
                    <td className="px-4 py-2 text-right">{cpVCpus + wkVCpus}</td>
                    <td className="px-4 py-2 text-right">{cpRAM + wkRAM}</td>
                    <td className="px-4 py-2 text-right">{osTB}</td>
                    <td className="px-4 py-2 text-right">{cluster.persistentVolumesTB}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Sizing notes ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">AKS Sizing Notes</p>
        <ul className="space-y-2">
          {SIZING_NOTES.map((note, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="text-gray-400 shrink-0">•</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
        {hint && <span className="ml-1 text-xs text-gray-400">({hint})</span>}
      </label>
      {children}
    </div>
  )
}
