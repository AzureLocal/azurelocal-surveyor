/**
 * ServicePresets — Azure arc-enabled service workload cards (#81).
 *
 * Displays catalog entries as configurable workload instances.
 * Each instance has an instance count and optional per-instance resource overrides.
 */
import { useState } from 'react'
import { Trash2, Plus, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { useSurveyorStore } from '../state/store'
import {
  SERVICE_PRESET_CATALOG,
  getCatalogEntry,
  computeServicePreset,
  computeAllServicePresets,
} from '../engine/service-presets'
import type { ServicePresetInstance } from '../engine/service-presets'

const CATEGORY_LABELS: Record<string, string> = {
  'data-services': 'Data Services',
  'iot': 'IoT',
  'ai': 'AI',
  'containers': 'Containers',
}

function newInstance(catalogId: string): ServicePresetInstance {
  return {
    id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    catalogId,
    enabled: true,
    instanceCount: 1,
  }
}

export default function ServicePresets() {
  const { servicePresets, addServicePreset, updateServicePreset, removeServicePreset } = useSurveyorStore()
  const [addOpen, setAddOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const totals = computeAllServicePresets(servicePresets)
  const enabledCount = servicePresets.filter((p) => p.enabled).length

  // Group catalog entries by category
  const grouped = SERVICE_PRESET_CATALOG.reduce<Record<string, typeof SERVICE_PRESET_CATALOG>>(
    (acc, entry) => {
      const cat = entry.category
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(entry)
      return acc
    },
    {},
  )

  function handleAdd(catalogId: string) {
    addServicePreset(newInstance(catalogId))
    setAddOpen(false)
  }

  return (
    <div className="space-y-3">
      {/* Existing instances */}
      {servicePresets.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          No service presets added yet. Use the button below to add Arc-enabled services.
        </p>
      )}

      {servicePresets.map((inst) => {
        const entry = getCatalogEntry(inst.catalogId)
        if (!entry) return null
        const totals = computeServicePreset(inst)
        const isExpanded = expandedId === inst.id

        return (
          <div
            key={inst.id}
            className={`rounded-lg border ${inst.enabled ? 'border-brand-300 dark:border-brand-700' : 'border-gray-200 dark:border-gray-700'} overflow-hidden`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2 min-w-0">
                {/* Enable toggle */}
                <button
                  onClick={() => updateServicePreset(inst.id, { enabled: !inst.enabled })}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${inst.enabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${inst.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
                <div className="min-w-0">
                  <span className="text-sm font-semibold truncate">{entry.shortName}</span>
                  <span className="ml-2 text-xs text-gray-400 hidden sm:inline">{entry.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {inst.enabled && (
                  <span className="text-xs text-gray-500 hidden sm:inline">
                    {totals.totalVCpus} vCPU · {totals.totalMemoryGB} GB · {totals.totalStorageTB} TB
                  </span>
                )}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : inst.id)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Toggle details"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => removeServicePreset(inst.id)}
                  className="p-1 text-gray-400 hover:text-red-500"
                  aria-label="Remove preset"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-700 space-y-3">
                <p className="text-xs text-gray-500">{entry.description}</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <OverrideField
                    label="Instance count"
                    value={inst.instanceCount}
                    min={1}
                    step={1}
                    onChange={(v) => updateServicePreset(inst.id, { instanceCount: v })}
                  />
                  <OverrideField
                    label="vCPUs / instance"
                    placeholder={String(entry.defaultVCpusPerInstance)}
                    value={inst.vCpusOverride}
                    min={1}
                    step={1}
                    onChange={(v) => updateServicePreset(inst.id, { vCpusOverride: v })}
                    onClear={() => updateServicePreset(inst.id, { vCpusOverride: undefined })}
                  />
                  <OverrideField
                    label="Memory / instance (GB)"
                    placeholder={String(entry.defaultMemoryGBPerInstance)}
                    value={inst.memoryGBOverride}
                    min={1}
                    step={1}
                    onChange={(v) => updateServicePreset(inst.id, { memoryGBOverride: v })}
                    onClear={() => updateServicePreset(inst.id, { memoryGBOverride: undefined })}
                  />
                  <OverrideField
                    label="Storage / instance (TB)"
                    placeholder={String(entry.defaultStorageTBPerInstance)}
                    value={inst.storageTBOverride}
                    min={0}
                    step={0.1}
                    onChange={(v) => updateServicePreset(inst.id, { storageTBOverride: v })}
                    onClear={() => updateServicePreset(inst.id, { storageTBOverride: undefined })}
                  />
                </div>

                {/* Totals for this instance */}
                {inst.enabled && inst.instanceCount > 0 && (
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700">
                    <span>Total vCPUs: <strong className="text-gray-900 dark:text-white">{totals.totalVCpus}</strong></span>
                    <span>Total RAM: <strong className="text-gray-900 dark:text-white">{totals.totalMemoryGB} GB</strong></span>
                    <span>Total storage: <strong className="text-gray-900 dark:text-white">{totals.totalStorageTB} TB</strong></span>
                    <span>Volume resiliency: <strong className="text-gray-900 dark:text-white">{entry.defaultPvcResiliency}</strong></span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>Defaults verified: {entry.lastVerified}</span>
                  <span>·</span>
                  <a
                    href={entry.learnUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    Microsoft Learn <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {entry.notes && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded p-2">
                    {entry.notes}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add preset button / catalog picker */}
      {!addOpen ? (
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-brand-700 dark:text-brand-400 border border-dashed border-brand-300 dark:border-brand-700 rounded-lg w-full hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add service preset
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800">
            <span className="text-sm font-semibold">Select a service</span>
            <button onClick={() => setAddOpen(false)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Cancel</button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {Object.entries(grouped).map(([cat, entries]) => (
              <div key={cat} className="px-3 py-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {CATEGORY_LABELS[cat] ?? cat}
                </div>
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => handleAdd(entry.id)}
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                  >
                    <span className="font-medium">{entry.shortName}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {entry.defaultVCpusPerInstance} vCPU · {entry.defaultMemoryGBPerInstance} GB · {entry.defaultStorageTBPerInstance} TB
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aggregate totals */}
      {servicePresets.length > 0 && (
        <div className="pt-1 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 text-xs text-gray-500">
          <span>
            {enabledCount} of {servicePresets.length} preset{servicePresets.length !== 1 ? 's' : ''} enabled
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

// ─── Override field ─────────────────────────────────────────────────────────────
// Shows a numeric input. When `value` is undefined, shows placeholder (catalog default).
// A small "×" button clears override back to catalog default.

function OverrideField({
  label,
  value,
  placeholder,
  min,
  step,
  onChange,
  onClear,
}: {
  label: string
  value?: number
  placeholder?: string
  min?: number
  step?: number
  onChange: (v: number) => void
  onClear?: () => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
        {label}
        {onClear && value !== undefined && (
          <button
            onClick={onClear}
            className="ml-1 text-gray-400 hover:text-red-500 text-xs"
            title="Reset to catalog default"
          >
            (reset)
          </button>
        )}
      </label>
      <input
        type="number"
        min={min}
        step={step}
        className="input w-full"
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(v)
          else if (onClear && e.target.value === '') onClear()
        }}
      />
    </div>
  )
}
