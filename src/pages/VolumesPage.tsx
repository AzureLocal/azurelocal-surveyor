import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Volume Detail</h1>
        <p className="text-sm text-gray-500 mt-1">
          Plan your Cluster Shared Volumes with per-volume resiliency and WAC-ready sizes.
          Ports the 95 formulas from the Volume Detail sheet.
        </p>
      </div>

      <VolumeTable />

      <HealthCheck result={health} />

      <section>
        <h2 className="text-xl font-semibold mb-4">Resiliency Reference Guide</h2>
        <ResiliencyGuide nodeCount={hardware.nodeCount} />
      </section>
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
