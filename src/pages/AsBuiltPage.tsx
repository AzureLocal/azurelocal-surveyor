import { useState } from 'react'
import { Link } from '../components/PlanLink'
import { useSurveyorStore } from '../state/usePlanStore'
import { computePlanning } from '../engine/planning'
import { compareBuiltToDemand, parseAsBuilt, type AsBuiltRecord } from '../engine/as-built'

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

const VERDICT: Record<string, string> = {
  'no-demand': 'Add workloads in the plan to compare demand with the built capacity.',
  'fits-with-n1': 'The built hardware carries the sized demand and still fits with one node down (N+1).',
  'fits-no-n1': 'The built hardware carries the sized demand, but not with one node down. There is no N+1 headroom.',
  'does-not-fit': 'The built hardware does not carry the sized demand.',
}

export default function AsBuiltPage() {
  const state = useSurveyorStore()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [record, setRecord] = useState<AsBuiltRecord | null>(null)

  const example = () => {
    const { nodeCount, coresPerNode, memoryPerNodeGB, capacityDrivesPerNode, capacityDriveSizeTB, capacityMediaType, cacheDrivesPerNode, cacheDriveSizeTB, cacheMediaType, hyperthreadingEnabled, rackAware } = state.hardware
    setText(JSON.stringify({
      kind: 'azurelocal-surveyor-asbuilt', schemaVersion: 1, source: 'typed example', capturedAt: new Date().toISOString().slice(0, 10),
      hardware: { nodeCount, coresPerNode, memoryPerNodeGB, capacityDrivesPerNode, capacityDriveSizeTB, capacityMediaType, cacheDrivesPerNode, cacheDriveSizeTB, cacheMediaType, hyperthreadingEnabled, ...(rackAware ? { rackAware: true } : {}) },
    }, null, 2))
  }
  const compare = () => {
    const result = parseAsBuilt(text)
    if (!result.ok) { setError(result.error); setRecord(null); return }
    setError(''); setRecord(result.record)
  }
  const result = record ? compareBuiltToDemand(state, record.hardware) : null
  const demand = computePlanning(state).workloadTotals

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold">Built vs sized</h1>
      <p className="text-sm text-gray-500 mt-2">Paste what was actually built and compare it with the demand sized in this plan. The record is read in your browser and is not saved or uploaded. See the <Link className="underline" to="/help">help</Link> and docs/guide/as-built-fit.md for the format.</p>
    </div>
    <label className="block text-sm font-medium" htmlFor="as-built-json">As-built hardware JSON</label>
    <textarea id="as-built-json" className="input font-mono text-xs h-48 w-full" value={text} onChange={e => setText(e.target.value)} spellCheck={false}
      placeholder='{ "kind": "azurelocal-surveyor-asbuilt", "schemaVersion": 1, "hardware": { "nodeCount": 4, ... } }' />
    <div className="flex flex-wrap gap-3">
      <button className="action" onClick={compare}>Compare</button>
      <button className="action-secondary" onClick={example}>Insert the planned hardware as a template</button>
      <Link className="action-secondary" to="/fit">Back to Fit</Link>
    </div>
    {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
    {record && result && <section className="space-y-4" aria-label="Built versus sized comparison">
      <p className="text-sm">Source: {record.source}{record.capturedAt ? `, captured ${record.capturedAt}` : ''}. Built: {record.hardware.nodeCount} node{record.hardware.nodeCount === 1 ? '' : 's'}{record.hardware.rackAware ? ' (rack aware)' : ''}, {record.hardware.coresPerNode} cores and {record.hardware.memoryPerNodeGB} GiB RAM per node.</p>
      <div className={`rounded-xl border p-4 ${result.verdict === 'fits-with-n1' ? 'border-green-400 bg-green-50 dark:bg-green-950' : result.verdict === 'no-demand' ? 'border-gray-300' : 'border-amber-400 bg-amber-50 dark:bg-amber-950'}`}><strong>{VERDICT[result.verdict]}</strong></div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left border-b"><th className="p-3">Resource</th><th className="p-3">Sized demand</th><th className="p-3">Planned hardware</th><th className="p-3">Built hardware</th><th className="p-3">Built, one node down (N+1)</th><th className="p-3">Built headroom</th></tr></thead>
        <tbody>
          <tr className="border-b"><th className="text-left p-3 font-medium">CPU · vCPU</th><td className="p-3">{fmt(demand.totalVCpus)}</td><td className="p-3">{fmt(result.planned.cpu)}</td><td className="p-3">{fmt(result.built.cpu)}</td><td className="p-3">{fmt(result.builtWithN1.cpu)}</td><td className="p-3">{pct(result.headroom.cpu)}</td></tr>
          <tr className="border-b"><th className="text-left p-3 font-medium">Memory · GiB</th><td className="p-3">{fmt(demand.totalMemoryGB)}</td><td className="p-3">{fmt(result.planned.memory)}</td><td className="p-3">{fmt(result.built.memory)}</td><td className="p-3">{fmt(result.builtWithN1.memory)}</td><td className="p-3">{pct(result.headroom.memory)}</td></tr>
          <tr className="border-b"><th className="text-left p-3 font-medium">Pool footprint · decimal TB</th><td className="p-3">{fmt(result.built.requiredFootprintTB)}</td><td className="p-3">{fmt(result.planned.poolTB)}</td><td className="p-3">{fmt(result.built.poolTB)}</td><td className="p-3">{fmt(result.builtWithN1.poolTB)} (storage is not reduced by N+1)</td><td className="p-3">{pct(result.headroom.pool)}</td></tr>
        </tbody></table></div>
      {result.notes.length > 0 && <ul className="list-disc pl-5 text-sm space-y-1">{result.notes.map(n => <li key={n}>{n}</li>)}</ul>}
      <p className="text-xs text-gray-500">N+1 here is a planning choice (largest single failure), compute only. Aggregate estimate: VM placement, networking and performance still need validation.</p>
    </section>}
  </div>
}
