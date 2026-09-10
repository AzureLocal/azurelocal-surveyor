import { Link } from 'react-router-dom'
import { useSurveyorStore } from '../state/store'
import { assessHardwareFit } from '../engine/fit'

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function FitPage() {
  const state = useSurveyorStore()
  const fit = assessHardwareFit(state)
  const rows = [
    ['CPU · vCPU', fit.demand.totalVCpus, fit.current.cpu, fit.current.deficits.vCpus],
    ['Memory · GiB', fit.demand.totalMemoryGB, fit.current.memory, fit.current.deficits.memoryGB],
    ['Storage pool footprint · decimal TB', fit.current.requiredFootprintTB, fit.current.poolTB, fit.current.deficits.poolTB],
  ] as const
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Workload fit</h1><p className="text-sm text-gray-500 mt-1">Compare all enabled workloads with your hardware and estimate the node count at the same specification.</p></div>
    <div className="flex flex-wrap gap-3 text-sm"><Link className="text-brand-600 underline" to="/workloads">1. Review workloads</Link><Link className="text-brand-600 underline" to="/hardware">2. Configure hardware</Link><Link className="text-brand-600 underline" to="/volumes">3. Review volume layout</Link><Link className="text-brand-600 underline" to="/reports">4. Export report</Link></div>
    <section className={`rounded-xl border p-5 space-y-2 ${fit.fits === true ? 'border-green-400 bg-green-50 dark:bg-green-950' : fit.fits === false ? 'border-amber-400 bg-amber-50 dark:bg-amber-950' : 'border-gray-300'}`}>
      <h2 className="text-xl font-semibold">{fit.fits === null ? 'Add workloads to assess fit' : fit.fits ? 'Aggregate capacity fits' : 'Capacity or configuration gap'}</h2>
      <p>{state.hardware.nodeCount} nodes · {state.hardware.coresPerNode} physical cores and {state.hardware.memoryPerNodeGB} GiB RAM per node · {fit.reserveNodes} node{fit.reserveNodes === 1 ? '' : 's'} reserved for maintenance.</p>
      {fit.hasDemand && <p>{fit.requiredNodes === null ? 'No feasible same-spec design was found within this planner’s 2–16 node range. Review volume constraints or choose denser hardware.' : `Smallest modeled fit: ${fit.requiredNodes} nodes. ${fit.additionalNodes ? `Add ${fit.additionalNodes} nodes at the current specification.` : 'No additional nodes required for aggregate capacity.'}`}</p>}
      <p className="text-sm">This is the existing S2D calculator’s modeling range, not a statement of every Azure Local deployment limit.</p>
    </section>
    <label className="block text-sm">Maintenance reserve<select className="input ml-3" value={state.advanced.maintenanceReserveMode ?? 'none'} onChange={e => state.setAdvanced({ maintenanceReserveMode: e.target.value as 'none' | 'n+1' | 'n+2' })}><option value="none">No node reserve</option><option value="n+1">N+1 · one node</option><option value="n+2">N+2 · two nodes</option></select></label>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="p-3">Resource</th><th className="p-3">Required</th><th className="p-3">Available</th><th className="p-3">Deficit</th></tr></thead><tbody>{rows.map(([label, demand, capacity, deficit]) => <tr className="border-b" key={label}><th className="text-left p-3 font-medium">{label}</th><td className="p-3">{fmt(demand)}</td><td className="p-3">{fmt(capacity)}</td><td className={`p-3 ${deficit > 0 ? 'text-red-600 font-semibold' : 'text-green-700'}`}>{fmt(deficit)}</td></tr>)}</tbody></table></div>
    <p className="text-sm text-gray-500">Workload volume footprint: {fmt(fit.current.workloadFootprintTB)} TB. Edited volume layout: {fmt(fit.current.plannedFootprintTB)} TB. Both include per-volume resiliency; they are not added together. Storage is checked at full planned consumption, including thin volumes. Maintenance reserve affects compute only.</p>
    {fit.current.errors.length > 0 && <ul className="list-disc pl-5 text-sm text-red-600 space-y-1">{fit.current.errors.map(error => <li key={error}>{error}</li>)}</ul>}
    <section className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-5"><h2 className="font-semibold mb-2">Planning assumptions</h2><ul className="list-disc pl-5 text-sm space-y-2">{fit.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></section>
    <details><summary className="cursor-pointer font-medium">Compare node counts</summary><div className="overflow-x-auto mt-3"><table className="w-full text-sm"><thead><tr className="text-left"><th className="p-2">Nodes</th><th className="p-2">Available vCPU</th><th className="p-2">Available GiB RAM</th><th className="p-2">Available pool TB</th><th className="p-2">Result</th></tr></thead><tbody>{fit.candidates.map(candidate => <tr className="border-t" key={candidate.nodeCount}><td className="p-2">{candidate.nodeCount}</td><td className="p-2">{fmt(candidate.cpu)}</td><td className="p-2">{fmt(candidate.memory)}</td><td className="p-2">{fmt(candidate.poolTB)}</td><td className="p-2">{!fit.hasDemand ? 'No workload demand' : candidate.fits ? 'Capacity fits' : candidate.errors.length ? 'Configuration constraint' : 'Capacity gap'}</td></tr>)}</tbody></table></div></details>
  </div>
}
