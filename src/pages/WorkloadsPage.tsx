import WorkloadPlanner from '../components/WorkloadPlanner'
import { useSurveyorStore } from '../state/store'
import { computeCompute } from '../engine/compute'
import { computeWorkloadSummary } from '../engine/workloads'
import ComputeReport from '../components/ComputeReport'

export default function WorkloadsPage() {
  const { hardware, advanced, workloads } = useSurveyorStore()
  const compute = computeCompute(hardware, advanced)
  const summary = computeWorkloadSummary(workloads)

  const vcpuUsedPct = compute.usableVCpus > 0
    ? Math.round((summary.totalVCpus / compute.usableVCpus) * 100)
    : 0
  const memUsedPct = compute.usableMemoryGB > 0
    ? Math.round((summary.totalMemoryGB / compute.usableMemoryGB) * 100)
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Workload Planner</h1>
        <p className="text-sm text-gray-500 mt-1">
          Add generic VM workloads. Use the AVD and SOFS pages for those specific planners.
        </p>
      </div>

      {/* Utilization summary */}
      {workloads.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <UtilBar label="vCPU" used={summary.totalVCpus} total={compute.usableVCpus} pct={vcpuUsedPct} unit="" />
          <UtilBar label="Memory" used={summary.totalMemoryGB} total={compute.usableMemoryGB} pct={memUsedPct} unit=" GB" />
        </div>
      )}

      <WorkloadPlanner />
      <ComputeReport result={compute} />
    </div>
  )
}

function UtilBar({ label, used, total, pct, unit }: { label: string; used: number; total: number; pct: number; unit: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>{used}{unit} / {total}{unit} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
        <div className={`h-2 rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-brand-500'}`}
          style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}
