import CapacityReport from '../components/CapacityReport'
import { useSurveyorStore } from '../state/usePlanStore'
import { computeCapacity, validResiliencyOptions } from '../engine/capacity'
import type { ResiliencyType } from '../engine/types'

export default function StorageCapacityPage() {
  const state = useSurveyorStore()
  return <div className="space-y-6"><h1 className="text-2xl font-bold">Capacity &amp; Resiliency</h1><p className="text-sm text-gray-500">Review the storage available after overhead and reserves. The comparison resiliency below also supplies the default for new volume suggestions; existing volumes keep their own resiliency.</p>
    <label className="block text-sm">Comparison resiliency<select className="input mt-1 max-w-sm" value={state.advanced.defaultResiliency} onChange={e => state.setAdvanced({ defaultResiliency: e.target.value as ResiliencyType })}>{validResiliencyOptions(state.hardware.nodeCount).map(r => <option value={r} key={r}>{r}</option>)}</select></label>
    <CapacityReport result={computeCapacity(state.hardware, state.advanced)} />
  </div>
}
