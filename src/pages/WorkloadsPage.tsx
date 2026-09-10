import { computePlanning } from '../engine/planning'
import WorkloadPlanner from '../components/WorkloadPlanner'
import { useSurveyorStore } from '../state/store'
import { computeCompute } from '../engine/compute'
import ComputeReport from '../components/ComputeReport'
import InventoryPlanner from '../components/InventoryPlanner'
import { Link } from 'react-router-dom'

export default function WorkloadsPage() {
  const state = useSurveyorStore()
  const { hardware, advanced } = state
  const compute = computeCompute(hardware, advanced)
  const { totalVCpus, totalMemoryGB } = computePlanning(state).workloadTotals
  const reserve = advanced.maintenanceReserveMode ?? 'none'
  const cpuCapacity = reserve === 'n+2' ? compute.usableVCpusN2 : reserve === 'n+1' ? compute.usableVCpusN1 : compute.usableVCpus
  const memoryCapacity = reserve === 'n+2' ? compute.usableMemoryGBN2 : reserve === 'n+1' ? compute.usableMemoryGBN1 : compute.usableMemoryGB

  const vcpuUsedPct = cpuCapacity > 0 ? Math.round(totalVCpus / cpuCapacity * 100) : totalVCpus > 0 ? 100 : 0
  const memUsedPct = memoryCapacity > 0 ? Math.round(totalMemoryGB / memoryCapacity * 100) : totalMemoryGB > 0 ? 100 : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Workload Planner</h1>
        <p className="text-sm text-gray-500 mt-1">
          Import or enter individual VMs, then add specialized workload scenarios. Review the combined demand before sizing hardware.
        </p>
      </div>

      {/* Utilization summary */}
      <div className="grid grid-cols-2 gap-4">
        <UtilBar label={`vCPU · reserve ${reserve}`} used={totalVCpus} total={cpuCapacity} pct={vcpuUsedPct} unit="" />
        <UtilBar label={`Memory · reserve ${reserve}`} used={totalMemoryGB} total={memoryCapacity} pct={memUsedPct} unit=" GiB" />
      </div>

      <InventoryPlanner />
      <div className="flex flex-wrap gap-4 text-sm"><Link to="/hardware" className="text-brand-600 underline">Configure hardware</Link><Link to="/fit" className="text-brand-600 underline">Assess workload fit →</Link><Link to="/projects" className="text-brand-600 underline">Save or compare a project</Link></div>
      <h2 className="text-xl font-semibold">Specialized workloads and quick groups</h2>
      <WorkloadPlanner />
      <ComputeReport result={compute} totalVCpus={totalVCpus} totalMemoryGB={totalMemoryGB} maintenanceReserveMode={reserve} />
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
