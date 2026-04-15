import { useState } from 'react'
import { useSurveyorStore } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { computeVolumeSummary } from '../engine/volumes'
import type { ResiliencyType } from '../engine/types'
import { Trash2, PlusCircle, AlertTriangle, Pencil, Check, X } from 'lucide-react'

const PROVISIONING_OPTIONS: { value: 'fixed' | 'thin'; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'thin',  label: 'Thin' },
]

let _id = 1
function nextId() { return String(_id++) }

const RESILIENCY_OPTIONS: { value: ResiliencyType; label: string }[] = [
  { value: 'two-way-mirror',   label: 'Two-Way Mirror' },
  { value: 'three-way-mirror', label: 'Three-Way Mirror' },
  { value: 'dual-parity',      label: 'Dual Parity' },
  { value: 'nested-two-way',   label: 'Nested Two-Way' },
]

export default function VolumeTable() {
  const { hardware, advanced, volumes, addVolume, updateVolume, removeVolume } = useSurveyorStore()
  const capacity = computeCapacity(hardware, advanced)
  const summary  = computeVolumeSummary(volumes, capacity)

  const [newName, setNewName]               = useState('')
  const [newSizeTiB, setNewSizeTiB]         = useState(1)
  const [newResiliency, setNewResiliency]   = useState<ResiliencyType>('three-way-mirror')
  const [newProvisioning, setNewProvisioning] = useState<'fixed' | 'thin'>('fixed')

  // Inline edit state — tracks which row is being edited
  const [editId, setEditId]                   = useState<string | null>(null)
  const [editName, setEditName]               = useState('')
  const [editSizeTiB, setEditSizeTiB]         = useState(0)
  const [editResiliency, setEditResiliency]   = useState<ResiliencyType>('three-way-mirror')
  const [editProvisioning, setEditProvisioning] = useState<'fixed' | 'thin'>('fixed')

  function handleAdd() {
    if (!newName.trim()) return
    addVolume({ id: nextId(), name: newName.trim(), plannedSizeTB: newSizeTiB, resiliency: newResiliency, provisioning: newProvisioning })
    setNewName('')
    setNewSizeTiB(1)
  }

  function startEdit(v: typeof summary.volumes[0]) {
    setEditId(v.id)
    setEditName(v.name)
    setEditSizeTiB(v.calculatorSizeTB)
    setEditResiliency(v.resiliency)
    setEditProvisioning(v.provisioning)
  }

  function commitEdit() {
    if (!editId) return
    updateVolume(editId, { name: editName.trim() || editName, plannedSizeTB: editSizeTiB, resiliency: editResiliency, provisioning: editProvisioning })
    setEditId(null)
  }

  function cancelEdit() { setEditId(null) }

  const utilizationColor = summary.utilizationPct > 80 ? 'bg-red-500'
    : summary.utilizationPct > 70 ? 'bg-amber-500'
    : 'bg-brand-500'

  return (
    <div className="space-y-4">

      {/* TB vs TiB callout — the most important thing to communicate */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-sm space-y-1">
        <p className="font-semibold text-blue-900 dark:text-blue-200">Volume sizes are in TiB (binary) — what Windows shows</p>
        <p className="text-blue-800 dark:text-blue-300 text-xs">
          Drive sizes on the Hardware page are vendor decimal TB (e.g. a Dell 7.68 TB NVMe).
          Volume sizes here use <strong>TiB</strong> — the binary unit that Windows Admin Center,
          PowerShell, and File Explorer display. 1 TB (vendor) ≈ 0.91 TiB in Windows.
        </p>
        <p className="text-blue-700 dark:text-blue-400 text-xs">
          The <strong>New-Volume GiB</strong> column is the exact number to enter in WAC or pass to{' '}
          <code className="font-mono">New-Volume -Size</code> in PowerShell. It is rounded down to avoid WAC errors.
        </p>
      </div>

      {/* Utilization bar — pool footprint vs raw pool available for volumes */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Pool utilization</span>
          <span>
            {summary.totalPoolFootprintTB.toFixed(2)} TB pool footprint — {summary.utilizationPct}% of {capacity.availableForVolumesTB.toFixed(2)} TB available
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-2 rounded-full transition-all ${utilizationColor}`}
            style={{ width: `${Math.min(100, summary.utilizationPct)}%` }}
          />
        </div>
      </div>

      {/* Volume table */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-left">
              <th className="px-4 py-2.5 font-semibold">Name</th>
              <th className="px-4 py-2.5 font-semibold">Resiliency</th>
              <th className="px-4 py-2.5 font-semibold">Provisioning</th>
              <th className="px-4 py-2.5 font-semibold text-right">Planned (TiB)</th>
              <th className="px-4 py-2.5 font-semibold text-right text-brand-700 dark:text-brand-300">
                New-Volume GiB
                <span
                  title="Enter this number in Windows Admin Center or pass to New-Volume -Size in PowerShell. Rounded down to prevent WAC errors."
                  className="ml-1 text-gray-400 cursor-help"
                >ⓘ</span>
              </th>
              <th className="px-4 py-2.5 w-20" />
            </tr>
          </thead>
          <tbody>
            {summary.volumes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                  No volumes yet — add one below.
                </td>
              </tr>
            )}
            {summary.volumes.map((v) =>
              editId === v.id ? (
                // ── Inline edit row ──────────────────────────────────────────
                <tr key={v.id} className="border-t border-gray-100 dark:border-gray-800 bg-brand-50 dark:bg-brand-900/20">
                  <td className="px-3 py-1.5">
                    <input
                      autoFocus
                      className="input w-full py-1 text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      className="input py-1 text-sm"
                      value={editResiliency}
                      onChange={(e) => setEditResiliency(e.target.value as ResiliencyType)}
                    >
                      {RESILIENCY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      className="input py-1 text-sm"
                      value={editProvisioning}
                      onChange={(e) => setEditProvisioning(e.target.value as 'fixed' | 'thin')}
                    >
                      {PROVISIONING_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number" min={0.1} step={0.1}
                      className="input w-28 py-1 text-sm text-right ml-auto block"
                      value={editSizeTiB}
                      onChange={(e) => setEditSizeTiB(+e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs text-gray-400">
                    {Math.floor(editSizeTiB * 1024)} GiB
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={commitEdit} className="p-1 text-green-600 hover:text-green-700" title="Save (Enter)">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={cancelEdit} className="p-1 text-gray-400 hover:text-gray-600" title="Cancel (Esc)">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                // ── Display row ──────────────────────────────────────────────
                <tr key={v.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 group">
                  <td className="px-4 py-2">{v.name}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{v.resiliency}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{v.provisioning}</td>
                  <td className="px-4 py-2 text-right">{v.calculatorSizeTB}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-brand-700 dark:text-brand-300">
                    {v.wacSizeGB}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(v)}
                        className="p-1 text-gray-400 hover:text-brand-600"
                        title="Edit volume"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeVolume(v.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                        title="Remove volume"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
          {summary.volumes.length > 0 && (
            <tfoot className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <tr>
                <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-gray-500">TOTAL</td>
                <td className="px-4 py-2 text-right font-semibold">{summary.totalPlannedTB} TiB</td>
                <td className="px-4 py-2 text-right font-mono font-semibold text-brand-700 dark:text-brand-300">
                  {summary.volumes.reduce((s, v) => s + v.wacSizeGB, 0)} GiB
                </td>
                <td />
              </tr>
              <tr className="border-t border-gray-100 dark:border-gray-800">
                <td colSpan={3} className="px-4 py-1.5 text-xs text-gray-400">Pool footprint / remaining</td>
                <td colSpan={2} className="px-4 py-1.5 text-right text-xs font-mono text-gray-500">
                  {summary.totalPoolFootprintTB.toFixed(2)} TB used · {summary.remainingUsableTB.toFixed(2)} TB remaining
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add volume row */}
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-32">
          <label className="block text-xs font-medium mb-1">Name</label>
          <input
            className="input w-full"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="CSV-Vol1"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium mb-1">Size (TiB)</label>
          <input
            type="number" min={0.1} step={0.1}
            className="input w-full"
            value={newSizeTiB}
            onChange={(e) => setNewSizeTiB(+e.target.value)}
          />
        </div>
        <div className="w-44">
          <label className="block text-xs font-medium mb-1">Resiliency</label>
          <select
            className="input w-full"
            value={newResiliency}
            onChange={(e) => setNewResiliency(e.target.value as ResiliencyType)}
          >
            {RESILIENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium mb-1">Provisioning</label>
          <select
            className="input w-full"
            value={newProvisioning}
            onChange={(e) => setNewProvisioning(e.target.value as 'fixed' | 'thin')}
          >
            {PROVISIONING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium"
        >
          <PlusCircle className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* WAC callout */}
      <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-800 dark:text-amber-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>New-Volume GiB</strong> is the value to use in Windows Admin Center or{' '}
          <code className="font-mono">New-Volume -Size</code> in PowerShell (multiply GiB × 1,073,741,824 for bytes).
          It is rounded <em>down</em> to prevent WAC from rejecting the volume size.
          Do <strong>not</strong> use the TiB column value directly in WAC.
        </span>
      </div>
    </div>
  )
}
