import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useSurveyorStore } from '../state/store'
import { DEFAULT_ADVANCED_SETTINGS } from '../engine/types'
import type { AdvancedSettingsOverrides, ResiliencyType } from '../engine/types'

export default function AdvancedSettings() {
  const { advanced, setAdvanced, hardware, setHardware, resetAll } = useSurveyorStore()
  const [overridesOpen, setOverridesOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const navigate = useNavigate()

  const overrides: AdvancedSettingsOverrides = advanced.overrides ?? {}
  const hasActiveOverride = Object.values(overrides).some((v) => v !== undefined && v > 0)

  function setOverride(key: keyof AdvancedSettingsOverrides, value: string) {
    const parsed = parseFloat(value)
    setAdvanced({
      overrides: {
        ...overrides,
        [key]: !value || isNaN(parsed) ? undefined : parsed,
      },
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        These settings match the "Advanced Settings" sheet in the original workbook.
        Defaults are tuned for Azure Local — change only if you know what you're doing.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Capacity efficiency factor" hint="default 0.92">
          <input type="number" min={0.5} max={1} step={0.01} className="input"
            value={advanced.capacityEfficiencyFactor}
            onChange={(e) => setAdvanced({ capacityEfficiencyFactor: +e.target.value })} />
          <p className="text-xs text-gray-400 mt-1">Applied per drive. Accounts for ReFS metadata and filesystem overhead.</p>
        </Field>

        <Field label="Infra volume size (TB)" hint="default 0.25">
          <input type="number" min={0.1} max={2} step={0.05} className="input"
            value={advanced.infraVolumeSizeTB}
            onChange={(e) => setAdvanced({ infraVolumeSizeTB: +e.target.value })} />
          <p className="text-xs text-gray-400 mt-1">
            Logical size of the Azure Local system CSV. Pool footprint = this ÷ resiliency factor.
            Reserve drives (min(nodeCount,4)) are computed automatically from node count.
          </p>
        </Field>

        <Field label="vCPU oversubscription ratio" hint="default 4">
          <input type="number" min={1} max={10} step={0.5} className="input"
            value={advanced.vCpuOversubscriptionRatio}
            onChange={(e) => setAdvanced({ vCpuOversubscriptionRatio: +e.target.value })} />
          <p className="text-xs text-gray-400 mt-1">Logical cores × this ratio = total vCPUs before reservation.</p>
        </Field>

        <Field label="System reserved memory / node (GB)" hint="default 8">
          <input type="number" min={4} max={64} step={1} className="input"
            value={advanced.systemReservedMemoryGB}
            onChange={(e) => setAdvanced({ systemReservedMemoryGB: +e.target.value })} />
        </Field>

        <Field label="System reserved vCPUs / node" hint="default 4">
          <input type="number" min={2} max={16} step={1} className="input"
            value={advanced.systemReservedVCpus}
            onChange={(e) => setAdvanced({ systemReservedVCpus: +e.target.value })} />
          <p className="text-xs text-gray-400 mt-1">Reserved for Hyper-V, Arc VM agent, and OS processes.</p>
        </Field>

        <Field label="Default resiliency">
          <select className="input" value={advanced.defaultResiliency}
            onChange={(e) => setAdvanced({ defaultResiliency: e.target.value as ResiliencyType })}>
            <option value="two-way-mirror">Two-Way Mirror (50%)</option>
            <option value="three-way-mirror">Three-Way Mirror (33%)</option>
            <option value="dual-parity">Dual Parity (50–80%, node-count dependent)</option>
            <option value="nested-two-way">Nested Two-Way (25%)</option>
          </select>
        </Field>
      </div>

      {/* Hyperthreading override */}
      <div className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 ${!hardware.hyperthreadingEnabled ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
        <div>
          <div className="text-sm font-medium">
            Hyperthreading (SMT)
            {!hardware.hyperthreadingEnabled && (
              <span className="ml-2 text-xs font-medium text-amber-600 dark:text-amber-400">override active — disabled</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Enabled on all Azure Local validated hardware by default. Disable only if your BIOS/UEFI has SMT turned off (rare — typically done for MDS/L1TF security mitigations).
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Current: {hardware.coresPerNode} physical cores → {hardware.hyperthreadingEnabled ? `${hardware.coresPerNode * 2} logical (×2)` : `${hardware.coresPerNode} logical (HT off)`}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={hardware.hyperthreadingEnabled}
          onClick={() => setHardware({ hyperthreadingEnabled: !hardware.hyperthreadingEnabled })}
          className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hardware.hyperthreadingEnabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${hardware.hyperthreadingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <button
        className="text-xs text-gray-400 hover:text-gray-600 underline"
        onClick={() => setAdvanced(DEFAULT_ADVANCED_SETTINGS)}
      >
        Reset to defaults
      </button>

      {/* Override Calculated Values (#64) */}
      <div className={`border rounded-lg overflow-hidden ${hasActiveOverride ? 'border-amber-300 dark:border-amber-700' : 'border-gray-200 dark:border-gray-700'}`}>
        <button
          className={`flex items-center gap-2 w-full px-4 py-3 text-left transition-colors ${hasActiveOverride ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30' : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          onClick={() => setOverridesOpen((o) => !o)}
        >
          {overridesOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />}
          <span className="text-sm font-semibold flex-1">Override Calculated Values</span>
          {hasActiveOverride && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
              Override active
            </span>
          )}
        </button>
        {overridesOpen && (
          <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500">
              Enter a value to override the formula-calculated result. Leave blank to use the formula.
              This mirrors the Excel workbook's "Override column" pattern:{' '}
              <code className="font-mono text-xs">IF(override≠"", override, formula)</code>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <OverrideField
                label="Drive usable capacity (TB)"
                hint="replaces drive size × efficiency factor"
                value={overrides.driveUsableTb}
                onChange={(v) => setOverride('driveUsableTb', v)}
              />
              <OverrideField
                label="AVD session hosts needed"
                hint="replaces ceil(users ÷ density)"
                value={overrides.avdSessionHostsNeeded}
                onChange={(v) => setOverride('avdSessionHostsNeeded', v)}
              />
              <OverrideField
                label="AVD profile logical storage (TB)"
                hint="replaces users × profile GB ÷ 1024"
                value={overrides.avdProfileLogicalTb}
                onChange={(v) => setOverride('avdProfileLogicalTb', v)}
              />
              <OverrideField
                label="SOFS profile demand (TB)"
                hint="replaces user count × profile GB ÷ 1024"
                value={overrides.sofsProfileDemandTb}
                onChange={(v) => setOverride('sofsProfileDemandTb', v)}
              />
            </div>
            {hasActiveOverride && (
              <button
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                onClick={() => setAdvanced({ overrides: {} })}
              >
                Clear all overrides
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reset All Settings */}
      <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
        <div className="bg-red-50 dark:bg-red-900/20 px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-red-700 dark:text-red-400">Reset All Settings</div>
            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
              Clears all hardware inputs, workload configurations, and volume plans.
            </p>
          </div>
          {!confirmReset ? (
            <button
              className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              onClick={() => setConfirmReset(true)}
            >
              Reset all…
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-red-700 dark:text-red-400 font-medium">Are you sure?</span>
              <button
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
                onClick={() => {
                  resetAll()
                  setConfirmReset(false)
                  navigate('/hardware')
                }}
              >
                Yes, reset
              </button>
              <button
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TB ↔ TiB Conversion Reference (#57) */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          TB ↔ TiB Conversion Reference
        </div>
        <p className="px-4 pt-2 text-xs text-gray-500">
          Windows Admin Center, PowerShell, and Disk Management display storage in TiB (binary).
          This calculator uses TB (decimal). Formula: TiB = TB × 0.909495
        </p>
        <table className="w-full text-xs mt-2">
          <thead>
            <tr className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <th className="px-4 py-1.5 text-left font-medium text-gray-500">Decimal (TB)</th>
              <th className="px-4 py-1.5 text-right font-medium text-gray-500">Binary (TiB)</th>
              <th className="px-4 py-1.5 text-right font-medium text-gray-500 hidden sm:table-cell">What Windows shows</th>
            </tr>
          </thead>
          <tbody>
            {([1, 5, 10, 25, 50, 100] as const).map((tb) => {
              const tib = (tb * 0.909495).toFixed(2)
              return (
                <tr key={tb} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-1.5">{tb} TB</td>
                  <td className="px-4 py-1.5 text-right font-mono">{tib} TiB</td>
                  <td className="px-4 py-1.5 text-right text-gray-400 hidden sm:table-cell">{tib} TiB in WAC / PS</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-gray-400">
          Note: A 7.68 TB NVMe drive shows as ~6.99 TiB in Windows due to binary/decimal difference plus NVMe wear-leveling reserve.
        </p>
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

function OverrideField({
  label, hint, value, onChange,
}: {
  label: string; hint?: string; value: number | undefined; onChange: (v: string) => void
}) {
  const isActive = value !== undefined && value > 0
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
        {hint && <span className="ml-1 text-xs text-gray-400">({hint})</span>}
        {isActive && <span className="ml-2 text-xs font-medium text-amber-600 dark:text-amber-400">override active</span>}
      </label>
      <input
        type="number"
        min={0}
        step={0.01}
        placeholder="blank = use formula"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`input ${isActive ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/10' : ''}`}
      />
    </div>
  )
}
