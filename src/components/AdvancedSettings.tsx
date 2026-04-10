import { useSurveyorStore } from '../state/store'
import { DEFAULT_ADVANCED_SETTINGS } from '../engine/types'
import type { ResiliencyType } from '../engine/types'

export default function AdvancedSettings() {
  const { advanced, setAdvanced } = useSurveyorStore()

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

      <button
        className="text-xs text-gray-400 hover:text-gray-600 underline"
        onClick={() => setAdvanced(DEFAULT_ADVANCED_SETTINGS)}
      >
        Reset to defaults
      </button>
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
