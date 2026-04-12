/**
 * AksPage — dedicated AKS on Azure Local planning page (#17).
 * Shows detailed AKS cluster sizing with node breakdown and deployment notes.
 */
import { useSurveyorStore } from '../state/store'
import { computeAks } from '../engine/aks'
import type { ResiliencyType } from '../engine/types'

const RESILIENCY_LABELS: Record<ResiliencyType, string> = {
  'two-way-mirror':   'Two-Way Mirror (50%)',
  'three-way-mirror': 'Three-Way Mirror (33%)',
  'dual-parity':      'Dual Parity',
  'nested-two-way':   'Nested Two-Way (25%)',
}

const SIZING_NOTES = [
  'Control plane nodes use fixed specs: 4 vCPUs / 16 GB RAM each (Microsoft AKS Arc standard).',
  'HA control plane requires 3 nodes; dev/single-point-of-failure clusters may use 1.',
  'Worker node vCPU and memory depends on your containerized workload requirements.',
  'OS disk default is 200 GB per node — increase if your images are large or if you need more ephemeral storage.',
  'Persistent volumes (PVCs) are backed by S2D — use Three-Way Mirror for production stateful workloads.',
  'Data services (Arc-enabled SQL MI, PostgreSQL, etc.) have additional overhead — add 20–30% headroom.',
  'AKS Arc on Azure Local requires Azure Arc connectivity and a registered Azure Local cluster.',
]

export default function AksPage() {
  const { aks, setAks } = useSurveyorStore()
  const result = computeAks(aks)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AKS on Azure Local</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kubernetes cluster sizing for AKS enabled by Azure Arc on Azure Local.
          Configure cluster count, control plane, worker nodes, and storage requirements.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          This page sizes the base AKS infrastructure. Arc-enabled service workloads (SQL Managed Instance,
          IoT Operations, AI Foundry Local, etc.) are added separately as service presets in the Workload Planner.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Cluster count">
          <input type="number" min={1} className="input" value={aks.clusterCount}
            onChange={(e) => setAks({ clusterCount: +e.target.value })} />
        </Field>

        <Field label="Control plane nodes / cluster" hint="1=dev, 3=HA">
          <select className="input" value={aks.controlPlaneNodesPerCluster}
            onChange={(e) => setAks({ controlPlaneNodesPerCluster: +e.target.value })}>
            <option value={1}>1 node (dev / non-HA)</option>
            <option value={3}>3 nodes (HA)</option>
          </select>
        </Field>

        <Field label="Worker nodes / cluster">
          <input type="number" min={1} className="input" value={aks.workerNodesPerCluster}
            onChange={(e) => setAks({ workerNodesPerCluster: +e.target.value })} />
        </Field>

        <Field label="vCPUs / worker node">
          <input type="number" min={1} className="input" value={aks.vCpusPerWorker}
            onChange={(e) => setAks({ vCpusPerWorker: +e.target.value })} />
        </Field>

        <Field label="RAM / worker node (GB)">
          <input type="number" min={1} className="input" value={aks.memoryPerWorkerGB}
            onChange={(e) => setAks({ memoryPerWorkerGB: +e.target.value })} />
        </Field>

        <Field label="OS disk / node (GB)" hint="default 200">
          <input type="number" min={100} className="input" value={aks.osDiskPerNodeGB}
            onChange={(e) => setAks({ osDiskPerNodeGB: +e.target.value })} />
        </Field>

        <Field label="Persistent volumes (TB)" hint="PVCs across all clusters">
          <input type="number" min={0} step={0.1} className="input" value={aks.persistentVolumesTB}
            onChange={(e) => setAks({ persistentVolumesTB: +e.target.value })} />
        </Field>

        <Field label="Data services (TB)" hint="Arc SQL, PostgreSQL, etc.">
          <input type="number" min={0} step={0.1} className="input" value={aks.dataServicesTB}
            onChange={(e) => setAks({ dataServicesTB: +e.target.value })} />
        </Field>

        <Field label="Workload volume resiliency" hint="applies to PVC and data service volume suggestions" className="col-span-2">
          <select className="input" value={aks.resiliency}
            onChange={(e) => setAks({ resiliency: e.target.value as ResiliencyType })}>
            {Object.entries(RESILIENCY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Node OS disks always use Three-Way Mirror. This setting controls the resiliency of the
            AKS-PersistentVolumes volume suggestion generated in Volume Detail.
          </p>
        </Field>
      </div>

      {/* Results — node breakdown */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">AKS Sizing Results</div>
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
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                Control plane ({aks.controlPlaneNodesPerCluster === 1 ? 'dev' : 'HA'}) × {aks.clusterCount} cluster{aks.clusterCount !== 1 ? 's' : ''}
              </td>
              <td className="px-4 py-2 text-right">{aks.clusterCount * aks.controlPlaneNodesPerCluster}</td>
              <td className="px-4 py-2 text-right">{result.totalControlPlaneVCpus}</td>
              <td className="px-4 py-2 text-right">{result.totalControlPlaneMemoryGB}</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                Worker nodes × {aks.clusterCount} cluster{aks.clusterCount !== 1 ? 's' : ''}
              </td>
              <td className="px-4 py-2 text-right">{aks.clusterCount * aks.workerNodesPerCluster}</td>
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

      {/* Storage breakdown */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Storage Breakdown</div>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">OS disk ({result.totalNodes} nodes × {aks.osDiskPerNodeGB} GB)</td>
              <td className="px-4 py-2 text-right">{result.osDiskTB} TB</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Persistent volumes (PVCs)</td>
              <td className="px-4 py-2 text-right">{aks.persistentVolumesTB} TB</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Data services</td>
              <td className="px-4 py-2 text-right">{aks.dataServicesTB} TB</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-800 bg-brand-50 dark:bg-brand-900/20 font-semibold">
              <td className="px-4 py-2">
                Total logical storage
                <div className="text-xs text-gray-400 font-normal">
                  OS disks → Three-Way Mirror · PVCs + data services → {RESILIENCY_LABELS[aks.resiliency]}
                </div>
              </td>
              <td className="px-4 py-2 text-right align-top">{result.totalStorageTB} TB</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sizing notes */}
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

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-1">
        {label}
        {hint && <span className="ml-1 text-xs text-gray-400">({hint})</span>}
      </label>
      {children}
    </div>
  )
}
