/**
 * WorkloadPlanner — generic VM workload rows.
 *
 * Each row is one workload type (e.g. "SQL Servers", "File Servers").
 * Adding a new workload type = click "Add workload" and fill in the row.
 * AVD and SOFS are separate pages (their own engine modules + routes).
 */
import { useState } from 'react'
import { useSurveyorStore } from '../state/store'
import { computeWorkloadSummary } from '../engine/workloads'
import type { WorkloadSpec } from '../engine/types'
import { Trash2, PlusCircle } from 'lucide-react'

let _id = 100
function nextId() { return String(_id++) }

export default function WorkloadPlanner() {
  const { workloads, addWorkload, removeWorkload } = useSurveyorStore()
  const summary = computeWorkloadSummary(workloads)

  const [form, setForm] = useState<Omit<WorkloadSpec, 'id'>>({
    name: '', vmCount: 1, vCpusPerVm: 4, memoryPerVmGB: 16,
    storagePerVmGB: 100, resiliency: '3-way-mirror',
  })

  function handleAdd() {
    if (!form.name.trim()) return
    addWorkload({ ...form, id: nextId(), name: form.name.trim() })
    setForm({ name: '', vmCount: 1, vCpusPerVm: 4, memoryPerVmGB: 16, storagePerVmGB: 100, resiliency: '3-way-mirror' })
  }

  return (
    <div className="space-y-6">
      {/* Workload table */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-left">
              <th className="px-3 py-2 font-semibold">Workload</th>
              <th className="px-3 py-2 font-semibold text-right">VMs</th>
              <th className="px-3 py-2 font-semibold text-right">vCPUs/VM</th>
              <th className="px-3 py-2 font-semibold text-right">RAM/VM (GB)</th>
              <th className="px-3 py-2 font-semibold text-right">Storage/VM (GB)</th>
              <th className="px-3 py-2 font-semibold">Resiliency</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {workloads.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">No workloads added yet.</td></tr>
            )}
            {workloads.map((w) => (
              <tr key={w.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2 font-medium">{w.name}</td>
                <td className="px-3 py-2 text-right">{w.vmCount}</td>
                <td className="px-3 py-2 text-right">{w.vCpusPerVm}</td>
                <td className="px-3 py-2 text-right">{w.memoryPerVmGB}</td>
                <td className="px-3 py-2 text-right">{w.storagePerVmGB}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{w.resiliency}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => removeWorkload(w.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {workloads.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-semibold">
                <td className="px-3 py-2">Totals</td>
                <td />
                <td className="px-3 py-2 text-right">{summary.totalVCpus}</td>
                <td className="px-3 py-2 text-right">{summary.totalMemoryGB} GB</td>
                <td className="px-3 py-2 text-right">{summary.totalStorageTB} TB</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add row */}
      <div className="grid grid-cols-6 gap-2 items-end">
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1">Workload name</label>
          <input className="input w-full" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="SQL Servers" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">VM count</label>
          <input type="number" min={1} className="input w-full" value={form.vmCount} onChange={(e) => setForm((f) => ({ ...f, vmCount: +e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">vCPUs / VM</label>
          <input type="number" min={1} className="input w-full" value={form.vCpusPerVm} onChange={(e) => setForm((f) => ({ ...f, vCpusPerVm: +e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">RAM/VM (GB)</label>
          <input type="number" min={1} className="input w-full" value={form.memoryPerVmGB} onChange={(e) => setForm((f) => ({ ...f, memoryPerVmGB: +e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Storage/VM (GB)</label>
          <input type="number" min={1} className="input w-full" value={form.storagePerVmGB} onChange={(e) => setForm((f) => ({ ...f, storagePerVmGB: +e.target.value }))} />
        </div>
        <button onClick={handleAdd} className="col-span-6 sm:col-span-1 flex items-center gap-1 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium">
          <PlusCircle className="w-4 h-4" />
          Add workload
        </button>
      </div>
    </div>
  )
}
