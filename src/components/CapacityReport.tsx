import type { CapacityResult } from '../engine/types'

export default function CapacityReport({ result }: { result: CapacityResult }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Capacity Report</div>
      <table className="w-full text-sm">
        <tbody>
          <Row label="Raw pool" value={`${result.rawPoolTB} TB`} />
          <Row label="Pool reserve" value={`${result.poolReserveTB} TB`} />
          <Row label="Net pool" value={`${result.netPoolTB} TB`} />
          <Row label="Resiliency" value={result.resiliencyType} />
          <Row label="Resiliency factor" value={`${(result.resiliencyFactor * 100).toFixed(1)}%`} />
          <Row label="Usable after resiliency" value={`${result.usableAfterResiliencyTB} TB`} />
          <Row label="Effective usable" value={`${result.effectiveUsableTB} TB`} highlight />
        </tbody>
      </table>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr className={`border-t border-gray-100 dark:border-gray-800 ${highlight ? 'bg-brand-50 dark:bg-brand-900/20 font-semibold' : ''}`}>
      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{label}</td>
      <td className="px-4 py-2 text-right">{value}</td>
    </tr>
  )
}
