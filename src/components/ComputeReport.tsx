import type { ComputeResult } from '../engine/types'

export default function ComputeReport({ result }: { result: ComputeResult }) {
  // Overcommit sensitivity — show usable vCPUs at common ratios
  const physicalBase = result.logicalCores  // already accounts for hyperthreading
  const overcommitRatios = [1, 2, 3, 4, 6, 8]

  return (
    <div className="space-y-4">
      {/* Main compute table */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Compute Report</div>
        <table className="w-full text-sm">
          <tbody>
            <Section label="CPU" />
            <Row label="Physical cores" value={String(result.physicalCores)} />
            <Row label={`Hyperthreading: ${result.hyperthreadingEnabled ? 'Enabled' : 'Disabled'}`}
              value={result.hyperthreadingEnabled ? `${result.logicalCores} logical cores (×2)` : `${result.logicalCores} logical cores`} />
            <Row label="System reserved vCPUs" value={String(result.systemReservedVCpus)} />
            <Row label="Usable vCPUs" value={String(result.usableVCpus)} highlight />

            <Section label="Memory" />
            <Row label="Physical memory" value={`${result.physicalMemoryGB} GB`} />
            <Row label="System reserved memory" value={`${result.systemReservedMemoryGB} GB`} />
            <Row label="Usable memory" value={`${result.usableMemoryGB} GB`} highlight />
            <Row label="NUMA domains (estimate)" value={String(result.numaDomainsEstimate)} />
          </tbody>
        </table>
      </div>

      {/* vCPU overcommit sensitivity table */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">
          vCPU Overcommit Sensitivity
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 text-left">
              <th className="px-4 py-2 text-xs font-semibold text-gray-500">Overcommit Ratio</th>
              <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">Total vCPUs</th>
              <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">After Reservation</th>
              <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">Per-Node</th>
            </tr>
          </thead>
          <tbody>
            {overcommitRatios.map((ratio) => {
              const total = physicalBase * ratio
              const afterReserve = Math.max(0, total - result.systemReservedVCpus)
              const isActive = Math.abs(total - result.usableVCpus - result.systemReservedVCpus) < 1
              return (
                <tr key={ratio}
                  className={`border-t border-gray-100 dark:border-gray-800 ${isActive ? 'bg-brand-50 dark:bg-brand-900/20 font-semibold' : ''}`}>
                  <td className="px-4 py-2">
                    {ratio}:1{isActive && <span className="ml-2 text-xs text-brand-600 dark:text-brand-400">← current</span>}
                  </td>
                  <td className="px-4 py-2 text-right">{total}</td>
                  <td className="px-4 py-2 text-right">{afterReserve}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{Math.round(afterReserve / (result.numaDomainsEstimate / 2))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Section({ label }: { label: string }) {
  return (
    <tr className="bg-gray-50/50 dark:bg-gray-800/30">
      <td colSpan={2} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</td>
    </tr>
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
