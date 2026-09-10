import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from '../components/PlanLink'
import { useSurveyorStore } from '../state/usePlanStore'
import { PRESET_VENDORS } from '../engine/presets'
import { recommendHardware } from '../engine/recommendations'
import { computePlanning } from '../engine/planning'

export default function RecommendationsPage() {
  const state = useSurveyorStore()
  const navigate = useNavigate()
  const [constraints, setConstraints] = useState({ minNodes: 2, maxNodes: 16, headroomPct: 20, vendor: '' })
  const result = useMemo(() => recommendHardware(state, constraints), [state, constraints])
  const demand = computePlanning(state).workloadTotals
  const hasDemand = demand.totalVCpus > 0 || demand.totalMemoryGB > 0 || demand.totalStorageTB > 0
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">What hardware do I need?</h1><p className="text-sm text-gray-500 mt-2">Compare OEM planning configurations against your workload demand, volume design and maintenance reserve.</p></div>
    <div className="panel"><strong>Required by your workloads:</strong> {Math.ceil(demand.totalVCpus)} vCPU · {Math.ceil(demand.totalMemoryGB)} GiB RAM · {demand.totalStorageTB.toFixed(2)} TB logical storage.
      <p className="text-sm mt-2">Current inventory growth and measured-sizing assumptions are included. Additional headroom below is applied to CPU, RAM and the required storage pool footprint.</p></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <label className="text-sm">Minimum nodes<input className="input mt-1" type="number" min={2} max={16} value={constraints.minNodes} onChange={e => setConstraints({ ...constraints, minNodes: +e.target.value })} /></label>
      <label className="text-sm">Maximum nodes<input className="input mt-1" type="number" min={2} max={16} value={constraints.maxNodes} onChange={e => setConstraints({ ...constraints, maxNodes: +e.target.value })} /></label>
      <label className="text-sm">Additional headroom (%)<input className="input mt-1" type="number" min={0} max={100} value={constraints.headroomPct} onChange={e => setConstraints({ ...constraints, headroomPct: +e.target.value })} /></label>
      <label className="text-sm">OEM vendor<select className="input mt-1" value={constraints.vendor} onChange={e => setConstraints({ ...constraints, vendor: e.target.value })}><option value="">All vendors</option>{PRESET_VENDORS.map(v => <option key={v}>{v}</option>)}</select></label>
    </div>
    {result.error && <p role="alert" className="text-red-600">{result.error}</p>}
    {!hasDemand ? <div className="panel"><h2 className="font-semibold">Add workloads to find hardware options</h2><Link className="action mt-3" to="/workloads">Add or import workloads</Link></div>
      : <><p className="text-sm text-gray-500">{result.options.length} example configurations fit. Sorted by fewest nodes, then total physical cores and RAM; this is not a price ranking. Examples require OEM confirmation and do not constitute certified procurement BOMs.</p>
        {result.options.length === 0 && !result.error && <div role="status" className="panel">No reviewed preset fits these constraints. Increase the node range, reduce extra headroom, or review oversized VMs and volume resiliency in <Link to="/fit" className="underline">Fit &amp; Recommendations</Link>. Custom hardware remains available.</div>}
        <div className="grid lg:grid-cols-2 gap-4">{result.options.map(option => <section className="panel space-y-3" key={option.preset.id}>
          <h2 className="font-semibold">{option.preset.vendor} {option.preset.model}</h2>
          <p><strong>{option.hardware.nodeCount} nodes</strong> · {option.hardware.coresPerNode} physical cores and {option.hardware.memoryPerNodeGB} GB RAM per node</p>
          <p className="text-sm">Per node: {option.hardware.capacityDrivesPerNode} × {option.hardware.capacityDriveSizeTB} TB {option.hardware.capacityMediaType.toUpperCase()} capacity{option.hardware.cacheDrivesPerNode > 0 ? ` + ${option.hardware.cacheDrivesPerNode} × ${option.hardware.cacheDriveSizeTB} TB cache` : ''}.</p>
          <p className="text-sm">Headroom after workload demand: {Math.floor(option.candidate.cpu - demand.totalVCpus)} vCPU · {Math.floor(option.candidate.memory - demand.totalMemoryGB)} GiB RAM · {(option.candidate.poolTB - option.candidate.requiredFootprintTB).toFixed(2)} TB pool.</p>
          <p className="text-xs text-gray-500">Pool requirement: {option.candidate.requiredFootprintTB.toFixed(2)} TB + {constraints.headroomPct}% headroom; available: {option.candidate.poolTB.toFixed(2)} TB. Includes resiliency, storage reserves and overhead.</p>
          <a className="text-sm underline" href={option.preset.sourceUrl} target="_blank" rel="noopener noreferrer">Vendor specifications</a>
          <button className="action block" onClick={() => { state.setHardware(option.hardware); navigate('/planning/fit') }}>Use {option.preset.model} · {option.hardware.nodeCount} nodes</button>
        </section>)}</div></>}
  </div>
}
