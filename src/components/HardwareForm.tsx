import { useState, useEffect } from 'react'
import { useSurveyorStore } from '../state/store'
import { ALL_PRESETS } from '../engine/presets/index'

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

export default function HardwareForm() {
  const { hardware, setHardware } = useSurveyorStore()

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
        <label className="block text-sm font-medium mb-1">OEM Preset (optional)</label>
        <select
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          defaultValue=""
          onChange={(e) => {
            const preset = ALL_PRESETS.find((p) => p.id === e.target.value)
            if (!preset) return
            setHardware({
              capacityDrivesPerNode: preset.capacityDrivesPerNode,
              capacityDriveSizeTB:   preset.capacityDriveSizeTB,
              capacityMediaType:     preset.capacityMediaType,
              cacheDrivesPerNode:    preset.cacheDrivesPerNode,
              cacheDriveSizeTB:      preset.cacheDriveSizeTB,
              cacheMediaType:        preset.cacheMediaType,
              coresPerNode:          preset.coresPerNode,
              memoryPerNodeGB:       preset.memoryPerNodeGB,
            })
          }}
        >
          <option value="">— select a preset —</option>
          {ALL_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.vendor} {p.model}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Number of nodes" hint="2–16">
          <input type="number" min={2} max={16} value={hardware.nodeCount}
            onChange={(e) => setHardware({ nodeCount: num(e, hardware.nodeCount) })}
            className="input" />
        </Field>

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
          <input type="number" min={0} value={hardware.cacheDrivesPerNode}
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
          <select value={hardware.cacheMediaType}
            onChange={(e) => setHardware({ cacheMediaType: e.target.value as 'nvme'|'ssd'|'none' })}
            className="input">
            <option value="none">None (all-NVMe)</option>
            <option value="nvme">NVMe</option>
            <option value="ssd">SSD</option>
          </select>
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

        <Field label="Volume provisioning">
          <select value={hardware.volumeProvisioning}
            onChange={(e) => setHardware({ volumeProvisioning: e.target.value as 'fixed'|'thin' })}
            className="input">
            <option value="fixed">Fixed</option>
            <option value="thin">Thin</option>
          </select>
        </Field>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
        {hint && <span className="ml-1 text-xs text-gray-500">({hint})</span>}
      </label>
      {children}
    </div>
  )
}
