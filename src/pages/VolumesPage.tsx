import { useState } from 'react'
import { ChevronDown, ChevronRight, Wand2, PlusCircle, CheckCircle2 } from 'lucide-react'
import VolumeTable from '../components/VolumeTable'
import HealthCheck from '../components/HealthCheck'
import { useSurveyorStore } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { computeCompute } from '../engine/compute'
import { computeAvd } from '../engine/avd'
import { computeSofs } from '../engine/sofs'
import { computeAks } from '../engine/aks'
import { computeMabs } from '../engine/mabs'
import { runHealthCheck } from '../engine/healthcheck'
import { generateWorkloadVolumes, type SuggestedVolume } from '../engine/workload-volumes'
import { toWacSize } from '../engine/volumes'

export default function VolumesPage() {
  const state = useSurveyorStore()
  const { hardware, advanced, volumes } = state
  const capacity = computeCapacity(hardware, advanced)
  const compute  = computeCompute(hardware, advanced)
  const avd      = computeAvd(state.avd, state.advanced.overrides)
  const sofs     = computeSofs(state.sofs, state.advanced.overrides)
  const aks      = computeAks(state.aks)
  const mabsResult = computeMabs(state.mabs)

  // Aggregate workload demand from all enabled scenarios for accurate health checks
  let totalVCpus = 0, totalMemoryGB = 0, totalStorageTB = 0
  if (state.avdEnabled)  { totalVCpus += avd.totalVCpus;  totalMemoryGB += avd.totalMemoryGB;  totalStorageTB += avd.totalStorageTB }
  if (state.aks.enabled) { totalVCpus += aks.totalVCpus;  totalMemoryGB += aks.totalMemoryGB;  totalStorageTB += aks.totalStorageTB }
  if (state.virtualMachines?.enabled) {
    const vm = state.virtualMachines
    totalVCpus    += (vm.vmCount * vm.vCpusPerVm) / vm.vCpuOvercommitRatio
    totalMemoryGB += vm.vmCount * vm.memoryPerVmGB
    totalStorageTB += (vm.vmCount * vm.storagePerVmGB) / 1024
  }
  if (state.sofsEnabled) { totalVCpus += sofs.sofsVCpusTotal; totalMemoryGB += sofs.sofsMemoryTotalGB; totalStorageTB += sofs.totalStorageTB }
  if (state.mabsEnabled) { totalVCpus += mabsResult.mabsVCpus; totalMemoryGB += mabsResult.mabsMemoryGB; totalStorageTB += mabsResult.totalStorageTB + mabsResult.mabsOsDiskTB }

  const workloadSummary = {
    totalVCpus: Math.round(totalVCpus),
    totalMemoryGB: Math.round(totalMemoryGB),
    totalStorageTB: Math.round(totalStorageTB * 100) / 100,
  }

  const health = runHealthCheck({ hardware, settings: advanced, volumes, capacity, compute, workloadSummary })

  // #68: generate workload-based volume suggestions
  const suggestions = generateWorkloadVolumes({
    advanced,
    avdEnabled: state.avdEnabled,
    avdResult: avd,
    aksEnabled: state.aks.enabled,
    aksResult: aks,
    virtualMachines: state.virtualMachines,
    sofsEnabled: state.sofsEnabled,
    sofsInputs: state.sofs,
    sofsResult: sofs,
    mabsEnabled: state.mabsEnabled,
    mabsInputs: state.mabs,
    mabsResult: mabsResult,
  })

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Volume Detail</h1>
        <p className="text-sm text-gray-500 mt-1">
          Plan your Cluster Shared Volumes with per-volume resiliency and WAC-ready sizes.
          Ports the 95 formulas from the Volume Detail sheet.
        </p>
      </div>

      {/* #68: Workload-based volume suggestions */}
      {suggestions.length > 0 && (
        <WorkloadVolumeSuggestions suggestions={suggestions} />
      )}

      <VolumeTable />

      <HealthCheck result={health} />

      {/* #67: Microsoft Recommended Volumes */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Microsoft Recommended Volume Layout</h2>
        <RecommendedVolumes nodeCount={hardware.nodeCount} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Resiliency Reference Guide</h2>
        <ResiliencyGuide nodeCount={hardware.nodeCount} />
      </section>
    </div>
  )
}

// ─── Workload Volume Suggestions (#68) ───────────────────────────────────────

