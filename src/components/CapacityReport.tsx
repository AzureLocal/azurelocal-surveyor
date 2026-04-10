import type { CapacityResult } from '../engine/types'
import { round2 } from '../engine/capacity'

const RESILIENCY_LABELS: Record<string, string> = {
  'two-way-mirror':   'Two-Way Mirror (50%)',
  'three-way-mirror': 'Three-Way Mirror (33%)',
  'dual-parity':      'Dual Parity',
  'nested-two-way':   'Nested Two-Way (25%)',
}

export default function CapacityReport({ result }: { result: CapacityResult }) {
  const resiliencyPct = (result.resiliencyFactor * 100).toFixed(1)

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Capacity Report</div>
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
          <Row label="Available for volumes (OS-visible)" value={`${round2(result.availableForVolumesTiB)} TiB`} sub="1 TB = 0.9091 TiB" />

          <Section label="Planning Number" />
          <Row label={`Default resiliency: ${RESILIENCY_LABELS[result.resiliencyType] ?? result.resiliencyType}`} value={`${resiliencyPct}% efficiency`} />
          <Row label="Effective usable (plan workloads against this)" value={`${round2(result.effectiveUsableTB)} TB`} highlight bold />
        </tbody>
      </table>
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
