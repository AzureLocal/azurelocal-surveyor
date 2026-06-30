import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import type { CapacityResult } from '../engine/types'
import { round2, TB_TO_TiB } from '../engine/capacity'
import { seventyPctLineTB } from '../engine/thresholds'

// ─── Capacity Pool Stacked Bar (#10 + AB#4639 70%-line) ──────────────────────

function CapacityStackedBar({
  capacity,
  volumesUsedTB = 0,
}: {
  capacity: CapacityResult
  volumesUsedTB?: number
}) {
  const total = capacity.rawPoolTB
  if (total <= 0) return null

  // Pool footprint of planned volumes: logical ÷ resiliency factor
  const volumeFootprintTB = volumesUsedTB > 0
    ? Math.min(volumesUsedTB / capacity.resiliencyFactor, capacity.availableForVolumesTB)
    : 0
  const remainingTB = Math.max(0, capacity.availableForVolumesTB - volumeFootprintTB)

  // AB#4639 — 70% line position relative to total raw pool
  const line70TB = seventyPctLineTB(capacity.availableForVolumesTB)
  // The 70% line sits within the "available for volumes" zone.
  // Its position on the bar = (reserve + infra + line70TB) / total
  const line70PctOfBar = total > 0
    ? ((capacity.reserveTB + capacity.infraVolumeTB + line70TB) / total) * 100
    : 0

  const segments = [
    { label: 'Reserve (footprint)', tb: capacity.reserveTB, color: 'bg-gray-400 dark:bg-gray-500' },
    { label: 'Infra volume (footprint)', tb: capacity.infraVolumeTB, color: 'bg-blue-300 dark:bg-blue-700' },
    { label: 'Volumes (footprint)', tb: volumeFootprintTB, color: 'bg-brand-500 dark:bg-brand-400' },
    { label: 'Remaining available (footprint)', tb: remainingTB, color: 'bg-green-400 dark:bg-green-600' },
  ].filter((s) => s.tb > 0)

  return (
    <div className="px-4 py-3">
      <div className="text-xs font-medium text-gray-500 mb-2">
        Pool Breakdown — footprint basis (of {total} TB raw)
      </div>
      {/* Stacked bar with 70% line overlay */}
      <div className="relative">
        <div className="flex rounded-md overflow-hidden h-5 w-full border border-gray-200 dark:border-gray-700">
          {segments.map((seg) => (
            <div
              key={seg.label}
              className={`${seg.color} h-full transition-all`}
              style={{ width: `${(seg.tb / total) * 100}%`, minWidth: seg.tb > 0 ? '2px' : '0' }}
              title={`${seg.label}: ${round2(seg.tb)} TB (${((seg.tb / total) * 100).toFixed(1)}%)`}
            />
          ))}
        </div>
        {/* AB#4639: 70% planning line marker */}
        {line70PctOfBar > 0 && line70PctOfBar < 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-500 dark:bg-amber-400"
            style={{ left: `${line70PctOfBar}%` }}
            title={`70% of available-for-volumes = ${round2(line70TB)} TB — planning alert threshold`}
          />
        )}
      </div>
      {/* 70% line label */}
      {line70PctOfBar > 0 && line70PctOfBar < 100 && (
        <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
          <span className="inline-block w-2 h-2 bg-amber-500 dark:bg-amber-400 rounded-sm shrink-0" />
          <span>70% planning line = {round2(line70TB)} TB footprint ({round2(line70TB * TB_TO_TiB)} TiB) — alert fires when volume footprint exceeds this</span>
        </div>
      )}
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${seg.color}`} />
            <span>{seg.label}</span>
            <span className="font-mono text-gray-700 dark:text-gray-300">{round2(seg.tb)} TB</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const RESILIENCY_LABELS: Record<string, string> = {
  'two-way-mirror':   'Two-Way Mirror (50%)',
  'three-way-mirror': 'Three-Way Mirror (33%)',
  'dual-parity':      'Dual Parity',
  'nested-two-way':   'Nested Two-Way (25%)',
}

const GLOSSARY = [
  { term: 'Raw Capacity',      def: "Manufacturer's advertised TB across all capacity drives (drive size × drives/node × nodes)." },
  { term: 'Pool After Overhead', def: 'Raw pool minus ~1% S2D metadata overhead. This is the addressable pool space before reserve and infra volume are deducted.' },
  { term: 'Pool Capacity',     def: 'All usable drives combined into the storage pool. Cache drives are excluded — they only accelerate reads/writes.' },
  { term: 'Reserve',           def: 'One drive equivalent per node (max 4 nodes) held back by S2D for automatic repair after a drive failure. Not user-configurable.' },
  { term: 'Infra Volume',      def: '~250 GB logical volume Azure Local creates automatically for internal system operations (the ClusterStorage CSV).' },
  { term: 'Available Pool',    def: 'Pool minus Reserve minus Infra Volume. This is the pool space your workload volumes draw from.' },
  { term: 'Volume Size',       def: 'The logical capacity you request when creating a volume — what you ask for.' },
  { term: 'Footprint',         def: 'Physical pool space a volume actually consumes. A 1 TB Three-Way Mirror volume uses 3 TB of pool footprint.' },
  { term: 'Efficiency',        def: 'Ratio of logical to physical storage. Two-Way = 50%, Three-Way = 33%, Dual Parity = 50–80% (node-count dependent).' },
  { term: 'TB vs TiB',         def: 'TB = decimal (10¹² bytes). TiB = binary (2⁴⁰ bytes). Windows Admin Center, PowerShell and File Explorer show TiB. 1 TB ≈ 0.9091 TiB (factor = 10¹²/2⁴⁰). This tool stores values internally in decimal TB; TiB is derived once for display.' },
  { term: 'Footprint vs Usable', def: 'Footprint is the pool space a volume physically occupies (size × copies). Usable (data) is the logical space you get to write (footprint ÷ copies). Example: 1 TB Three-Way volume = 3 TB footprint, 1 TB usable. Every figure in this report says which it is.' },
  { term: 'Effective Usable',  def: 'The planning number (usable data space) — how much data fits with a given resiliency type. = Available-for-Volumes (footprint) × resiliency efficiency. Two-Way = 50%, Three-Way ≈ 33.3%. The 70% planning line is 70% of Available-for-Volumes (footprint basis).' },
]

export default function CapacityReport({
  result,
  volumesUsedTB,
}: {
  result: CapacityResult
  volumesUsedTB?: number
}) {
  const [glossaryOpen, setGlossaryOpen] = useState(false)

  // #145: compute both Two-Way and Three-Way effective usable for side-by-side comparison.
  // These are the two most common choices; show both regardless of current default selection.
  const twoWayEffectiveTB = round2(result.availableForVolumesTB * 0.5)
  const threeWayEffectiveTB = round2(result.availableForVolumesTB * (1 / 3))
  const isDefaultTwoWay = result.resiliencyType === 'two-way-mirror'
  const isDefaultThreeWay = result.resiliencyType === 'three-way-mirror'

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Capacity Report</div>
      {/* Pool breakdown stacked bar chart (#10) */}
      <CapacityStackedBar capacity={result} volumesUsedTB={volumesUsedTB} />
      <div className="border-t border-gray-100 dark:border-gray-800" />
      {/* AB#4636: resiliency clamping warning */}
      {result.resiliencyClamped === true && (
        <div className="mx-4 my-3 flex gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>{(result.resiliencyRequested ?? result.resiliencyType).replace(/-/g, ' ')}</strong> requires more nodes than this cluster has ({result.nodeCount}).
            Capacity is shown using <strong>{result.resiliencyType.replace(/-/g, ' ')}</strong> — the safest valid option.
            Adjust the default resiliency in Advanced Settings.
          </span>
        </div>
      )}
      <table className="w-full text-sm">
        <tbody>
          {/* AB#4640 — footprint labels throughout; dual TB/TiB where meaningful */}
          <Section label="Raw Pool (footprint — decimal TB, vendor nameplate)" />
          <Row label="Raw pool — all capacity drives (drive size × drives/node × nodes)" value={`${result.rawPoolTB} TB`} sub="footprint — decimal TB (vendor nameplate)" />
          <Row label="Raw drive size (per drive, no overhead)" value={`${result.usablePerDriveTB} TB`} sub="footprint — decimal TB" />
          {/* AB#4635: label fix — totalUsableTB is pool-after-metadata, not "per-drive × drives × nodes" */}
          <Row label="Pool after metadata overhead (~1%)" value={`${result.totalUsableTB} TB`} sub="footprint — raw pool × 0.99; space S2D can address" />

          <Section label="Deductions (footprint — pool space consumed)" />
          {/* AB#4643: reserve uses raw drive size, not efficiency-adjusted */}
          <Row label={`Reserve — ${result.reserveDrives} drives × largest raw drive (min(${result.nodeCount}, 4) nodes)`} value={`− ${result.reserveTB} TB`} sub="footprint" />
          <Row label="Infrastructure volume (system CSV footprint)" value={`− ${round2(result.infraVolumeTB)} TB`} sub="footprint — logical size ÷ resiliency factor" />
          {(result.maintenanceReserveNodes ?? 0) > 0 && (
            <>
              <Row
                label={`Maintenance reserve (WAF N+${result.maintenanceReserveNodes}) — ${result.maintenanceReserveNodes} node${(result.maintenanceReserveNodes ?? 1) > 1 ? 's' : ''} held back for patching`}
                value={`− ${round2(result.maintenanceReserveTB ?? 0)} TB / − ${round2((result.maintenanceReserveTB ?? 0) * TB_TO_TiB)} TiB`}
                sub={`footprint — node raw capacity × ${result.maintenanceReserveNodes}; pre-deduction available: ${round2(result.availableBeforeMaintenanceTB ?? result.availableForVolumesTB)} TB`}
              />
            </>
          )}

          <Section label="Available for User Volumes" />
          {/* AB#4640 — dual TB/TiB display; footprint space label (canonical stage 5) */}
          <Row
            label="Available for volumes (footprint space)"
            value={`${round2(result.availableForVolumesTB)} TB / ${round2(result.availableForVolumesTiB)} TiB`}
            highlight
            sub="decimal TB (vendor) / binary TiB (OS-visible in WAC + PowerShell) — footprint basis"
          />
          {/* AB#4639 — 70% planning line value */}
          <Row
            label="70% planning line (footprint basis)"
            value={`${round2(result.availableForVolumesTB * 0.70)} TB / ${round2(result.availableForVolumesTiB * 0.70)} TiB`}
            sub="alert fires when planned volume footprint exceeds this — 70% × available-for-volumes"
          />

          <Section label="Planning Number (usable data space)" />
          {/* AB#4640 — label as "usable data" (not footprint); show TB + TiB */}
          <Row label="Three-Way Mirror efficiency" value="33.3% (1 usable ÷ 3 footprint)" highlight={isDefaultThreeWay} bold={isDefaultThreeWay} sub={isDefaultThreeWay ? 'current default resiliency' : undefined} />
          <Row label="Two-Way Mirror efficiency" value="50.0% (1 usable ÷ 2 footprint)" highlight={isDefaultTwoWay} bold={isDefaultTwoWay} sub={isDefaultTwoWay ? 'current default resiliency' : undefined} />
          <Row
            label="Effective usable data — Three-Way Mirror"
            value={`${threeWayEffectiveTB} TB / ${round2(threeWayEffectiveTB * TB_TO_TiB)} TiB`}
            highlight={isDefaultThreeWay}
            bold={isDefaultThreeWay}
            sub={isDefaultThreeWay ? 'plan workloads against this (usable data, not footprint)' : 'usable data space'}
          />
          <Row
            label="Effective usable data — Two-Way Mirror"
            value={`${twoWayEffectiveTB} TB / ${round2(twoWayEffectiveTB * TB_TO_TiB)} TiB`}
            highlight={isDefaultTwoWay}
            bold={isDefaultTwoWay}
            sub={isDefaultTwoWay ? 'plan workloads against this (usable data, not footprint)' : 'usable data space'}
          />
          {!isDefaultTwoWay && !isDefaultThreeWay && (
            <Row
              label={`Effective usable data — ${RESILIENCY_LABELS[result.resiliencyType] ?? result.resiliencyType} (default)`}
              value={`${round2(result.effectiveUsableTB)} TB / ${round2(result.effectiveUsableTB * TB_TO_TiB)} TiB`}
              highlight
              bold
              sub="plan workloads against this (usable data, not footprint)"
            />
          )}
        </tbody>
      </table>

      {/* Capacity Terms Glossary (#62) */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        <button
          className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
          onClick={() => setGlossaryOpen((o) => !o)}
        >
          {glossaryOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
          Capacity Terms Glossary
        </button>
        {glossaryOpen && (
          <dl className="divide-y divide-gray-100 dark:divide-gray-800 px-4 pb-3">
            {GLOSSARY.map(({ term, def }) => (
              <div key={term} className="py-2">
                <dt className="text-xs font-semibold text-gray-700 dark:text-gray-300">{term}</dt>
                <dd className="text-xs text-gray-500 mt-0.5">{def}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
}

function Section({ label }: { label: string }) {
  return (
    <tr className="bg-gray-50 dark:bg-gray-800/50">
      <td colSpan={2} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</td>
    </tr>
  )
}

function Row({ label, value, sub, highlight, bold }: {
  label: string; value: string; sub?: string; highlight?: boolean; bold?: boolean
}) {
  return (
    <tr className={`border-t border-gray-100 dark:border-gray-800 ${highlight ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}>
      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
        {label}
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </td>
      <td className={`px-4 py-2 text-right ${bold ? 'font-bold text-brand-700 dark:text-brand-300' : ''}`}>{value}</td>
    </tr>
  )
}
