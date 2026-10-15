import { useState, useEffect } from 'react'
import { useSurveyorStore } from '../state/usePlanStore'
import { findPreset, hardwareFromPreset, presetsByVendor } from '../engine/presets/index'
import type { OemCatalogType } from '../engine/types'
import { getRecommendedResiliency, platformRuleIssues } from '../engine/hardware'

/** Parse numeric input — returns current value if input is empty or NaN. */
function num(e: React.ChangeEvent<HTMLInputElement>, current: number): number {
  const v = e.target.value
  if (v === '' || v === '-') return current
  const n = +v
  return isNaN(n) ? current : n
}

// ── Standard drive sizes per media type ──────────────────────────────────────
// Enterprise NVMe/SSD sizes follow NAND over-provisioning conventions.
// These cover all sizes shipped by Dell, HPE, Lenovo, DataON, and others.

const NVME_SIZES = [0.4, 0.8, 1.6, 1.92, 3.2, 3.84, 6.4, 7.68, 12.8, 15.36, 30.72]
const SSD_SIZES  = [0.48, 0.96, 1.92, 3.84, 7.68, 15.36]
const HDD_SIZES  = [4, 6, 8, 10, 12, 14, 16, 18, 20]

const CACHE_NVME_SIZES = [0.375, 0.4, 0.8, 1.6, 3.2]
const CACHE_SSD_SIZES  = [0.48, 0.8, 0.96, 1.6, 1.92]

function driveSizesFor(media: string): number[] {
  switch (media) {
    case 'nvme': return NVME_SIZES
    case 'ssd':  return SSD_SIZES
    case 'hdd':  return HDD_SIZES
    default:     return NVME_SIZES
  }
}

function cacheSizesFor(media: string): number[] {
  switch (media) {
    case 'nvme': return CACHE_NVME_SIZES
    case 'ssd':  return CACHE_SSD_SIZES
    default:     return CACHE_NVME_SIZES
  }
}

const CATALOG_LABEL: Record<OemCatalogType, string> = {
  'integrated': 'Integrated',
  'premier': 'Premier',
  'validated-node': 'Validated Node',
}

