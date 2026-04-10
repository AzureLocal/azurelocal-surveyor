import type { ComputeResult } from '../engine/types'

export default function ComputeReport({ result }: { result: ComputeResult }) {
  const vcpuPct = result.usableVCpus > 0
    ? Math.round((result.systemReservedVCpus / (result.usableVCpus + result.systemReservedVCpus)) * 100)
    : 0

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Compute Report</div>
      <table className="w-full text-sm">
        <tbody>
          <Row label="Physical cores" value={String(result.physicalCores)} />
          <Row label="System reserved vCPUs" value={String(result.systemReservedVCpus)} sub={`${vcpuPct}% overhead`} />
          <Row label="Usable vCPUs" value={String(result.usableVCpus)} highlight />
          <Row label="Physical memory" value={`${result.physicalMemoryGB} GB`} />
          <Row label="System reserved memory" value={`${result.systemReservedMemoryGB} GB`} />
          <Row label="Usable memory" value={`${result.usableMemoryGB} GB`} highlight />
          <Row label="NUMA domains (estimate)" value={String(result.numaDomainsEstimate)} />
        </tbody>
      </table>
    </div>
  )
}

function Row({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <tr className={`border-t border-gray-100 dark:border-gray-800 ${highlight ? 'bg-brand-50 dark:bg-brand-900/20 font-semibold' : ''}`}>
      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
        {label}
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </td>
      <td className="px-4 py-2 text-right">{value}</td>
    </tr>
  )
}
