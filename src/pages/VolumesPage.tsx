import { useState } from 'react'
import { ChevronDown, ChevronRight, Wand2, PlusCircle, CheckCircle2, Terminal, CheckCircle, Copy } from 'lucide-react'
import VolumeTable from '../components/VolumeTable'
import HealthCheck from '../components/HealthCheck'
import { useSurveyorStore } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { computeCompute } from '../engine/compute'
import { computeAvd } from '../engine/avd'
import { computeSofs } from '../engine/sofs'
import { computeAks } from '../engine/aks'
import { computeMabs } from '../engine/mabs'
import { computeAllCustomWorkloads } from '../engine/custom-workloads'
import { runHealthCheck } from '../engine/healthcheck'
import { generateWorkloadVolumes, type SuggestedVolume } from '../engine/workload-volumes'
import { computeServicePreset, getCatalogEntry } from '../engine/service-presets'
import { toWacSize, computeQuickStart, generateGenericVolumes, type GenericSuggestion } from '../engine/volumes'

export default function VolumesPage() {
  const state = useSurveyorStore()
  const { hardware, advanced, volumes } = state
  const capacity = computeCapacity(hardware, advanced)
  const compute  = computeCompute(hardware, advanced)
  const avd      = computeAvd(state.avd, state.advanced.overrides)
  const sofs     = computeSofs(state.sofs, state.advanced.overrides)
  const aks      = computeAks(state.aks)
  const mabsResult = computeMabs(state.mabs)

  // Aggregate workload demand from all enabled scenarios for accurate health checks
  let totalVCpus = 0, totalMemoryGB = 0, totalStorageTB = 0
  if (state.avdEnabled)  { totalVCpus += avd.totalVCpus;  totalMemoryGB += avd.totalMemoryGB;  totalStorageTB += avd.totalStorageTB }
  if (state.aks.enabled) { totalVCpus += aks.totalVCpus;  totalMemoryGB += aks.totalMemoryGB;  totalStorageTB += aks.totalStorageTB }
  if (state.virtualMachines?.enabled) {
    const vm = state.virtualMachines
    let rawVmVCpus = 0
    for (const g of vm.groups) {
      rawVmVCpus    += g.vmCount * g.vCpusPerVm
      totalMemoryGB += g.vmCount * g.memoryPerVmGB
      totalStorageTB += (g.vmCount * g.storagePerVmGB) / 1024
    }
    totalVCpus += rawVmVCpus / vm.vCpuOvercommitRatio
  }
  if (state.sofsEnabled) { totalVCpus += sofs.sofsVCpusTotal; totalMemoryGB += sofs.sofsMemoryTotalGB; totalStorageTB += sofs.totalStorageTB }
  if (state.mabsEnabled) { totalVCpus += mabsResult.mabsVCpus; totalMemoryGB += mabsResult.mabsMemoryGB; totalStorageTB += mabsResult.totalStorageTB + mabsResult.mabsOsDiskTB }
  // Arc-dependent presets run on AKS workers — exclude compute when AKS enabled
  for (const inst of state.servicePresets) {
    if (!inst.enabled || inst.instanceCount <= 0) continue
    const entry = getCatalogEntry(inst.catalogId)
    const t = computeServicePreset(inst)
    if (!(state.aks.enabled && entry?.requiresAks)) {
      totalVCpus    += t.totalVCpus
      totalMemoryGB += t.totalMemoryGB
    }
    totalStorageTB += t.totalStorageTB
  }
  const customTotals = computeAllCustomWorkloads(state.customWorkloads)
  totalVCpus    += customTotals.totalVCpus
  totalMemoryGB += customTotals.totalMemoryGB
  totalStorageTB += customTotals.totalStorageTB

  const workloadSummary = {
    totalVCpus: Math.round(totalVCpus),
    totalMemoryGB: Math.round(totalMemoryGB),
    totalStorageTB: Math.round(totalStorageTB * 100) / 100,
  }

  const health = runHealthCheck({ hardware, settings: advanced, volumes, capacity, compute, workloadSummary })

  // #68: generate workload-based volume suggestions
  const suggestions = generateWorkloadVolumes({
    advanced,
    avdEnabled: state.avdEnabled,
    avdResult: avd,
    aksEnabled: state.aks.enabled,
    aksResult: aks,
    aksInputs: state.aks,
    virtualMachines: state.virtualMachines,
    sofsEnabled: state.sofsEnabled,
    sofsInputs: state.sofs,
    sofsResult: sofs,
    mabsEnabled: state.mabsEnabled,
    mabsInputs: state.mabs,
    mabsResult: mabsResult,
    servicePresets: state.servicePresets,
    customWorkloads: state.customWorkloads,
  })

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Volume Detail</h1>
        <p className="text-sm text-gray-500 mt-1">
          Plan your Cluster Shared Volumes with per-volume resiliency and WAC-ready sizes.
          Ports the 95 formulas from the Volume Detail sheet.
        </p>
      </div>

      {/* #76: Volume suggestion mode toggle */}
      <VolumeModeToggle />

      {/* #75: Quick-Start Volumes — hardware-based equal-split reference */}
      <QuickStartVolumes capacity={capacity} />

      {/* #76/#68: Suggestions based on mode */}
      {state.volumeMode === 'workload' && suggestions.length > 0 && (
        <WorkloadVolumeSuggestions suggestions={suggestions} />
      )}
      {state.volumeMode === 'generic' && (
        <GenericVolumeSuggestions capacity={capacity} />
      )}

      <VolumeTable />

      <HealthCheck result={health} />

      {/* #67: Microsoft Recommended Volumes */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Microsoft Recommended Volume Layout</h2>
        <RecommendedVolumes nodeCount={hardware.nodeCount} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Resiliency Reference Guide</h2>
        <ResiliencyGuide nodeCount={hardware.nodeCount} />
      </section>
    </div>
  )
}

