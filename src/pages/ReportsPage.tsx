/**
 * ReportsPage — tabbed reports view mirroring Excel sheet tabs.
 * Tabs: Capacity | Compute | Final Report
 * #9: tabbed reports view
 */
import { useState } from 'react'
import { Settings } from 'lucide-react'
import FinalReport from '../components/FinalReport'
import CapacityReport from '../components/CapacityReport'
import ComputeReport from '../components/ComputeReport'
import AdvancedSettings from '../components/AdvancedSettings'
import { useSurveyorStore } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { computeCompute } from '../engine/compute'
import { computeAvd } from '../engine/avd'
import { computeSofs } from '../engine/sofs'
import { computeAks } from '../engine/aks'

type Tab = 'capacity' | 'compute' | 'final'

const TABS: { id: Tab; label: string }[] = [
  { id: 'capacity', label: 'Capacity' },
  { id: 'compute', label: 'Compute' },
  { id: 'final', label: 'Final Report' },
]

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('final')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const state = useSurveyorStore()
  const { hardware, advanced } = state
  const capacity = computeCapacity(hardware, advanced)
  const compute = computeCompute(hardware, advanced)
  const avd = computeAvd(state.avd, state.advanced.overrides)
  const sofs = computeSofs(state.sofs, state.advanced.overrides)
  const aks = computeAks(state.aks)

  // Aggregate workload totals (same pattern as FinalReport/VolumesPage)
  let totalVCpus = 0, totalMemoryGB = 0, totalStorageTB = 0
  if (state.avdEnabled)            { totalVCpus += avd.totalVCpus;   totalMemoryGB += avd.totalMemoryGB;   totalStorageTB += avd.totalStorageTB }
  if (state.aks.enabled)           { totalVCpus += aks.totalVCpus;   totalMemoryGB += aks.totalMemoryGB;   totalStorageTB += aks.totalStorageTB }
  if (state.infraVms.enabled)      { totalVCpus += (state.infraVms.vmCount * state.infraVms.vCpusPerVm) / state.infraVms.vCpuOvercommitRatio;     totalMemoryGB += state.infraVms.vmCount * state.infraVms.memoryPerVmGB;     totalStorageTB += (state.infraVms.vmCount * state.infraVms.storagePerVmGB) / 1024 }
  if (state.devTestVms.enabled)    { totalVCpus += (state.devTestVms.vmCount * state.devTestVms.vCpusPerVm) / state.devTestVms.vCpuOvercommitRatio; totalMemoryGB += state.devTestVms.vmCount * state.devTestVms.memoryPerVmGB; totalStorageTB += (state.devTestVms.vmCount * state.devTestVms.storagePerVmGB) / 1024 }
  if (state.backupArchive.enabled) { totalStorageTB += state.backupArchive.storageTB }
  if (state.customVms.enabled)     { totalVCpus += (state.customVms.vmCount * state.customVms.vCpusPerVm) / state.customVms.vCpuOvercommitRatio;   totalMemoryGB += state.customVms.vmCount * state.customVms.memoryPerVmGB;   totalStorageTB += (state.customVms.vmCount * state.customVms.storagePerVmGB) / 1024 }
  if (state.sofsEnabled)           { totalVCpus += sofs.sofsVCpusTotal; totalMemoryGB += sofs.sofsMemoryTotalGB; totalStorageTB += sofs.totalStorageTB }

  const workloadTotals = {
    totalVCpus: Math.round(totalVCpus),
    totalMemoryGB: Math.round(totalMemoryGB),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Capacity, Compute, and Final Report tabs — mirrors the Excel workbook sheet structure.
          </p>
        </div>
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Settings className="w-4 h-4" />
          Advanced Settings
        </button>
      </div>

      {showAdvanced && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold mb-4">Advanced Settings</h2>
          <AdvancedSettings />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'capacity' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Raw pool, usable capacity, reserve drives, and effective usable — the planning number for workloads.
          </p>
          <CapacityReport result={capacity} volumesUsedTB={state.volumes.reduce((s, v) => s + v.plannedSizeTB, 0)} />
        </div>
      )}

      {activeTab === 'compute' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            vCPU and memory capacity, overcommit sensitivity, and N+1 failover analysis.
          </p>
          <ComputeReport result={compute} totalVCpus={workloadTotals.totalVCpus} totalMemoryGB={workloadTotals.totalMemoryGB} />
        </div>
      )}

      {activeTab === 'final' && <FinalReport />}
    </div>
  )
}
