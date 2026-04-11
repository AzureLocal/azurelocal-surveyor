import { useSurveyorStore } from '../state/store'
import { ALL_PRESETS } from '../engine/presets/index'

export default function HardwareForm() {
  const { hardware, setHardware } = useSurveyorStore()

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
            onChange={(e) => setHardware({ nodeCount: +e.target.value })}
            className="input" />
        </Field>

        <Field label="Capacity drives / node">
          <input type="number" min={1} value={hardware.capacityDrivesPerNode}
            onChange={(e) => setHardware({ capacityDrivesPerNode: +e.target.value })}
            className="input" />
        </Field>

        <Field label="Capacity drive size (TB)">
          <input type="number" min={0.1} step={0.01} value={hardware.capacityDriveSizeTB}
            onChange={(e) => setHardware({ capacityDriveSizeTB: +e.target.value })}
            className="input" />
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
            onChange={(e) => setHardware({ cacheDrivesPerNode: +e.target.value })}
            className="input" />
        </Field>

        <Field label="Cache drive size (TB)">
          <input type="number" min={0} step={0.01} value={hardware.cacheDriveSizeTB}
            onChange={(e) => setHardware({ cacheDriveSizeTB: +e.target.value })}
            className="input" />
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
            onChange={(e) => setHardware({ coresPerNode: +e.target.value })}
            className="input" />
        </Field>

        <Field label="RAM / node (GB)">
          <input type="number" min={16} value={hardware.memoryPerNodeGB}
            onChange={(e) => setHardware({ memoryPerNodeGB: +e.target.value })}
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
