/**
 * CustomWorkloads — manual-entry and JSON-import workload cards (#80).
 *
 * Each custom workload contributes vCPU, memory, OS-disk, and storage
 * demand to the Workload Planner aggregate totals. Supports internal
 * mirror compounding (like SOFS/MABS) for accurate volume suggestions.
 */
import { useState, useRef } from 'react'
import { Trash2, Plus, ChevronDown, ChevronUp, Download, Upload } from 'lucide-react'
import { useSurveyorStore } from '../state/store'
import type { CustomWorkload } from '../engine/types'
import type { ResiliencyType } from '../engine/types'

const RESILIENCY_LABELS: Record<ResiliencyType, string> = {
  'three-way-mirror': 'Three-Way Mirror (33%)',
  'two-way-mirror':   'Two-Way Mirror (50%)',
  'dual-parity':      'Dual Parity (50–80%)',
  'nested-two-way':   'Nested Two-Way (25%)',
}

const JSON_TEMPLATE: CustomWorkload = {
  id: 'example',
  name: 'My Custom Workload',
  description: 'Optional description of what this workload does',
  enabled: true,
  vmCount: 3,
  vCpusPerVm: 8,
  memoryPerVmGB: 32,
  osDiskPerVmGB: 200,
  storageTB: 10,
  resiliency: 'three-way-mirror',
  internalMirrorFactor: 1,
  bandwidthMbps: 0,
}

