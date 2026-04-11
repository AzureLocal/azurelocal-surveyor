import WorkloadPlanner from '../components/WorkloadPlanner'
import { useSurveyorStore } from '../state/store'
import { computeCompute } from '../engine/compute'
import { computeAvd } from '../engine/avd'
import { computeAks } from '../engine/aks'
import ComputeReport from '../components/ComputeReport'

export default function WorkloadsPage() {
  const { hardware, advanced, avd, avdEnabled, aks, infraVms, devTestVms, customVms } = useSurveyorStore()
  const compute = computeCompute(hardware, advanced)
  const avdResult = computeAvd(avd)
  const aksResult = computeAks(aks)

  // Aggregate enabled scenarios for utilization bars
  let totalVCpus = 0
  let totalMemoryGB = 0
  if (avdEnabled) { totalVCpus += avdResult.totalVCpus; totalMemoryGB += avdResult.totalMemoryGB }
  if (aks.enabled) { totalVCpus += aksResult.totalVCpus; totalMemoryGB += aksResult.totalMemoryGB }
  if (infraVms.enabled) { totalVCpus += (infraVms.vmCount * infraVms.vCpusPerVm) / infraVms.vCpuOvercommitRatio; totalMemoryGB += infraVms.vmCount * infraVms.memoryPerVmGB }
  if (devTestVms.enabled) { totalVCpus += (devTestVms.vmCount * devTestVms.vCpusPerVm) / devTestVms.vCpuOvercommitRatio; totalMemoryGB += devTestVms.vmCount * devTestVms.memoryPerVmGB }
  if (customVms.enabled) { totalVCpus += (customVms.vmCount * customVms.vCpusPerVm) / customVms.vCpuOvercommitRatio; totalMemoryGB += customVms.vmCount * customVms.memoryPerVmGB }
  // backupArchive is storage-only

  const vcpuUsedPct = compute.usableVCpus > 0
    ? Math.round((totalVCpus / compute.usableVCpus) * 100)
    : 0
  const memUsedPct = compute.usableMemoryGB > 0
    ? Math.round((totalMemoryGB / compute.usableMemoryGB) * 100)
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Workload Planner</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enable and configure workload scenarios. Toggle each scenario on/off to include it in capacity planning.
        </p>
      </div>

      {/* Utilization summary */}
      <div className="grid grid-cols-2 gap-4">
        <UtilBar label="vCPU" used={totalVCpus} total={compute.usableVCpus} pct={vcpuUsedPct} unit="" />
        <UtilBar label="Memory" used={totalMemoryGB} total={compute.usableMemoryGB} pct={memUsedPct} unit=" GB" />
      </div>

      <WorkloadPlanner />
      <ComputeReport result={compute} totalVCpus={Math.round(totalVCpus)} totalMemoryGB={Math.round(totalMemoryGB)} />
    </div>
  )
}

function UtilBar({ label, used, total, pct, unit }: { label: string; used: number; total: number; pct: number; unit: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>{Math.round(used)}{unit} / {total}{unit} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
        <div className={`h-2 rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-brand-500'}`}
          style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}
