import { useRef, useState } from 'react'
import { useSurveyorStore } from '../state/store'
import { createProject, downloadProject, parseProject } from '../state/project'
import { assessHardwareFit } from '../engine/fit'

export default function ProjectPage() {
  const state = useSurveyorStore()
  const [name, setName] = useState('Azure Local plan')
  const [pending, setPending] = useState<ReturnType<typeof parseProject> | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const upload = useRef<HTMLInputElement>(null)
  const current = assessHardwareFit(state)
  const comparison = pending ? assessHardwareFit(pending.inputs) : null
  const button = 'rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Saved projects</h1><p className="text-sm text-gray-500 mt-1">Save a complete planning snapshot, reopen it later, or compare another design before replacing your active plan.</p></div>
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <label className="block text-sm">Project name<input className="input mt-1 block w-full max-w-md" value={name} onChange={e => setName(e.target.value)} /></label>
      <div className="flex flex-wrap gap-3"><button className={button} onClick={() => downloadProject(createProject(state, name))}>Download project</button><button className={button} onClick={() => upload.current?.click()}>Open or compare project</button></div>
      <p className="text-xs text-gray-500">Project files include VM inventory, measurements, import history, specialized workloads, hardware, and volume settings. Keep a downloaded copy; browser storage alone is not a backup.</p>
      <input ref={upload} aria-label="Project JSON file" type="file" accept=".json" className="hidden" onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
        setError(''); setNotice(''); setPending(null)
        try { setPending(parseProject(await file.text())) } catch (err) { setError(err instanceof Error ? err.message : 'Could not open project.') }
      }} />
    </section>
    {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
    {notice && <p className="text-green-700 text-sm" role="status">{notice}</p>}
    {pending && comparison && <section className="rounded-xl border border-brand-300 p-5 space-y-4">
      <h2 className="text-lg font-semibold">Compare: {pending.name}</h2>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="p-2">Metric</th><th className="p-2">Active plan</th><th className="p-2">Opened project</th></tr></thead><tbody>{[
        ['Hardware nodes', state.hardware.nodeCount, pending.inputs.hardware.nodeCount],
        ['Included inventory VMs', state.inventory.filter(vm => vm.include).length, pending.inputs.inventory.filter(vm => vm.include).length],
        ['Workload vCPU', current.demand.totalVCpus, comparison.demand.totalVCpus],
        ['Workload RAM · GiB', current.demand.totalMemoryGB, comparison.demand.totalMemoryGB],
        ['Workload storage · TB', current.demand.totalStorageTB, comparison.demand.totalStorageTB],
        ['Maintenance reserve', state.advanced.maintenanceReserveMode ?? 'none', pending.inputs.advanced.maintenanceReserveMode ?? 'none'],
        ['Inventory sizing', state.inventorySettings.sizingBasis, pending.inputs.inventorySettings.sizingBasis],
        ['Inventory storage basis', state.inventorySettings.storageBasis, pending.inputs.inventorySettings.storageBasis],
        ['Smallest modeled fit · nodes', current.requiredNodes ?? 'None', comparison.requiredNodes ?? 'None'],
      ].map(([label, left, right]) => <tr className="border-b" key={label}><th className="p-2 text-left font-medium">{label}</th><td className="p-2">{left}</td><td className="p-2">{right}</td></tr>)}</tbody></table></div>
      <p className="text-sm">Restoring replaces all inputs in the active plan. Download the active project first if you want to keep both scenarios.</p>
      <div className="flex gap-3"><button className={button} onClick={() => { state.restoreProject(pending.inputs); setName(pending.name); setNotice(`Restored ${pending.name}.`); setPending(null) }}>Restore this project</button><button className={button} onClick={() => setPending(null)}>Keep active plan</button></div>
    </section>}
  </div>
}
