import { useMemo, useRef, useState } from 'react'
import { useSurveyorStore } from '../state/store'
import { computeInventory, WORKLOAD_TIERS, type InventoryVm, type WorkloadTier } from '../engine/inventory'
import { attachPerformanceWorkbook, parseInventoryWorkbook, performanceTemplate } from '../engine/inventory-import'

const format = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 })
const button = 'rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40'
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}

export default function InventoryPlanner() {
  const { inventory, inventorySettings, inventorySources, setInventory, setInventorySettings, addInventorySource } = useSurveyorStore()
  const upload = useRef<HTMLInputElement>(null)
  const performanceUpload = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<string[]>([])
  const [pending, setPending] = useState<(ReturnType<typeof parseInventoryWorkbook> & { fileName: string }) | null>(null)
  const [search, setSearch] = useState('')
  const [tier, setTier] = useState<WorkloadTier | 'all'>('all')
  const [bulkTier, setBulkTier] = useState<WorkloadTier>('general')
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(1)
  const [busy, setBusy] = useState(false)
  const result = useMemo(() => computeInventory(inventory, inventorySettings), [inventory, inventorySettings])
  const filtered = useMemo(() => inventory.filter(vm => (tier === 'all' || vm.tier === tier) && `${vm.name} ${vm.guestOs} ${vm.sourceCluster} ${vm.sourceHost}`.toLowerCase().includes(search.trim().toLowerCase())), [inventory, tier, search])
  const pages = Math.max(1, Math.ceil(filtered.length / 50))
  const currentPage = Math.min(page, pages - 1)
  const shown = filtered.slice(currentPage * 50, currentPage * 50 + 50)
  function patch(id: string, change: Partial<InventoryVm>) { setInventory(inventory.map(vm => vm.id === id ? { ...vm, ...change } : vm)) }
  function patchFiltered(change: Partial<InventoryVm>) {
    const ids = new Set(filtered.map(vm => vm.id))
    setInventory(inventory.map(vm => ids.has(vm.id) ? { ...vm, ...change } : vm))
  }
  async function importFile(file: File, performance: boolean) {
    setBusy(true); setError(''); setNotice([])
    try {
      const bytes = await file.arrayBuffer()
      if (performance) {
        const parsed = attachPerformanceWorkbook(inventory, bytes)
        setInventory(parsed.vms)
        if (parsed.matched) addInventorySource({ kind: 'performance', fileName: file.name, rows: parsed.rows, importedAt: new Date().toISOString() })
        setNotice([`Attached measurements to ${parsed.matched} VMs.`, ...parsed.warnings])
      } else setPending({ ...parseInventoryWorkbook(bytes), fileName: file.name })
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to read this file.') }
    finally { setBusy(false) }
  }
  function addManual() {
    const added: InventoryVm[] = Array.from({ length: count }, (_, index) => ({
      id: crypto.randomUUID(), name: `VM-${inventory.length + index + 1}`, tier: bulkTier, include: true,
      vCpu: 4, memoryGiB: 16, consumedGiB: 100, provisionedGiB: 200,
      powerState: 'unknown', sourceCluster: '', sourceHost: '', guestOs: '', reviewed: true,
    }))
    setInventory([...inventory, ...added]); setPage(Math.floor(inventory.length / 50)); setSearch(''); setTier('all')
  }
  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-5">
      <div>
        <h2 className="text-xl font-semibold">VM inventory</h2>
        <p className="text-sm text-gray-500 mt-1">Import an estate or add individual VMs. Included rows contribute alongside the specialized planners below. Avoid entering the same machines in both places.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => upload.current?.click()}>Import RVTools</button>
        <button className={button} disabled={busy || !inventory.length} onClick={() => performanceUpload.current?.click()}>Attach performance</button>
        <button className={button} disabled={!inventory.length} onClick={() => download('azurelocal-performance-template.csv', performanceTemplate(inventory))}>Performance template</button>
        <label className="flex items-center gap-2 text-sm">VM count<input aria-label="Manual VM count" className="input w-20" type="number" min={1} max={1000} value={count} onChange={e => { const n = +e.target.value; if (Number.isFinite(n)) setCount(Math.min(1000, Math.max(1, Math.floor(n)))) }} /></label>
        <button className={button} disabled={busy} onClick={addManual}>Add {count} VM{count === 1 ? '' : 's'}</button>
      </div>
      <input aria-label="RVTools file" ref={upload} className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file, false); e.target.value = '' }} />
      <input aria-label="Performance file" ref={performanceUpload} className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file, true); e.target.value = '' }} />
      {busy && <p role="status" className="text-sm">Reading file…</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {pending && <div className="rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950 p-4 space-y-3">
        <p className="font-medium">Review import: {pending.vms.length} VMs from {pending.fileName}</p>
        <p className="text-sm">{pending.skipped} templates or platform placeholders skipped. This replaces the {inventory.length} inventory rows currently in the plan. Specialized workload groups remain separate.</p>
        <ul className="text-sm list-disc pl-5 max-h-36 overflow-auto">{pending.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
        <div className="flex gap-2"><button className={button} onClick={() => {
          setInventory(pending.vms); addInventorySource({ kind: 'rvtools', fileName: pending.fileName, importedAt: new Date().toISOString(), rows: pending.rows });
          setNotice([`Imported ${pending.vms.length} VMs. Review inclusion and tiers before using the fit assessment.`]); setPending(null); setPage(0)
        }}>Use this inventory</button><button className={button} onClick={() => setPending(null)}>Cancel import</button></div>
      </div>}
      {notice.length > 0 && <ul role="status" className="text-sm list-disc pl-5 max-h-36 overflow-auto">{notice.map((line, index) => <li key={index}>{line}</li>)}</ul>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[[`${result.includedCount} / ${result.totalCount}`, 'VMs included'], [format(result.allocatedVCpus), 'Allocated vCPU'], [format(result.allocatedMemoryGiB), 'Allocated RAM · GiB'], [`${format(result.consumedGiB / 1024)} / ${format(result.provisionedGiB / 1024)}`, 'Consumed / provisioned · TiB']].map(([value, label]) => <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3"><div className="text-lg font-semibold">{value}</div><div className="text-xs text-gray-500">{label}</div></div>)}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <label>Sizing basis<select className="input w-full mt-1" value={inventorySettings.sizingBasis} onChange={e => setInventorySettings({ sizingBasis: e.target.value as 'allocation' | 'measured-p95' })}><option value="allocation">Allocated CPU and RAM</option><option value="measured-p95">Measured P95</option></select></label>
        <label>Storage basis<select className="input w-full mt-1" value={inventorySettings.storageBasis} onChange={e => setInventorySettings({ storageBasis: e.target.value as 'provisioned' | 'consumed' })}><option value="provisioned">Provisioned</option><option value="consumed">Consumed</option></select></label>
        <label>P95 safety multiplier<input className="input w-full mt-1" type="number" min={1} max={3} step={.05} value={inventorySettings.comfortFactor} onChange={e => setInventorySettings({ comfortFactor: +e.target.value })} /></label>
        <label>Inventory growth · %<input className="input w-full mt-1" type="number" min={0} max={500} value={inventorySettings.growthPct} onChange={e => setInventorySettings({ growthPct: +e.target.value })} /></label>
      </div>
      <div className="text-sm space-y-1 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
        <p><strong>Planned inventory demand:</strong> {format(result.totalVCpus)} vCPU · {format(result.totalMemoryGB)} GiB RAM · {format(result.totalStorageTB)} TB storage (decimal).</p>
        <p>Performance evidence: {result.confidence} · {result.confidenceScore}/100. CPU coverage {format(result.cpuCoveragePct)}%, memory {format(result.memoryCoveragePct)}%, storage {format(result.storageCoveragePct)}%, 7+ days {format(result.observationCoveragePct)}%.</p>
        {inventorySettings.sizingBasis === 'measured-p95' && <p>Allocation fallback: {result.cpuFallbackCount} VMs for CPU; {result.memoryFallbackCount} for memory. Measured sizing assumes approved right-sizing, with a 5% minimum demand floor.</p>}
        {inventorySettings.storageBasis === 'consumed' && <p className="text-amber-700 dark:text-amber-400">Consumed sizing assumes thin provisioning or disk reclamation. Provisioned growth is not automatically reserved.</p>}
        <p className="text-xs text-gray-500">Confidence thresholds, safety multiplier, and growth are planning assumptions. CPU overcommit is applied only by Advanced Settings for this inventory. IOPS evidence is informational; storage performance has not been validated.</p>
      </div>
      {inventory.length > 0 && <>
        <div className="flex flex-wrap gap-2 items-end text-sm">
          <label className="flex-1 min-w-48">Search inventory<input className="input w-full mt-1" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="VM, operating system, cluster, host" /></label>
          <label>Filter tier<select className="input block mt-1" value={tier} onChange={e => { setTier(e.target.value as WorkloadTier | 'all'); setPage(0) }}><option value="all">All tiers</option>{WORKLOAD_TIERS.map(t => <option key={t}>{t}</option>)}</select></label>
          <button className={button} onClick={() => patchFiltered({ include: true })}>Include filtered</button><button className={button} onClick={() => patchFiltered({ include: false })}>Exclude filtered</button>
          <label>Assign tier<select className="input block mt-1" value={bulkTier} onChange={e => setBulkTier(e.target.value as WorkloadTier)}>{WORKLOAD_TIERS.map(t => <option key={t}>{t}</option>)}</select></label>
          <button className={button} onClick={() => patchFiltered({ tier: bulkTier, reviewed: true })}>Apply to filtered</button>
          <button className={button} onClick={() => patchFiltered({ reviewed: true })}>Mark filtered reviewed</button>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><caption className="sr-only">Editable VM inventory; storage and memory are in GiB</caption>
          <thead><tr className="text-left"><th className="p-2">Include</th><th className="p-2">VM / source</th><th className="p-2">Tier</th><th className="p-2">vCPU</th><th className="p-2">RAM GiB</th><th className="p-2">Used GiB</th><th className="p-2">Prov. GiB</th><th className="p-2">Power</th><th className="p-2">Action</th></tr></thead>
          <tbody>{shown.map(vm => <tr key={vm.id} className="border-t border-gray-200 dark:border-gray-700">
            <td className="p-2"><input type="checkbox" aria-label={`Include ${vm.name}`} checked={vm.include} onChange={e => patch(vm.id, { include: e.target.checked })} /></td>
            <td className="p-2 min-w-40"><input className="input w-full" aria-label={`Name ${vm.name}`} value={vm.name} onChange={e => { if (e.target.value.trim()) patch(vm.id, { name: e.target.value }) }} /><span className="block text-gray-500 mt-1">{[vm.sourceCluster, vm.sourceHost, vm.guestOs].filter(Boolean).join(' · ') || 'Manual entry'}{!vm.reviewed && ' · Review needed'}</span></td>
            <td className="p-2"><select className="input" aria-label={`Tier ${vm.name}`} value={vm.tier} onChange={e => patch(vm.id, { tier: e.target.value as WorkloadTier, reviewed: true })}>{WORKLOAD_TIERS.map(t => <option key={t}>{t}</option>)}</select></td>
            {(['vCpu', 'memoryGiB', 'consumedGiB', 'provisionedGiB'] as const).map(key => <td className="p-2" key={key}><input className="input w-20" aria-label={`${key} ${vm.name}`} type="number" min={key === 'vCpu' || key === 'memoryGiB' ? 1 : 0} value={vm[key]} onChange={e => {
              const n = Number(e.target.value)
              if (!Number.isFinite(n) || n < 0 || ((key === 'vCpu' || key === 'memoryGiB') && n === 0)) return
              if (key === 'consumedGiB') patch(vm.id, { consumedGiB: n, provisionedGiB: Math.max(vm.provisionedGiB, n) })
              else if (key === 'provisionedGiB') patch(vm.id, { provisionedGiB: Math.max(vm.consumedGiB, n) })
              else patch(vm.id, { [key]: n })
            }} /></td>)}
            <td className="p-2">{vm.powerState}</td><td className="p-2"><button className="text-red-600" aria-label={`Remove ${vm.name}`} onClick={() => setInventory(inventory.filter(row => row.id !== vm.id))}>Remove</button></td>
          </tr>)}</tbody></table></div>
        <div className="flex items-center justify-between text-sm"><span>{filtered.length} matching VMs · page {currentPage + 1} of {pages}</span><div className="flex gap-2"><button className={button} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><button className={button} disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
      </>}
      {inventorySources.length > 0 && <details className="text-xs text-gray-500"><summary className="cursor-pointer">Import history ({inventorySources.length})</summary><ul className="mt-2 space-y-1">{inventorySources.map((source, i) => <li key={i}>{source.kind} · {source.fileName} · {source.rows} rows · {new Date(source.importedAt).toLocaleString()}</li>)}</ul></details>}
    </section>
  )
}