function newWorkload(): CustomWorkload {
  return {
    id: `cw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Custom Workload',
    description: '',
    enabled: true,
    vmCount: 1,
    vCpusPerVm: 4,
    memoryPerVmGB: 16,
    osDiskPerVmGB: 200,
    storageTB: 1,
    resiliency: 'three-way-mirror',
    internalMirrorFactor: 1,
    bandwidthMbps: 0,
  }
}

function computeTotals(w: CustomWorkload) {
  const totalVCpus   = w.vmCount * w.vCpusPerVm
  const totalMemGB   = w.vmCount * w.memoryPerVmGB
  const osDiskTB     = (w.vmCount * w.osDiskPerVmGB) / 1024
  const storageTB    = w.storageTB
  const totalStorageTB = osDiskTB + storageTB
  return { totalVCpus, totalMemGB, osDiskTB, storageTB, totalStorageTB }
}

export function computeAllCustomWorkloads(workloads: CustomWorkload[]) {
  let totalVCpus = 0, totalMemoryGB = 0, totalStorageTB = 0
  for (const w of workloads) {
    if (!w.enabled) continue
    const t = computeTotals(w)
    totalVCpus    += t.totalVCpus
    totalMemoryGB += t.totalMemGB
    totalStorageTB += t.totalStorageTB
  }
  return {
    totalVCpus,
    totalMemoryGB,
    totalStorageTB: Math.round(totalStorageTB * 100) / 100,
  }
}

export default function CustomWorkloads() {
  const { customWorkloads, addCustomWorkload, updateCustomWorkload, removeCustomWorkload } = useSurveyorStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const totals = computeAllCustomWorkloads(customWorkloads)
  const enabledCount = customWorkloads.filter((w) => w.enabled).length

  function handleDownloadTemplate() {
    const { id: _id, ...template } = JSON_TEMPLATE
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'custom-workload-template.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportJson(text: string) {
    setImportError(null)
    try {
      const parsed = JSON.parse(text)
      // Support both single object and array
      const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed]
      let imported = 0
      for (const item of items) {
        if (typeof item !== 'object' || item === null) continue
        const obj = item as Record<string, unknown>
        const wl: CustomWorkload = {
          id: `cw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name:             typeof obj.name === 'string'            ? obj.name             : 'Imported Workload',
          description:      typeof obj.description === 'string'     ? obj.description      : '',
          enabled:          typeof obj.enabled === 'boolean'        ? obj.enabled          : true,
          vmCount:          typeof obj.vmCount === 'number'         ? obj.vmCount          : 1,
          vCpusPerVm:       typeof obj.vCpusPerVm === 'number'      ? obj.vCpusPerVm       : 4,
          memoryPerVmGB:    typeof obj.memoryPerVmGB === 'number'   ? obj.memoryPerVmGB    : 16,
          osDiskPerVmGB:    typeof obj.osDiskPerVmGB === 'number'   ? obj.osDiskPerVmGB    : 200,
          storageTB:        typeof obj.storageTB === 'number'       ? obj.storageTB        : 0,
          resiliency:       isResiliency(obj.resiliency)            ? obj.resiliency       : 'three-way-mirror',
          internalMirrorFactor: typeof obj.internalMirrorFactor === 'number' ? obj.internalMirrorFactor : 1,
          bandwidthMbps:    typeof obj.bandwidthMbps === 'number'   ? obj.bandwidthMbps    : 0,
        }
        addCustomWorkload(wl)
        imported++
      }
      if (imported === 0) setImportError('No valid workload objects found in JSON.')
    } catch {
      setImportError('Invalid JSON. Check the format and try again.')
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => handleImportJson(ev.target?.result as string)
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-3">
      {/* Import toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          JSON template
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Import JSON
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileUpload} />
      </div>

      {importError && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">{importError}</p>
      )}

      {/* Workload list */}
      {customWorkloads.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          No custom workloads defined yet. Add one manually or import from JSON.
        </p>
      )}

      {customWorkloads.map((wl) => {
        const t = computeTotals(wl)
        const isExpanded = expandedId === wl.id

        return (
          <div
            key={wl.id}
            className={`rounded-lg border ${wl.enabled ? 'border-brand-300 dark:border-brand-700' : 'border-gray-200 dark:border-gray-700'} overflow-hidden`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => updateCustomWorkload(wl.id, { enabled: !wl.enabled })}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${wl.enabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${wl.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm font-semibold truncate">{wl.name || 'Unnamed workload'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {wl.enabled && (
                  <span className="text-xs text-gray-500 hidden sm:inline">
                    {t.totalVCpus} vCPU · {t.totalMemGB} GB · {t.totalStorageTB.toFixed(2)} TB
                  </span>
                )}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : wl.id)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => removeCustomWorkload(wl.id)}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded editor */}
            {isExpanded && (
              <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-700 space-y-3">
                {/* Name + description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Workload name">
                    <input
                      type="text"
                      className="input w-full"
                      value={wl.name}
                      onChange={(e) => updateCustomWorkload(wl.id, { name: e.target.value })}
                    />
                  </Field>
                  <Field label="Description (optional)">
                    <input
                      type="text"
                      className="input w-full"
                      value={wl.description}
                      placeholder="e.g. 3-node backup cluster"
                      onChange={(e) => updateCustomWorkload(wl.id, { description: e.target.value })}
                    />
                  </Field>
                </div>

                {/* Compute */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field label="VM count">
                    <input type="number" min={1} className="input w-full" value={wl.vmCount}
                      onChange={(e) => updateCustomWorkload(wl.id, { vmCount: Math.max(1, +e.target.value || 1) })} />
                  </Field>
                  <Field label="vCPUs / VM">
                    <input type="number" min={1} className="input w-full" value={wl.vCpusPerVm}
                      onChange={(e) => updateCustomWorkload(wl.id, { vCpusPerVm: Math.max(1, +e.target.value || 1) })} />
                  </Field>
                  <Field label="RAM / VM (GB)">
                    <input type="number" min={1} className="input w-full" value={wl.memoryPerVmGB}
                      onChange={(e) => updateCustomWorkload(wl.id, { memoryPerVmGB: Math.max(1, +e.target.value || 1) })} />
                  </Field>
                  <Field label="OS disk / VM (GB)" hint="0 = none">
                    <input type="number" min={0} className="input w-full" value={wl.osDiskPerVmGB}
                      onChange={(e) => updateCustomWorkload(wl.id, { osDiskPerVmGB: Math.max(0, +e.target.value || 0) })} />
                  </Field>
                </div>

                {/* Storage */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Logical storage (TB)" hint="before resiliency">
                    <input type="number" min={0} step={0.1} className="input w-full" value={wl.storageTB}
                      onChange={(e) => updateCustomWorkload(wl.id, { storageTB: Math.max(0, +e.target.value || 0) })} />
                  </Field>
                  <Field label="Resiliency">
                    <select className="input w-full" value={wl.resiliency}
                      onChange={(e) => updateCustomWorkload(wl.id, { resiliency: e.target.value as ResiliencyType })}>
                      {Object.entries(RESILIENCY_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Internal mirror factor" hint="1=none, 2=two-way, 3=three-way">
                    <select className="input w-full" value={wl.internalMirrorFactor}
                      onChange={(e) => updateCustomWorkload(wl.id, { internalMirrorFactor: +e.target.value })}>
                      <option value={1}>1× (no internal mirror)</option>
                      <option value={2}>2× (two-way mirror)</option>
                      <option value={3}>3× (three-way mirror)</option>
                    </select>
                  </Field>
                </div>

                <Field label="Bandwidth estimate (Mbps)" hint="0 = not specified" className="max-w-xs">
                  <input type="number" min={0} className="input w-full" value={wl.bandwidthMbps}
                    onChange={(e) => updateCustomWorkload(wl.id, { bandwidthMbps: Math.max(0, +e.target.value || 0) })} />
                </Field>

                {/* Per-workload totals */}
                {wl.enabled && (
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700">
                    <span>Total vCPUs: <strong className="text-gray-900 dark:text-white">{t.totalVCpus}</strong></span>
                    <span>Total RAM: <strong className="text-gray-900 dark:text-white">{t.totalMemGB} GB</strong></span>
                    {t.osDiskTB > 0 && (
                      <span>OS disk: <strong className="text-gray-900 dark:text-white">{t.osDiskTB.toFixed(2)} TB</strong></span>
                    )}
                    <span>
                      Storage footprint: <strong className="text-gray-900 dark:text-white">
                        {wl.internalMirrorFactor > 1
                          ? `${wl.storageTB} TB × ${wl.internalMirrorFactor} mirror = ${(wl.storageTB * wl.internalMirrorFactor).toFixed(2)} TB`
                          : `${t.storageTB} TB`}
                      </strong>
                    </span>
                    {wl.bandwidthMbps > 0 && (
                      <span>Bandwidth: <strong className="text-gray-900 dark:text-white">{wl.bandwidthMbps} Mbps</strong></span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add button */}
      <button
        onClick={() => {
          const wl = newWorkload()
          addCustomWorkload(wl)
          setExpandedId(wl.id)
        }}
        className="flex items-center gap-2 px-3 py-2 text-sm text-brand-700 dark:text-brand-400 border border-dashed border-brand-300 dark:border-brand-700 rounded-lg w-full hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add custom workload
      </button>

      {/* Aggregate totals */}
      {customWorkloads.length > 0 && (
        <div className="pt-1 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 text-xs text-gray-500">
          <span>
            {enabledCount} of {customWorkloads.length} workload{customWorkloads.length !== 1 ? 's' : ''} enabled
          </span>
          {enabledCount > 0 && (
            <>
              <span>·</span>
              <span>Total vCPUs: <strong className="text-gray-900 dark:text-white">{totals.totalVCpus}</strong></span>
              <span>Total RAM: <strong className="text-gray-900 dark:text-white">{totals.totalMemoryGB} GB</strong></span>
              <span>Total storage: <strong className="text-gray-900 dark:text-white">{totals.totalStorageTB} TB</strong></span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
        {label}
        {hint && <span className="ml-1 text-gray-400">({hint})</span>}
      </label>
      {children}
    </div>
  )
}

function isResiliency(v: unknown): v is ResiliencyType {
  return v === 'three-way-mirror' || v === 'two-way-mirror' || v === 'dual-parity' || v === 'nested-two-way'
}
