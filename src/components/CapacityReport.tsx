import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { CapacityResult } from '../engine/types'
import { round2 } from '../engine/capacity'

// ─── Capacity Pool Stacked Bar (#10) ─────────────────────────────────────────

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

  const segments = [
    { label: 'Reserve', tb: capacity.reserveTB, color: 'bg-gray-400 dark:bg-gray-500' },
    { label: 'Infra volume', tb: capacity.infraVolumeTB, color: 'bg-blue-300 dark:bg-blue-700' },
    { label: 'Volumes', tb: volumeFootprintTB, color: 'bg-brand-500 dark:bg-brand-400' },
    { label: 'Remaining usable', tb: remainingTB, color: 'bg-green-400 dark:bg-green-600' },
  ].filter((s) => s.tb > 0)

  return (
    <div className="px-4 py-3">
      <div className="text-xs font-medium text-gray-500 mb-2">Pool Breakdown (of {total} TB raw)</div>
      {/* Stacked bar */}
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
  { term: 'Usable Capacity',   def: 'Raw capacity minus ~8% overhead (TB-to-TiB conversion + NVMe wear-leveling reserve). Applied per drive.' },
  { term: 'Pool Capacity',     def: 'All usable drives combined into the storage pool. Cache drives are excluded — they only accelerate reads/writes.' },
  { term: 'Reserve',           def: 'One drive equivalent per node (max 4 nodes) held back by S2D for automatic repair after a drive failure. Not user-configurable.' },
  { term: 'Infra Volume',      def: '~250 GB logical volume Azure Local creates automatically for internal system operations (the ClusterStorage CSV).' },
  { term: 'Available Pool',    def: 'Pool minus Reserve minus Infra Volume. This is the pool space your workload volumes draw from.' },
  { term: 'Volume Size',       def: 'The logical capacity you request when creating a volume — what you ask for.' },
  { term: 'Footprint',         def: 'Physical pool space a volume actually consumes. A 1 TB Three-Way Mirror volume uses 3 TB of pool footprint.' },
  { term: 'Efficiency',        def: 'Ratio of logical to physical storage. Two-Way = 50%, Three-Way = 33%, Dual Parity = 50–80% (node-count dependent).' },
  { term: 'TB vs TiB',         def: 'TB = decimal (10¹² bytes). TiB = binary (2⁴⁰ bytes). Windows Admin Center shows TiB. 1 TB ≈ 0.909 TiB. This tool uses TB.' },
  { term: 'Effective Usable',  def: 'The planning number — how much data fits with your default resiliency. = Available Pool × resiliency efficiency.' },
]

export default function CapacityReport({
  result,
  volumesUsedTB,
}: {
  result: CapacityResult
  volumesUsedTB?: number
}) {
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const resiliencyPct = (result.resiliencyFactor * 100).toFixed(1)

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Capacity Report</div>
      {/* Pool breakdown stacked bar chart (#10) */}
      <CapacityStackedBar capacity={result} volumesUsedTB={volumesUsedTB} />
      <div className="border-t border-gray-100 dark:border-gray-800" />
      <table className="w-full text-sm">
        <tbody>
          <Section label="Raw Pool" />
          <Row label="Raw pool (all drives × drive size)" value={`${result.rawPoolTB} TB`} />
          <Row label="Usable per drive (× efficiency factor)" value={`${result.usablePerDriveTB} TB`} />
          <Row label="Total usable (per-drive × drives × nodes)" value={`${result.totalUsableTB} TB`} />

          <Section label="Deductions" />
          <Row label={`Reserve drives (min(${result.nodeCount}, 4) = ${result.reserveDrives} drives)`} value={`− ${result.reserveTB} TB`} />
          <Row label="Infrastructure volume (system CSV)" value={`− ${round2(result.infraVolumeTB)} TB`} />

          <Section label="Available for User Volumes" />
          <Row label="Available for volumes (pool space)" value={`${round2(result.availableForVolumesTB)} TB`} highlight />
          <Row label="Available for volumes (OS-visible)" value={`${round2(result.availableForVolumesTiB)} TiB`} sub="1 TB = 0.9091 TiB — value shown in WAC and PowerShell" />

          <Section label="Planning Number" />
          <Row label={`Default resiliency: ${RESILIENCY_LABELS[result.resiliencyType] ?? result.resiliencyType}`} value={`${resiliencyPct}% efficiency`} />
          <Row label="Effective usable (plan workloads against this)" value={`${round2(result.effectiveUsableTB)} TB`} highlight bold />
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
