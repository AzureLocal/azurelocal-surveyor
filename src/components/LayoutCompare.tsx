/**
 * LayoutCompare — Drive Layout Comparison table.
 * Ports sheet 10 exactly: same total raw capacity, different drive counts.
 * Shows rows for 1–16 drives/node, auto-calculating drive size to preserve
 * total raw, so you can see how reserve cost changes with drive count.
 */
import { useSurveyorStore } from '../state/store'
import { computeCapacity, round2 } from '../engine/capacity'
import type { HardwareInputs } from '../engine/types'

export default function LayoutCompare() {
  const { hardware, advanced } = useSurveyorStore()

  const currentRawTB = hardware.capacityDriveSizeTB * hardware.capacityDrivesPerNode * hardware.nodeCount
  const nodeCount    = hardware.nodeCount

  // Generate rows for drive counts 1–16, same as Excel rows B14:B21 extended
  const rows = Array.from({ length: 16 }, (_, i) => i + 1).map((drivesPerNode) => {
    const driveSizeTB  = drivesPerNode > 0 ? round2(currentRawTB / (drivesPerNode * nodeCount)) : 0
    const totalDrives  = drivesPerNode * nodeCount
    const usablePerDriveTB = round2(driveSizeTB * advanced.capacityEfficiencyFactor)
    const reserveDrives = Math.min(nodeCount, 4)
    const reserveTB    = round2(reserveDrives * usablePerDriveTB)

    // Available pool = (total drives × usable/drive) − reserve − infra volume footprint
    // Infra footprint uses default resiliency factor from advanced settings
    const altHw: HardwareInputs = {
      ...hardware,
      capacityDrivesPerNode: drivesPerNode,
      capacityDriveSizeTB: driveSizeTB,
    }
    const result = computeCapacity(altHw, advanced)

    const isCurrent = drivesPerNode === hardware.capacityDrivesPerNode
    return { drivesPerNode, driveSizeTB, totalDrives, usablePerDriveTB, reserveTB, result, isCurrent }
  })

  const currentRow = rows.find((r) => r.isCurrent)
  const currentEffective = currentRow?.result.effectiveUsableTB ?? 0

  return (
    <div className="space-y-4">
      {/* Current config summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden text-sm">
        <Stat label="Cluster nodes" value={`${nodeCount}`} />
        <Stat label="Total raw capacity" value={`${round2(currentRawTB)} TB`} note="held constant across all rows" />
        <Stat label="Efficiency factor" value={`${advanced.capacityEfficiencyFactor}`} />
        <Stat label="Reserve drives" value={`${Math.min(nodeCount, 4)} (min(nodes, 4))`} />
      </div>

      {/* Comparison table */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-left border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Drives / Node</th>
              <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 text-right">Drive Size (TB)</th>
              <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 text-right">Total Drives</th>
              <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 text-right">Usable / Drive (TB)</th>
              <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 text-right">Reserve (TB)</th>
              <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 text-right">Available Pool (TB)</th>
              <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 text-right">Effective Usable (TB)</th>
              <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 text-right">vs Current</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const delta = round2(row.result.effectiveUsableTB - currentEffective)
              return (
                <tr
                  key={row.drivesPerNode}
                  className={`border-t border-gray-100 dark:border-gray-800 ${
                    row.isCurrent
                      ? 'bg-brand-50 dark:bg-brand-900/30 font-semibold'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <td className="px-3 py-2">
                    {row.drivesPerNode}
                    {row.isCurrent && (
                      <span className="ml-2 text-xs font-medium text-brand-600 dark:text-brand-400">← current</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{row.driveSizeTB}</td>
                  <td className="px-3 py-2 text-right">{row.totalDrives}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.usablePerDriveTB}</td>
                  <td className="px-3 py-2 text-right font-mono text-red-600 dark:text-red-400">{row.reserveTB}</td>
                  <td className="px-3 py-2 text-right font-mono">{round2(row.result.availableForVolumesTB)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {round2(row.result.effectiveUsableTB)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.isCurrent ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span className={delta > 0 ? 'text-green-600 dark:text-green-400' : delta < 0 ? 'text-red-500' : 'text-gray-400'}>
                        {delta > 0 ? '+' : ''}{delta} TB
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Key insight — mirrors Excel B23:B25 */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-sm space-y-1.5">
        <p className="font-semibold text-blue-900 dark:text-blue-200">Key Insight</p>
        <p className="text-blue-800 dark:text-blue-300">
          More drives per node = smaller individual drive size = smaller reserve. S2D always reserves{' '}
          <strong>min(nodes, 4) drives</strong> for auto-repair — so smaller drives cost less reserve TB,
          leaving more pool available for your volumes. Total raw capacity is identical across all rows.
        </p>
        <p className="text-blue-700 dark:text-blue-400 text-xs">
          Drive sizes shown are calculated (total raw ÷ total drives) — actual hardware must match a
          real available drive size from your vendor.
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 px-4 py-3">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
      {note && <div className="text-xs text-gray-400 mt-0.5">{note}</div>}
    </div>
  )
}
