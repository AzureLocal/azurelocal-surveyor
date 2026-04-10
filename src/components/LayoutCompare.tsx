/**
 * LayoutCompare — compare current drive config against an alternative.
 * Ports the "Drive Layout Comparison" sheet (53 formulas).
 * This is the killer feature: side-by-side capacity numbers for two configs.
 */
import { useState } from 'react'
import { useSurveyorStore } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import type { HardwareInputs } from '../engine/types'

export default function LayoutCompare() {
  const { hardware, advanced } = useSurveyorStore()
  const current = computeCapacity(hardware, advanced)

  // Alternative config — starts as a copy of current
  const [alt, setAlt] = useState<HardwareInputs>({ ...hardware })
  const altResult = computeCapacity(alt, advanced)

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Compare your current hardware configuration to an alternative layout side-by-side.
        Adjust the right column to see how changing drive count, size, or media type affects usable capacity.
      </p>

      <div className="grid grid-cols-2 gap-8">
        {/* Current — read-only */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-brand-700 dark:text-brand-300">Current config</h3>
          <ConfigSummary hw={hardware} />
          <CapacityBlock label="Effective usable" value={current.effectiveUsableTB} />
        </div>

        {/* Alternative — editable */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-gray-600 dark:text-gray-400">Alternative config</h3>
          <div className="space-y-2">
            <AltField label="Nodes" value={alt.nodeCount}
              onChange={(v) => setAlt((a) => ({ ...a, nodeCount: v }))} />
            <AltField label="Capacity drives/node" value={alt.capacityDrivesPerNode}
              onChange={(v) => setAlt((a) => ({ ...a, capacityDrivesPerNode: v }))} />
            <AltField label="Drive size (TB)" value={alt.capacityDriveSizeTB} step={0.01}
              onChange={(v) => setAlt((a) => ({ ...a, capacityDriveSizeTB: v }))} />
          </div>
          <CapacityBlock label="Effective usable" value={altResult.effectiveUsableTB} />
        </div>
      </div>

      {/* Delta */}
      <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${altResult.effectiveUsableTB >= current.effectiveUsableTB ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
        Delta: {altResult.effectiveUsableTB >= current.effectiveUsableTB ? '+' : ''}{(altResult.effectiveUsableTB - current.effectiveUsableTB).toFixed(2)} TB effective usable
      </div>
    </div>
  )
}

function ConfigSummary({ hw }: { hw: HardwareInputs }) {
  return (
    <div className="text-xs text-gray-500 mb-3 space-y-0.5">
      <div>{hw.nodeCount} nodes</div>
      <div>{hw.capacityDrivesPerNode} × {hw.capacityDriveSizeTB} TB {hw.capacityMediaType.toUpperCase()}</div>
    </div>
  )
}

function CapacityBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value} <span className="text-base font-normal text-gray-500">TB</span></div>
    </div>
  )
}

function AltField({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs w-36 shrink-0">{label}</label>
      <input type="number" step={step} min={0} className="input flex-1" value={value}
        onChange={(e) => onChange(+e.target.value)} />
    </div>
  )
}
