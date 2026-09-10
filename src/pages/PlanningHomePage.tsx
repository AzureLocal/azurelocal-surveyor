import { Link } from 'react-router-dom'
import { useSurveyorStore } from '../state/usePlanStore'
import { computePlanning } from '../engine/planning'
import { assessHardwareFit } from '../engine/fit'

export default function PlanningHomePage() {
  const state = useSurveyorStore()
  const demand = computePlanning(state).workloadTotals
  const fit = assessHardwareFit(state)
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Workload Planning</h1><p className="text-gray-500 mt-2">Start with what you need to run or the hardware you already own. Both paths use the same workload project.</p></div>
    <div className="grid md:grid-cols-2 gap-5">
      <section className="panel space-y-3"><h2 className="text-xl font-semibold">What hardware do I need?</h2><p>Import VMs or describe workloads, then compare hardware configurations with room for growth and maintenance.</p><Link className="action" to="/planning/workloads" onClick={() => state.setPlanningPurpose('buy')}>Size from workloads →</Link><p className="text-sm text-gray-500">Workloads → Hardware options → Storage design → Report</p></section>
      <section className="panel space-y-3"><h2 className="text-xl font-semibold">What can my hardware run?</h2><p>Enter existing nodes and drives, add workloads, then check fit, remaining headroom and expansion options.</p><Link className="action" to="/planning/hardware" onClick={() => state.setPlanningPurpose('existing')}>Assess existing hardware →</Link><p className="text-sm text-gray-500">Hardware → Workloads → Fit & recommendations → Report</p></section>
    </div>
    <section className="panel space-y-3"><h2 className="font-semibold">Current workload plan</h2><p>{state.inventory.filter(vm => vm.include).length} inventory VMs · {Math.ceil(demand.totalVCpus)} vCPU · {Math.ceil(demand.totalMemoryGB)} GiB RAM · {demand.totalStorageTB.toFixed(2)} TB workload storage</p><p className="text-sm">{state.hardware.nodeCount} hardware nodes · {fit.fits === null ? 'Add workloads to assess fit.' : fit.fits ? 'Aggregate capacity fits the current hardware.' : 'Capacity or configuration needs attention.'}</p><Link className="text-brand-600 underline" to={state.planningPurpose === 'buy' ? '/planning/recommendations' : '/planning/fit'}>Continue to {state.planningPurpose === 'buy' ? 'hardware options' : 'fit assessment'} →</Link></section>
  </div>
}