function WorkloadVolumeSuggestions({ suggestions }: { suggestions: SuggestedVolume[] }) {
  const { volumes, addVolume } = useSurveyorStore()
  const [added, setAdded] = useState<Set<string>>(new Set())

  // Check which suggestions already exist in the volume list (by name)
  const existingNames = new Set(volumes.map((v) => v.name))

  function handleAdd(s: SuggestedVolume) {
    if (existingNames.has(s.name) || added.has(s.id)) return
    addVolume({ id: s.id, name: s.name, plannedSizeTB: s.plannedSizeTB, resiliency: s.resiliency })
    setAdded((prev) => new Set(prev).add(s.id))
  }

  function handleAddAll() {
    for (const s of suggestions) {
      if (!existingNames.has(s.name) && !added.has(s.id)) {
        addVolume({ id: s.id, name: s.name, plannedSizeTB: s.plannedSizeTB, resiliency: s.resiliency })
        setAdded((prev) => { const next = new Set(prev); next.add(s.id); return next })
      }
    }
  }

  // Group by source
  const grouped = new Map<string, SuggestedVolume[]>()
  for (const s of suggestions) {
    const list = grouped.get(s.source) ?? []
    list.push(s)
    grouped.set(s.source, list)
  }

  const allAdded = suggestions.every((s) => existingNames.has(s.name) || added.has(s.id))

  return (
    <div className="rounded-lg border border-brand-200 dark:border-brand-800 overflow-hidden">
      <div className="flex items-center justify-between bg-brand-50 dark:bg-brand-900/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <span className="text-sm font-semibold">Suggested Volumes from Workloads</span>
          <span className="text-xs text-gray-500">{suggestions.length} volumes</span>
        </div>
        {!allAdded && (
          <button
            onClick={handleAddAll}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-xs font-medium"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add All
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {[...grouped.entries()].map(([source, items]) => (
          <div key={source}>
            <div className="px-4 py-1.5 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {source}
            </div>
            {items.map((s) => {
              const isAdded = existingNames.has(s.name) || added.has(s.id)
              const { wacSizeGB } = toWacSize(s.plannedSizeTB)
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-gray-500 truncate">{s.description}</div>
                  </div>
                  <div className="text-xs text-gray-500 shrink-0">{s.resiliency}</div>
                  <div className="text-sm font-mono text-right w-20 shrink-0">{s.plannedSizeTB} TiB</div>
                  <div className="text-xs font-mono text-gray-400 text-right w-20 shrink-0">{wacSizeGB} GiB</div>
                  <div className="w-20 shrink-0 text-right">
                    {isAdded ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Added
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(s)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-700 rounded hover:bg-brand-50 dark:hover:bg-brand-900/30"
                      >
                        <PlusCircle className="w-3 h-3" /> Add
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500">
        Generated from enabled workloads. SOFS and MABS volumes include internal mirror footprint.
        Review sizes and resiliency before adding.
      </div>
    </div>
  )
}

// ─── Microsoft Recommended Volume Layout (#67) ──────────────────────────────

const RECOMMENDED_VOLUMES = [
  {
    name: 'Infrastructure',
    resiliency: 'Three-Way Mirror',
    sizing: '~250 GB (created automatically)',
    purpose: 'Azure Local system CSV for cluster operations, health service, and Arc registration data.',
    notes: 'Created during cluster setup. Do not delete or resize.',
  },
  {
    name: 'VM OS / Boot',
    resiliency: 'Three-Way Mirror',
    sizing: 'VMs × OS disk size',
    purpose: 'Stores VM boot VHDXs. Mirror resiliency ensures VMs survive drive failures without latency impact.',
    notes: 'Parity causes high write latency on random I/O — never use for OS volumes.',
  },
  {
    name: 'VM Data / Workloads',
    resiliency: 'Three-Way Mirror or Dual Parity',
    sizing: 'Based on workload demand',
    purpose: 'Application data, databases, file shares. Mirror for IOPS-sensitive; parity for sequential/cold.',
    notes: 'Separate from OS volume so resiliency and sizing can be tuned independently.',
  },
  {
    name: 'Backup / Archive',
    resiliency: 'Dual Parity',
    sizing: 'Protected data × retention × change rate',
    purpose: 'MABS or third-party backup targets. Sequential writes — ideal for parity efficiency.',
    notes: 'Consider Azure offload for long-term retention beyond 14 days.',
  },
  {
    name: 'FSLogix Profiles',
    resiliency: 'Three-Way Mirror',
    sizing: 'Users × profile size × growth',
    purpose: 'FSLogix profile VHDXs for AVD or SOFS. Random I/O during logon storms requires mirror.',
    notes: 'If SOFS is used, profile VHDXs live inside the SOFS guest cluster, not directly on this volume.',
  },
  {
    name: 'Kubernetes PVC',
    resiliency: 'Three-Way Mirror',
    sizing: 'Based on persistent volume claims',
    purpose: 'AKS on Azure Local persistent storage. Container workloads need consistent low-latency I/O.',
    notes: 'AKS CSI driver creates sub-volumes automatically from this pool.',
  },
]

function RecommendedVolumes({ nodeCount }: { nodeCount: number }) {
  const [open, setOpen] = useState(true)
  const hasParity = nodeCount >= 4

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-semibold text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        Microsoft Recommended Volume Layout
        <span className="ml-2 text-xs font-normal text-gray-400">{RECOMMENDED_VOLUMES.length} volumes</span>
      </button>
      {open && (
        <>
          <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800">
            Reference layout based on Microsoft Azure Local deployment guidance.
            Actual volumes depend on your workloads — use the workload suggestions above for calculated sizes.
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left border-t border-gray-100 dark:border-gray-800">
                <th className="px-4 py-2 font-semibold">Volume</th>
                <th className="px-4 py-2 font-semibold">Resiliency</th>
                <th className="px-4 py-2 font-semibold">Sizing</th>
                <th className="px-4 py-2 font-semibold">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {RECOMMENDED_VOLUMES.map((v) => {
                const needsParity = v.resiliency.includes('Dual Parity')
                const dimmed = needsParity && !hasParity
                return (
                  <tr key={v.name} className={`border-t border-gray-100 dark:border-gray-800 ${dimmed ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2 font-medium">
                      {v.name}
                      {dimmed && <span className="block text-xs text-red-500">needs 4+ nodes for parity</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{v.resiliency}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{v.sizing}</td>
                    <td className="px-4 py-2">
                      <div className="text-xs text-gray-600 dark:text-gray-400">{v.purpose}</div>
                      <div className="text-xs text-gray-400 italic mt-0.5">{v.notes}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

// ─── Resiliency Reference Guide (#11) ────────────────────────────────────────

const RESILIENCY_GUIDE = [
  {
    type: 'Two-Way Mirror',
    minNodes: 2,
    efficiency: '50%',
    footprint: '2× volume size',
    useCase: 'Development, test, non-critical workloads. 1 simultaneous failure tolerated.',
    advisory: 'Not recommended for production — loss of 2 drives (different nodes) can cause data loss.',
    color: 'amber',
  },
  {
    type: 'Three-Way Mirror',
    minNodes: 3,
    efficiency: '33%',
    footprint: '3× volume size',
    useCase: 'Production VMs, OS volumes, databases. 2 simultaneous failures tolerated.',
    advisory: 'Recommended default for all production workloads in Azure Local.',
    color: 'green',
  },
  {
    type: 'Dual Parity',
    minNodes: 4,
    efficiency: '50–80%',
    footprint: '1.25–2× volume size',
    useCase: 'Bulk storage, archives, cold data. Highest storage efficiency.',
    advisory: 'Higher write latency than mirror. Not suitable for IOPS-sensitive workloads or boot volumes.',
    color: 'blue',
  },
  {
    type: 'Nested Two-Way Mirror',
    minNodes: 2,
    efficiency: '25%',
    footprint: '4× volume size',
    useCase: '2-node clusters only. Protects against both node and drive failure simultaneously.',
    advisory: 'Required for 2-node Azure Local to maintain data availability during node failure.',
    color: 'purple',
  },
]

function ResiliencyGuide({ nodeCount }: { nodeCount: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-semibold text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        Resiliency Types — Node Count, Efficiency, and Use Cases
        <span className="ml-2 text-xs font-normal text-gray-400">4 types</span>
      </button>
      {open && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
          {RESILIENCY_GUIDE.map((r) => {
            const eligible = nodeCount >= r.minNodes
            return (
              <div key={r.type} className={`px-4 py-4 ${!eligible ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <span className="text-sm font-semibold">{r.type}</span>
                    {!eligible && (
                      <span className="ml-2 text-xs text-red-500">requires {r.minNodes} nodes — your cluster has {nodeCount}</span>
                    )}
                  </div>
                  <div className="text-right shrink-0 text-xs text-gray-500 space-y-0.5">
                    <div>Efficiency: <strong>{r.efficiency}</strong></div>
                    <div>Footprint: <strong>{r.footprint}</strong></div>
                    <div>Min nodes: <strong>{r.minNodes}</strong></div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{r.useCase}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">{r.advisory}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
