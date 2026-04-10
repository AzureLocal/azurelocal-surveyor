import { useState } from 'react'
import { useSurveyorStore } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { computeVolumeSummary } from '../engine/volumes'
import type { ResiliencyType } from '../engine/types'
import { Trash2, PlusCircle, AlertTriangle } from 'lucide-react'

let _id = 1
function nextId() { return String(_id++) }

export default function VolumeTable() {
  const { hardware, advanced, volumes, addVolume, removeVolume } = useSurveyorStore()
  const capacity = computeCapacity(hardware, advanced)
  const summary = computeVolumeSummary(volumes, capacity)

  const [newName, setNewName] = useState('')
  const [newSizeTB, setNewSizeTB] = useState(1)
  const [newResiliency, setNewResiliency] = useState<ResiliencyType>('3-way-mirror')

  function handleAdd() {
    if (!newName.trim()) return
    addVolume({ id: nextId(), name: newName.trim(), plannedSizeTB: newSizeTB, resiliency: newResiliency })
    setNewName('')
    setNewSizeTB(1)
  }

  return (
    <div className="space-y-4">
      {/* Utilization bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Storage utilization</span>
          <span>{summary.utilizationPct}% of {capacity.effectiveUsableTB} TB</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-2 rounded-full transition-all ${summary.utilizationPct > 80 ? 'bg-red-500' : 'bg-brand-500'}`}
            style={{ width: `${Math.min(100, summary.utilizationPct)}%` }}
          />
        </div>
      </div>

      {/* Volume table */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-left">
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Resiliency</th>
              <th className="px-4 py-2 font-semibold text-right">Calculator TB</th>
              <th className="px-4 py-2 font-semibold text-right">
                WAC GB
                <span title="Value to enter in Windows Admin Center or New-Volume -Size" className="ml-1 text-brand-500 cursor-help">ⓘ</span>
              </th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {summary.volumes.map((v) => (
              <tr key={v.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-4 py-2">{v.name}</td>
                <td className="px-4 py-2 text-gray-500">{v.resiliency}</td>
                <td className="px-4 py-2 text-right">{v.calculatorSizeTB}</td>
                <td className="px-4 py-2 text-right font-mono font-semibold text-brand-700 dark:text-brand-300">
                  {v.wacSizeGB}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => removeVolume(v.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add volume row */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium mb-1">Name</label>
          <input className="input w-full" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="CSV-Vol1" />
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium mb-1">Size (TB)</label>
          <input type="number" min={0.1} step={0.1} className="input w-full" value={newSizeTB} onChange={(e) => setNewSizeTB(+e.target.value)} />
        </div>
        <div className="w-48">
          <label className="block text-xs font-medium mb-1">Resiliency</label>
          <select className="input w-full" value={newResiliency} onChange={(e) => setNewResiliency(e.target.value as ResiliencyType)}>
            <option value="2-way-mirror">2-way mirror</option>
            <option value="3-way-mirror">3-way mirror</option>
            <option value="mirror-accelerated-parity">MAP</option>
          </select>
        </div>
        <button onClick={handleAdd} className="flex items-center gap-1 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium">
          <PlusCircle className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* WAC callout */}
      <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-800 dark:text-amber-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span><strong>WAC GB</strong> is the value to enter in Windows Admin Center or pass to <code>New-Volume -Size</code>. It is rounded <em>down</em> to avoid WAC errors. Do not use the Calculator TB value directly in WAC.</span>
      </div>
    </div>
  )
}