// ─── Volume Mode Toggle (#76) ────────────────────────────────────────────────

function VolumeModeToggle() {
  const { volumeMode, setVolumeMode } = useSurveyorStore()
  const isWorkload = volumeMode === 'workload'

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
      <div>
        <div className="text-sm font-medium">Volume Suggestion Mode</div>
        <div className="text-xs text-gray-500 mt-0.5">
          {isWorkload
            ? 'Suggestions generated from enabled workloads (AVD, AKS, VMs, SOFS, MABS).'
            : 'Generic equal-split volumes based on hardware capacity and selected resiliency.'}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-xs ${!isWorkload ? 'font-semibold text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}>Generic</span>
        <button
          onClick={() => setVolumeMode(isWorkload ? 'generic' : 'workload')}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isWorkload ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isWorkload ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className={`text-xs ${isWorkload ? 'font-semibold text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}>Workload</span>
      </div>
    </div>
  )
}

// ─── Generic Volume Suggestions (#76) ────────────────────────────────────────

function GenericVolumeSuggestions({ capacity }: { capacity: import('../engine/types').CapacityResult }) {
  const { volumes, addVolume } = useSurveyorStore()
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [resiliencyOverrides, setResiliencyOverrides] = useState<Record<string, import('../engine/types').ResiliencyType>>({})
  const [provisioningOverrides, setProvisioningOverrides] = useState<Record<string, 'fixed' | 'thin'>>({})
  const suggestions = generateGenericVolumes(capacity)

  if (suggestions.length === 0) return null

  const existingNames = new Set(volumes.map((v) => v.name))

  function getResiliency(s: GenericSuggestion) {
    return resiliencyOverrides[s.id] ?? s.resiliency
  }

  function getProvisioning(s: GenericSuggestion) {
    return provisioningOverrides[s.id] ?? s.provisioning
  }

  function handleAdd(s: GenericSuggestion) {
    if (existingNames.has(s.name) || added.has(s.id)) return
    addVolume({ id: s.id, name: s.name, plannedSizeTB: s.plannedSizeTB, resiliency: getResiliency(s), provisioning: getProvisioning(s) })
    setAdded((prev) => new Set(prev).add(s.id))
  }

  function handleAddAll() {
    for (const s of suggestions) {
      if (!existingNames.has(s.name) && !added.has(s.id)) {
        addVolume({ id: s.id, name: s.name, plannedSizeTB: s.plannedSizeTB, resiliency: getResiliency(s), provisioning: getProvisioning(s) })
        setAdded((prev) => { const next = new Set(prev); next.add(s.id); return next })
      }
    }
  }

  const allAdded = suggestions.every((s) => existingNames.has(s.name) || added.has(s.id))

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold">Suggested Volumes — Generic Hardware-Based</span>
          <span className="text-xs text-gray-500">{suggestions.length} volumes ({capacity.resiliencyFactor > 0 ? Math.round(capacity.resiliencyFactor * 100) + '% efficiency' : ''})</span>
        </div>
        {!allAdded && (
          <button
            onClick={handleAddAll}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-xs font-medium"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add All
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {suggestions.map((s) => {
          const isAdded = existingNames.has(s.name) || added.has(s.id)
          const { wacSizeGB } = toWacSize(s.plannedSizeTB)
          return (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-xs text-gray-500 truncate">{s.description}</div>
              </div>
              {isAdded ? (
                <>
                  <div className="text-xs text-gray-400 shrink-0">{getResiliency(s)}</div>
                  <div className="text-xs text-gray-400 shrink-0">{getProvisioning(s)}</div>
                </>
              ) : (
                <>
                  <select
                    value={getResiliency(s)}
                    onChange={(e) => setResiliencyOverrides((prev) => ({ ...prev, [s.id]: e.target.value as import('../engine/types').ResiliencyType }))}
                    className="text-xs border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 shrink-0"
                  >
                    <option value="two-way-mirror">Two-Way Mirror</option>
                    <option value="three-way-mirror">Three-Way Mirror</option>
                    <option value="dual-parity">Dual Parity</option>
                    <option value="nested-two-way">Nested Two-Way</option>
                  </select>
                  <select
                    value={getProvisioning(s)}
                    onChange={(e) => setProvisioningOverrides((prev) => ({ ...prev, [s.id]: e.target.value as 'fixed' | 'thin' }))}
                    className="text-xs border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 shrink-0"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="thin">Thin</option>
                  </select>
                </>
              )}
              <div className="text-sm font-mono text-right w-20 shrink-0">{s.plannedSizeTB} TiB</div>
              <div className="text-xs font-mono text-gray-400 text-right w-20 shrink-0">{wacSizeGB} GiB</div>
              <div className="w-20 shrink-0 text-right">
                {isAdded ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Added
                  </span>
                ) : (
                  <button
                    onClick={() => handleAdd(s)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-700 rounded hover:bg-brand-50 dark:hover:bg-brand-900/30"
                  >
                    <PlusCircle className="w-3 h-3" /> Add
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500">
        Equal-split layout based on hardware capacity. Switch to Workload mode for workload-specific sizing.
      </div>
    </div>
  )
}

// ─── Quick-Start Volumes (#75) ───────────────────────────────────────────────

function QuickStartVolumes({ capacity }: { capacity: import('../engine/types').CapacityResult }) {
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const qs = computeQuickStart(capacity)

  if (qs.rows.length === 0) return null

  function handleCopy() {
    navigator.clipboard.writeText(qs.psScript).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-semibold text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        Microsoft Best Practice — Volume Reference
        <span className="ml-2 text-xs font-normal text-gray-400">
          {qs.nodeCount}-node cluster · {qs.rows[0].volumeCount} volumes · {qs.availableForVolumesTB.toFixed(2)} TB pool available
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {/* TiB/TB Warning */}
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <strong>IMPORTANT:</strong> Windows, PowerShell, and WAC use TiB (binary), not TB (decimal).
              The <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">-Size</code> parameter in PowerShell interprets "TB" as TiB.
              1 TB ≈ 0.909 TiB. Volume sizes include a 1 GiB safety margin to prevent WAC errors.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              Microsoft recommends volume count as a multiple of your node count ({qs.nodeCount}).
              These two rows show equal-split layouts for the two most common resiliency types.
            </p>
          </div>

          {/* Table — two reference rows (3WM + 2WM) */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-left text-xs">
                  <th className="px-4 py-2 font-semibold text-center"># Volumes</th>
                  <th className="px-4 py-2 font-semibold">Resiliency</th>
                  <th className="px-4 py-2 font-semibold text-right">Eff. Size / Vol (TB)</th>
                  <th className="px-4 py-2 font-semibold text-right bg-yellow-100 dark:bg-yellow-900/30">WAC / PS Size (GiB)</th>
                  <th className="px-4 py-2 font-semibold text-right">Pool Footprint (TB)</th>
                  <th className="px-4 py-2 font-semibold text-right">Usable Total (TB)</th>
                  <th className="px-4 py-2 font-semibold text-right">Pool Used %</th>
                </tr>
              </thead>
              <tbody>
                {qs.rows.map((row) => (
                  <tr key={row.resiliency} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2 text-center font-semibold">{row.volumeCount}</td>
                    <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">{row.resiliencyLabel}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-500">{row.calculatorSizeTB.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-brand-700 dark:text-brand-300 bg-yellow-50 dark:bg-yellow-900/20">{row.wacSizeGiB}</td>
                    <td className="px-4 py-2 text-right font-mono">{row.poolFootprintTB.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono">{row.usableTotalTB.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-500">{row.utilizationPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PowerShell Quick Create — uses 3WM row */}
          <div className="border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between bg-[#012456] px-4 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-200">
                <Terminal className="w-3.5 h-3.5" />
                POWERSHELL — THREE-WAY MIRROR QUICK CREATE
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-300 hover:text-white border border-blue-700 rounded hover:bg-blue-800 transition-colors"
              >
                {copied ? <><CheckCircle className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
              </button>
            </div>
            <pre className="bg-[#012456] text-blue-100 px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {qs.psScript}
            </pre>
          </div>

          {/* Footer notes */}
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 space-y-1.5">
            <p>
              <strong className="text-gray-700 dark:text-gray-300">Reference only</strong> — these numbers do not feed into the Workload Planner or Capacity Report.
              Use them to see your cluster's raw capability as balanced equal-sized volumes (1 per node, up to 16).
              Max 64 TB per volume per Azure Local limits.
            </p>
            <p className="text-gray-400">
              References:{' '}
              <a href="https://learn.microsoft.com/azure-stack/hci/concepts/plan-volumes" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600 dark:hover:text-gray-300">Plan volumes (Microsoft Learn)</a>
              {' · '}
              <a href="https://learn.microsoft.com/azure-stack/hci/concepts/fault-tolerance" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600 dark:hover:text-gray-300">Fault tolerance and storage efficiency</a>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Workload Volume Suggestions (#68) ───────────────────────────────────────

function WorkloadVolumeSuggestions({ suggestions }: { suggestions: SuggestedVolume[] }) {
  const { volumes, addVolume } = useSurveyorStore()
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [resiliencyOverrides, setResiliencyOverrides] = useState<Record<string, import('../engine/types').ResiliencyType>>({})
  const [provisioningOverrides, setProvisioningOverrides] = useState<Record<string, 'fixed' | 'thin'>>({})

  // Check which suggestions already exist in the volume list (by name)
  const existingNames = new Set(volumes.map((v) => v.name))

  function getResiliency(s: SuggestedVolume) {
    return resiliencyOverrides[s.id] ?? s.resiliency
  }

  function getProvisioning(s: SuggestedVolume) {
    return provisioningOverrides[s.id] ?? s.provisioning
  }

  function handleAdd(s: SuggestedVolume) {
    if (existingNames.has(s.name) || added.has(s.id)) return
    addVolume({ id: s.id, name: s.name, plannedSizeTB: s.plannedSizeTB, resiliency: getResiliency(s), provisioning: getProvisioning(s) })
    setAdded((prev) => new Set(prev).add(s.id))
  }

  function handleAddAll() {
    for (const s of suggestions) {
      if (!existingNames.has(s.name) && !added.has(s.id)) {
        addVolume({ id: s.id, name: s.name, plannedSizeTB: s.plannedSizeTB, resiliency: getResiliency(s), provisioning: getProvisioning(s) })
        setAdded((prev) => { const next = new Set(prev); next.add(s.id); return next })
      }
    }
  }

  // Group by source
  const grouped = new Map<string, SuggestedVolume[]>()
  for (const s of suggestions) {
    const list = grouped.get(s.source) ?? []
    list.push(s)
    grouped.set(s.source, list)
  }

  const allAdded = suggestions.every((s) => existingNames.has(s.name) || added.has(s.id))

  return (
    <div className="rounded-lg border border-brand-200 dark:border-brand-800 overflow-hidden">
      <div className="flex items-center justify-between bg-brand-50 dark:bg-brand-900/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <span className="text-sm font-semibold">Suggested Volumes from Workloads</span>
          <span className="text-xs text-gray-500">{suggestions.length} volumes</span>
        </div>
        {!allAdded && (
          <button
            onClick={handleAddAll}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-xs font-medium"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add All
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {[...grouped.entries()].map(([source, items]) => (
          <div key={source}>
            <div className="px-4 py-1.5 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {source}
            </div>
            {items.map((s) => {
              const isAdded = existingNames.has(s.name) || added.has(s.id)
              const { wacSizeGB } = toWacSize(s.plannedSizeTB)
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-gray-500 truncate">{s.description}</div>
                  </div>
                  {isAdded ? (
                    <>
                      <div className="text-xs text-gray-400 shrink-0">{getResiliency(s)}</div>
                      <div className="text-xs text-gray-400 shrink-0">{getProvisioning(s)}</div>
                    </>
                  ) : (
                    <>
                      <select
                        value={getResiliency(s)}
                        onChange={(e) => setResiliencyOverrides((prev) => ({ ...prev, [s.id]: e.target.value as import('../engine/types').ResiliencyType }))}
                        className="text-xs border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 shrink-0"
                      >
                        <option value="two-way-mirror">Two-Way Mirror</option>
                        <option value="three-way-mirror">Three-Way Mirror</option>
                        <option value="dual-parity">Dual Parity</option>
                        <option value="nested-two-way">Nested Two-Way</option>
                      </select>
                      <select
                        value={getProvisioning(s)}
                        onChange={(e) => setProvisioningOverrides((prev) => ({ ...prev, [s.id]: e.target.value as 'fixed' | 'thin' }))}
                        className="text-xs border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 shrink-0"
                      >
                        <option value="fixed">Fixed</option>
                        <option value="thin">Thin</option>
                      </select>
                    </>
                  )}
                  <div className="text-sm font-mono text-right w-20 shrink-0">{s.plannedSizeTB} TiB</div>
                  <div className="text-xs font-mono text-gray-400 text-right w-20 shrink-0">{wacSizeGB} GiB</div>
                  <div className="w-20 shrink-0 text-right">
                    {isAdded ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Added
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(s)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-700 rounded hover:bg-brand-50 dark:hover:bg-brand-900/30"
                      >
                        <PlusCircle className="w-3 h-3" /> Add
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500">
        Generated from enabled workloads. SOFS and MABS volumes include internal mirror footprint.
        Review sizes and resiliency before adding.
      </div>
    </div>
  )
}

// ─── Microsoft Recommended Volume Layout (#67) ──────────────────────────────

const RECOMMENDED_VOLUMES = [
  {
    name: 'Infrastructure',
    resiliency: 'Three-Way Mirror',
    sizing: '~250 GB (created automatically)',
    purpose: 'Azure Local system CSV for cluster operations, health service, and Arc registration data.',
    notes: 'Created during cluster setup. Do not delete or resize.',
  },
  {
    name: 'VM OS / Boot',
    resiliency: 'Three-Way Mirror',
    sizing: 'VMs × OS disk size',
    purpose: 'Stores VM boot VHDXs. Mirror resiliency ensures VMs survive drive failures without latency impact.',
    notes: 'Parity causes high write latency on random I/O — never use for OS volumes.',
  },
  {
    name: 'VM Data / Workloads',
    resiliency: 'Three-Way Mirror or Dual Parity',
    sizing: 'Based on workload demand',
    purpose: 'Application data, databases, file shares. Mirror for IOPS-sensitive; parity for sequential/cold.',
    notes: 'Separate from OS volume so resiliency and sizing can be tuned independently.',
  },
  {
    name: 'Backup / Archive',
    resiliency: 'Dual Parity',
    sizing: 'Protected data × retention × change rate',
    purpose: 'MABS or third-party backup targets. Sequential writes — ideal for parity efficiency.',
    notes: 'Consider Azure offload for long-term retention beyond 14 days.',
  },
  {
    name: 'FSLogix Profiles',
    resiliency: 'Three-Way Mirror',
    sizing: 'Users × profile size × growth',
    purpose: 'FSLogix profile VHDXs for AVD or SOFS. Random I/O during logon storms requires mirror.',
    notes: 'If SOFS is used, profile VHDXs live inside the SOFS guest cluster, not directly on this volume.',
  },
  {
    name: 'Kubernetes PVC',
    resiliency: 'Three-Way Mirror',
    sizing: 'Based on persistent volume claims',
    purpose: 'AKS on Azure Local persistent storage. Container workloads need consistent low-latency I/O.',
    notes: 'AKS CSI driver creates sub-volumes automatically from this pool.',
  },
]

function RecommendedVolumes({ nodeCount }: { nodeCount: number }) {
  const [open, setOpen] = useState(true)
  const hasParity = nodeCount >= 4

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-semibold text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        Microsoft Recommended Volume Layout
        <span className="ml-2 text-xs font-normal text-gray-400">{RECOMMENDED_VOLUMES.length} volumes</span>
      </button>
      {open && (
        <>
          <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800">
            Reference layout based on Microsoft Azure Local deployment guidance.
            Actual volumes depend on your workloads — use the workload suggestions above for calculated sizes.
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left border-t border-gray-100 dark:border-gray-800">
                <th className="px-4 py-2 font-semibold">Volume</th>
                <th className="px-4 py-2 font-semibold">Resiliency</th>
                <th className="px-4 py-2 font-semibold">Sizing</th>
                <th className="px-4 py-2 font-semibold">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {RECOMMENDED_VOLUMES.map((v) => {
                const needsParity = v.resiliency.includes('Dual Parity')
                const dimmed = needsParity && !hasParity
                return (
                  <tr key={v.name} className={`border-t border-gray-100 dark:border-gray-800 ${dimmed ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2 font-medium">
                      {v.name}
                      {dimmed && <span className="block text-xs text-red-500">needs 4+ nodes for parity</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{v.resiliency}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{v.sizing}</td>
                    <td className="px-4 py-2">
                      <div className="text-xs text-gray-600 dark:text-gray-400">{v.purpose}</div>
                      <div className="text-xs text-gray-400 italic mt-0.5">{v.notes}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

// ─── Resiliency Reference Guide (#11) ────────────────────────────────────────

const RESILIENCY_GUIDE = [
  {
    type: 'Two-Way Mirror',
    minNodes: 2,
    efficiency: '50%',
    footprint: '2× volume size',
    useCase: 'Development, test, non-critical workloads. 1 simultaneous failure tolerated.',
    advisory: 'Not recommended for production — loss of 2 drives (different nodes) can cause data loss.',
    color: 'amber',
  },
  {
    type: 'Three-Way Mirror',
    minNodes: 3,
    efficiency: '33%',
    footprint: '3× volume size',
    useCase: 'Production VMs, OS volumes, databases. 2 simultaneous failures tolerated.',
    advisory: 'Recommended default for all production workloads in Azure Local.',
    color: 'green',
  },
  {
    type: 'Dual Parity',
    minNodes: 4,
    efficiency: '50–80%',
    footprint: '1.25–2× volume size',
    useCase: 'Bulk storage, archives, cold data. Highest storage efficiency.',
    advisory: 'Higher write latency than mirror. Not suitable for IOPS-sensitive workloads or boot volumes.',
    color: 'blue',
  },
  {
    type: 'Nested Two-Way Mirror',
    minNodes: 2,
    efficiency: '25%',
    footprint: '4× volume size',
    useCase: '2-node clusters only. Protects against both node and drive failure simultaneously.',
    advisory: 'Required for 2-node Azure Local to maintain data availability during node failure.',
    color: 'purple',
  },
]

function ResiliencyGuide({ nodeCount }: { nodeCount: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-semibold text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        Resiliency Types — Node Count, Efficiency, and Use Cases
        <span className="ml-2 text-xs font-normal text-gray-400">4 types</span>
      </button>
      {open && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
          {RESILIENCY_GUIDE.map((r) => {
            const eligible = nodeCount >= r.minNodes
            return (
              <div key={r.type} className={`px-4 py-4 ${!eligible ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <span className="text-sm font-semibold">{r.type}</span>
                    {!eligible && (
                      <span className="ml-2 text-xs text-red-500">requires {r.minNodes} nodes — your cluster has {nodeCount}</span>
                    )}
                  </div>
                  <div className="text-right shrink-0 text-xs text-gray-500 space-y-0.5">
                    <div>Efficiency: <strong>{r.efficiency}</strong></div>
                    <div>Footprint: <strong>{r.footprint}</strong></div>
                    <div>Min nodes: <strong>{r.minNodes}</strong></div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{r.useCase}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">{r.advisory}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
