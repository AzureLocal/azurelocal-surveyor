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
import SofsReport from '../components/SofsReport'
import AdvancedSettings from '../components/AdvancedSettings'
import { useSurveyorStore } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { computeCompute } from '../engine/compute'
import { computeAvd } from '../engine/avd'
import { computeSofs } from '../engine/sofs'
import { computeAks } from '../engine/aks'
import { computeMabs } from '../engine/mabs'
import { computeAllCustomWorkloads } from '../engine/custom-workloads'
import { computeAllServicePresets } from '../engine/service-presets'

type Tab = 'capacity' | 'compute' | 'sofs' | 'final'

const BASE_TABS: { id: Tab; label: string }[] = [
  { id: 'capacity', label: 'Capacity' },
  { id: 'compute', label: 'Compute' },
  { id: 'final', label: 'Final Report' },
]

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('final')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const state = useSurveyorStore()
  const tabs: { id: Tab; label: string }[] = [
    ...BASE_TABS.filter((t) => t.id !== 'final'),
    ...(state.sofsEnabled ? [{ id: 'sofs' as Tab, label: 'SOFS Report' }] : []),
    { id: 'final', label: 'Final Report' },
  ]
  const { hardware, advanced } = state
  const capacity = computeCapacity(hardware, advanced)
  const compute = computeCompute(hardware, advanced)
  const avd = computeAvd(state.avd, state.advanced.overrides)
  const sofs = computeSofs(state.sofs, state.advanced.overrides)
  const aks = computeAks(state.aks)
  const mabsResult = computeMabs(state.mabs)

  // Aggregate workload totals (same pattern as VolumesPage)
  let totalVCpus = 0, totalMemoryGB = 0
  if (state.avdEnabled)  { totalVCpus += avd.totalVCpus;  totalMemoryGB += avd.totalMemoryGB }
  if (state.aks.enabled) { totalVCpus += aks.totalVCpus;  totalMemoryGB += aks.totalMemoryGB }
  if (state.virtualMachines?.enabled) {
    const vm = state.virtualMachines
    totalVCpus    += (vm.vmCount * vm.vCpusPerVm) / vm.vCpuOvercommitRatio
    totalMemoryGB += vm.vmCount * vm.memoryPerVmGB
  }
  if (state.sofsEnabled) { totalVCpus += sofs.sofsVCpusTotal; totalMemoryGB += sofs.sofsMemoryTotalGB }
  if (state.mabsEnabled) { totalVCpus += mabsResult.mabsVCpus; totalMemoryGB += mabsResult.mabsMemoryGB }
  const presetTotals = computeAllServicePresets(state.servicePresets)
  totalVCpus    += presetTotals.totalVCpus
  totalMemoryGB += presetTotals.totalMemoryGB
  const customTotals = computeAllCustomWorkloads(state.customWorkloads)
  totalVCpus    += customTotals.totalVCpus
  totalMemoryGB += customTotals.totalMemoryGB

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
        {tabs.map((tab) => (
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

      {activeTab === 'sofs' && state.sofsEnabled && <SofsReport />}

      {activeTab === 'final' && <FinalReport />}
    </div>
  )
}