export default function HardwareForm() {
  const { hardware, setHardware, setAdvanced } = useSurveyorStore()
  const single = hardware.nodeCount === 1 && !hardware.rackAware
  const maxNodes = hardware.rackAware ? 8 : 16
  // Errors appear in the Hardware Health Check below; warnings and notes stay visible here.
  const notes = platformRuleIssues(hardware).filter((r) => r.severity !== 'error')
  const grouped = presetsByVendor()
  const [presetId, setPresetId] = useState('')
  const selectedPreset = findPreset(presetId)
  const presetCustomized = selectedPreset && Object.entries(hardwareFromPreset(selectedPreset))
    .some(([key, value]) => hardware[key as keyof typeof hardware] !== value)

  // Track whether the user is in "custom" entry mode for drive sizes
  const capacitySizes = driveSizesFor(hardware.capacityMediaType)
  const cacheSizes = cacheSizesFor(hardware.cacheMediaType)

  const [capacityCustom, setCapacityCustom] = useState(
    () => !capacitySizes.includes(hardware.capacityDriveSizeTB)
  )
  const [cacheCustom, setCacheCustom] = useState(
    () => hardware.cacheDriveSizeTB > 0 && !cacheSizes.includes(hardware.cacheDriveSizeTB)
  )

  // When media type changes, reset custom mode if current size matches a standard size
  useEffect(() => {
    const sizes = driveSizesFor(hardware.capacityMediaType)
    if (sizes.includes(hardware.capacityDriveSizeTB)) {
      setCapacityCustom(false)
    } else if (hardware.capacityDriveSizeTB > 0) {
      setCapacityCustom(true)
    }
  }, [hardware.capacityMediaType, hardware.capacityDriveSizeTB])

  useEffect(() => {
    const sizes = cacheSizesFor(hardware.cacheMediaType)
    if (hardware.cacheDriveSizeTB === 0 || sizes.includes(hardware.cacheDriveSizeTB)) {
      setCacheCustom(false)
    } else {
      setCacheCustom(true)
    }
  }, [hardware.cacheMediaType, hardware.cacheDriveSizeTB])

  return (
    <div className="space-y-6">
      {/* OEM Preset picker */}
      <div>
        <label htmlFor="oem-preset" className="block text-sm font-medium mb-1">OEM Preset (optional)</label>
        <select
          id="oem-preset"
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          value={presetId}
          onChange={(e) => {
            setPresetId(e.target.value)
            const preset = findPreset(e.target.value)
            if (!preset) return
            setHardware(hardwareFromPreset(preset))
          }}
        >
          <option value="">— select a preset —</option>
          {[...grouped.entries()].map(([vendor, presets]) => (
            <optgroup key={vendor} label={vendor}>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.model} — {CATALOG_LABEL[p.catalogType]} — {p.coresPerNode}c / {p.memoryPerNodeGB} GB
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Editable planning examples, not certified bills of materials. Presets fill physical cores,
          RAM and data drives per node; your node count stays unchanged. Confirm your final configuration in the{' '}
          <a href="https://azurelocalsolutions.azure.microsoft.com/#/catalog"
            target="_blank" rel="noopener noreferrer"
            className="text-brand-600 dark:text-brand-400 underline hover:no-underline">
            Azure Local Solutions Catalog
          </a>.
        </p>
        {selectedPreset && (
          <div className="mt-3 rounded-md border border-gray-200 dark:border-gray-700 p-3 text-sm space-y-2" aria-label="Preset reference">
            <p className="font-medium">{selectedPreset.vendor} {selectedPreset.model} · {CATALOG_LABEL[selectedPreset.catalogType]}</p>
            <p>{selectedPreset.notes}</p>
            <p>
              Example per node: {selectedPreset.coresPerNode} physical cores · {selectedPreset.memoryPerNodeGB} GB RAM
              {' · '}{selectedPreset.capacityDrivesPerNode} × {selectedPreset.capacityDriveSizeTB} TB {selectedPreset.capacityMediaType.toUpperCase()} capacity
              {selectedPreset.cacheDrivesPerNode > 0
                ? ` · ${selectedPreset.cacheDrivesPerNode} × ${selectedPreset.cacheDriveSizeTB} TB ${selectedPreset.cacheMediaType.toUpperCase()} cache`
                : ' · no cache tier'}.
              {' '}Boot drives are excluded from capacity.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Source reviewed {selectedPreset.reviewedAt}: {' '}
              <a href={selectedPreset.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 underline">
                {selectedPreset.sourceTitle}
              </a>
            </p>
            {presetCustomized && <p role="status" className="text-xs">Your hardware values have been customized from this example.</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Number of nodes" hint={hardware.rackAware ? '2, 4, 6 or 8 — two equal zones' : '1–16'}>
          <input type="number" min={hardware.rackAware ? 2 : 1} max={maxNodes} step={hardware.rackAware ? 2 : 1} value={hardware.nodeCount}
            onChange={(e) => {
              const nodeCount = num(e, hardware.nodeCount)
              // A single node has no storage cache: clear it so the plan stays valid.
              setHardware(nodeCount === 1 && !hardware.rackAware
                ? { nodeCount, cacheMediaType: 'none', cacheDrivesPerNode: 0, cacheDriveSizeTB: 0 }
                : { nodeCount })
            }}
            className="input" />
          <p className="text-xs text-gray-400 mt-1">
            Hyperconverged Azure Local supports 1 to 16 machines (8 rack aware). Disaggregated SAN deployments of up to 64 machines are not modeled in Surveyor.
          </p>
        </Field>

        <div role="group" aria-label="Rack aware cluster" className="col-span-2 rounded-md border border-gray-200 dark:border-gray-700 p-3">
          <label className="flex items-start gap-2 text-sm font-medium">
            <input type="checkbox" className="mt-1" checked={!!hardware.rackAware}
              onChange={(e) => {
                const on = e.target.checked
                const nodeCount = on ? Math.min(8, Math.max(2, 2 * Math.ceil(hardware.nodeCount / 2))) : hardware.nodeCount
                const next = { ...hardware, nodeCount, rackAware: on || undefined }
                setHardware(on ? { nodeCount, rackAware: true } : { rackAware: undefined })
                setAdvanced({ defaultResiliency: getRecommendedResiliency(next) })
              }} />
            <span>Rack aware cluster (two local zones)
              <span className="block text-xs font-normal text-gray-500">
                New deployments only. {hardware.nodeCount >= 2 && hardware.rackAware ? `${hardware.nodeCount / 2}+${hardware.nodeCount / 2} zones. ` : ''}
                Volumes are two-way mirror (1+1, 50%) or four-way mirror (2+2 to 4+4, 25%). All-flash drives, Active Directory identity, cloud witness.
              </span>
            </span>
          </label>
        </div>

        <Field label="Capacity drives / node">
          <input type="number" min={1} value={hardware.capacityDrivesPerNode}
            onChange={(e) => setHardware({ capacityDrivesPerNode: num(e, hardware.capacityDrivesPerNode) })}
            className="input" />
        </Field>

        <Field label="Capacity drive size (TB)">
          {capacityCustom ? (
            <div className="flex gap-2">
              <input type="number" min={0.1} step={0.01} value={hardware.capacityDriveSizeTB}
                onChange={(e) => setHardware({ capacityDriveSizeTB: num(e, hardware.capacityDriveSizeTB) })}
                className="input flex-1" />
              <button
                onClick={() => {
                  // Snap to nearest standard size if possible
                  const sizes = driveSizesFor(hardware.capacityMediaType)
                  const nearest = sizes.reduce((a, b) =>
                    Math.abs(b - hardware.capacityDriveSizeTB) < Math.abs(a - hardware.capacityDriveSizeTB) ? b : a
                  )
                  setHardware({ capacityDriveSizeTB: nearest })
                  setCapacityCustom(false)
                }}
                className="px-2 py-1 text-xs text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700 rounded hover:bg-brand-50 dark:hover:bg-brand-900/30 whitespace-nowrap"
              >
                Standard sizes
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={hardware.capacityDriveSizeTB}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'custom') {
                    setCapacityCustom(true)
                  } else {
                    setHardware({ capacityDriveSizeTB: +v })
                  }
                }}
                className="input flex-1"
              >
                {capacitySizes.map((s) => (
                  <option key={s} value={s}>{s} TB — {(s * 0.909495).toFixed(2)} TiB in Windows</option>
                ))}
                <option value="custom">Custom size...</option>
              </select>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {hardware.capacityMediaType.toUpperCase()} vendor-rated size.
            Windows and WAC will show this drive as ~{hardware.capacityDriveSizeTB ? (hardware.capacityDriveSizeTB * 0.909495).toFixed(2) : '—'} TiB (binary units).
          </p>
        </Field>

        <Field label="Capacity media type">
          <select value={hardware.capacityMediaType}
            onChange={(e) => setHardware({ capacityMediaType: e.target.value as 'nvme'|'ssd'|'hdd' })}
            className="input">
            <option value="nvme">NVMe</option>
            <option value="ssd">SSD</option>
            <option value="hdd">HDD</option>
          </select>
        </Field>

        <Field label="Cache drives / node" hint="0 if all-NVMe">
          <input type="number" min={0} disabled={single} value={hardware.cacheDrivesPerNode}
            onChange={(e) => setHardware({ cacheDrivesPerNode: num(e, hardware.cacheDrivesPerNode) })}
            className="input" />
        </Field>

        <Field label="Cache drive size (TB)">
          {hardware.cacheMediaType === 'none' ? (
            <div className="input bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-default select-none">
              No cache tier
            </div>
          ) : cacheCustom ? (
            <div className="flex gap-2">
              <input type="number" min={0.1} step={0.01} value={hardware.cacheDriveSizeTB}
                onChange={(e) => setHardware({ cacheDriveSizeTB: num(e, hardware.cacheDriveSizeTB) })}
                className="input flex-1" />
              <button
                onClick={() => {
                  const sizes = cacheSizesFor(hardware.cacheMediaType)
                  const nearest = sizes.reduce((a, b) =>
                    Math.abs(b - hardware.cacheDriveSizeTB) < Math.abs(a - hardware.cacheDriveSizeTB) ? b : a
                  )
                  setHardware({ cacheDriveSizeTB: nearest })
                  setCacheCustom(false)
                }}
                className="px-2 py-1 text-xs text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700 rounded hover:bg-brand-50 dark:hover:bg-brand-900/30 whitespace-nowrap"
              >
                Standard sizes
              </button>
            </div>
          ) : (
            <select
              value={hardware.cacheDriveSizeTB}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'custom') {
                  setCacheCustom(true)
                } else {
                  setHardware({ cacheDriveSizeTB: +v })
                }
              }}
              className="input"
            >
              {cacheSizes.map((s) => (
                <option key={s} value={s}>{s} TB</option>
              ))}
              <option value="custom">Custom size...</option>
            </select>
          )}
        </Field>

        <Field label="Cache media type">
          <select value={hardware.cacheMediaType} disabled={single}
            onChange={(e) => setHardware({ cacheMediaType: e.target.value as 'nvme'|'ssd'|'none' })}
            className="input">
            <option value="none">None (flat all-flash)</option>
            <option value="nvme">NVMe</option>
            <option value="ssd">SSD</option>
          </select>
          {single && <p className="text-xs text-gray-400 mt-1">A single node does not support the storage cache.</p>}
        </Field>

        <Field label="CPU cores / node" hint="physical">
          <input type="number" min={1} value={hardware.coresPerNode}
            onChange={(e) => setHardware({ coresPerNode: num(e, hardware.coresPerNode) })}
            className="input" />
        </Field>

        <Field label="RAM / node (GB)">
          <input type="number" min={16} value={hardware.memoryPerNodeGB}
            onChange={(e) => setHardware({ memoryPerNodeGB: num(e, hardware.memoryPerNodeGB) })}
            className="input" />
        </Field>

        <Field label="Hyperthreading" hint="override in Advanced Settings">
          <div className="input bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-default select-none">
            {hardware.hyperthreadingEnabled
              ? `Enabled — ${hardware.coresPerNode} cores × 2 = ${hardware.coresPerNode * 2} logical`
              : `Disabled — ${hardware.coresPerNode} logical cores`}
          </div>
        </Field>

      </div>

      {notes.length > 0 && (
        <ul className="space-y-1 text-sm" aria-label="Platform rule notes">
          {notes.map((r) => (
            <li key={r.code} className={r.severity === 'warning' ? 'text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}>
              <strong>{r.severity === 'warning' ? 'Note: ' : 'Info: '}</strong>{r.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <label className="block text-sm font-medium mb-1">
        {label}
        {hint && <span className="ml-1 text-xs text-gray-500">({hint})</span>}
      </label>
      {children}
    </div>
  )
}
