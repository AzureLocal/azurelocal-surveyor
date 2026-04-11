/**
 * LayoutCompare — compare current drive config against an alternative.
 * Ports the "Drive Layout Comparison" sheet (53 formulas).
 *
 * Alternative config auto-calculates drive size to match the same total
 * raw capacity — revealing the reserve-cost tradeoff of more/fewer drives.
 */
import { useState } from 'react'
import { useSurveyorStore } from '../state/store'
import { computeCapacity, round2 } from '../engine/capacity'
import type { HardwareInputs } from '../engine/types'

export default function LayoutCompare() {
  const { hardware, advanced } = useSurveyorStore()
  const current = computeCapacity(hardware, advanced)

  // Alternative: user changes drives/node and node count; drive size auto-calculated
  // to preserve same total raw capacity — mirrors Excel Drive Layout Comparison (#65)
  const [altDrivesPerNode, setAltDrivesPerNode] = useState(hardware.capacityDrivesPerNode)
  const [altNodes, setAltNodes]               = useState(hardware.nodeCount)

  const currentRawTB = hardware.capacityDriveSizeTB * hardware.capacityDrivesPerNode * hardware.nodeCount
  const altDriveSizeTB = altDrivesPerNode > 0 && altNodes > 0
    ? round2(currentRawTB / (altNodes * altDrivesPerNode))
    : 0

  const altHw: HardwareInputs = {
    ...hardware,
    nodeCount: altNodes,
    capacityDrivesPerNode: altDrivesPerNode,
    capacityDriveSizeTB: altDriveSizeTB,
  }
  const altResult = computeCapacity(altHw, advanced)
  const delta = round2(altResult.effectiveUsableTB - current.effectiveUsableTB)

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        The alternative configuration automatically matches your current total raw capacity but with a different
        drive count per node. This reveals the <strong>reserve-cost tradeoff</strong>: more smaller drives = smaller
        reserve TB = more available pool capacity, for the same raw investment.
      </p>

      <div className="grid grid-cols-2 gap-8">
        {/* Current — read-only */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-brand-700 dark:text-brand-300">Current config</h3>
          <ConfigTable rows={[
            ['Nodes', String(hardware.nodeCount)],
            ['Drives / node', String(hardware.capacityDrivesPerNode)],
            ['Drive size', `${hardware.capacityDriveSizeTB} TB`],
            ['Total raw', `${current.rawPoolTB} TB`],
            ['Reserve drives', String(current.reserveDrives)],
            ['Reserve (TB)', `${round2(current.reserveTB)} TB`],
          ]} />
          <CapacityBlock value={current.effectiveUsableTB} />
        </div>

        {/* Alternative — drives/node and node count editable; drive size auto-calculated */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-gray-600 dark:text-gray-400">Alternative config</h3>
          <div className="space-y-2 mb-3">
            <AltField label="Nodes" value={altNodes} onChange={setAltNodes} />
            <AltField label="Capacity drives / node" value={altDrivesPerNode} onChange={setAltDrivesPerNode} />
            <div className="flex items-center gap-2">
              <span className="text-xs w-36 shrink-0 text-gray-500">Drive size (auto)</span>
              <span className="text-sm font-mono font-semibold px-2 py-1.5 bg-gray-100 dark:bg-gray-800 rounded flex-1 text-center">
                {altDriveSizeTB} TB
              </span>
            </div>
          </div>
          <ConfigTable rows={[
            ['Total raw', `${round2(currentRawTB)} TB`],
            ['Reserve drives', String(altResult.reserveDrives)],
            ['Reserve (TB)', `${round2(altResult.reserveTB)} TB`],
          ]} />
          <CapacityBlock value={altResult.effectiveUsableTB} />
        </div>
      </div>

      {/* Delta */}
      <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${delta >= 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
        {delta >= 0 ? '+' : ''}{delta} TB effective usable with alternative layout
        {delta !== 0 && (
          <span className="ml-2 text-xs font-normal opacity-70">
            {delta > 0
              ? '(more available — smaller reserve cost per drive)'
              : '(less available — larger drives cost more reserve TB)'}
          </span>
        )}
      </div>

      {/* Reserve education — mirrors Excel Drive Sizing Advisory section */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700 dark:text-gray-300">Why does reserve cost change between configurations?</p>
        <p>S2D reserves <strong>min(nodeCount, 4) drives</strong> for automatic repair after a drive failure. Reserve cost in TB = reserveDrives × driveSizeTB.</p>
        <p>With more smaller drives: each reserved drive is cheaper in TB, so more of the pool is available for your volumes — even though the total raw capacity is identical.</p>
        <p className="text-amber-600 dark:text-amber-400">Keep pool utilization below 70% to ensure S2D has headroom to complete auto-repair after a failure.</p>
      </div>
    </div>
  )
}

function ConfigTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full text-xs mb-3">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-t border-gray-100 dark:border-gray-800">
            <td className="py-1 text-gray-500">{label}</td>
            <td className="py-1 text-right font-mono">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CapacityBlock({ value }: { value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="text-xs text-gray-500">Effective usable</div>
      <div className="text-2xl font-bold">{value} <span className="text-base font-normal text-gray-500">TB</span></div>
    </div>
  )
}

function AltField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs w-36 shrink-0">{label}</label>
      <input type="number" step={1} min={1} className="input flex-1" value={value}
        onChange={(e) => onChange(Math.max(1, +e.target.value))} />
    </div>
  )
}
