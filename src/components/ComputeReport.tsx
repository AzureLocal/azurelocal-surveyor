import { runComputeHealthCheck } from '../engine/healthcheck'
import type { ComputeResult, HealthIssue, MaintenanceReserveMode } from '../engine/types'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'

// ─── Utilization gauge (#10) ──────────────────────────────────────────────────

function UtilizationBar({
  label, used, total, unit, color,
}: {
  label: string; used: number; total: number; unit: string; color: string
}) {
  if (total <= 0) return null
  const pct = Math.min((used / total) * 100, 100)
  const overPct = used > total ? ((used - total) / total) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-gray-500">
          {Math.round(used).toLocaleString()} / {Math.round(total).toLocaleString()} {unit}
          <span className="ml-1 font-mono text-gray-700 dark:text-gray-300">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden border border-gray-200 dark:border-gray-700 relative">
        <div
          className={`h-full rounded-full transition-all ${overPct > 0 ? 'bg-red-500' : color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        {overPct > 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
            OVER CAPACITY
          </div>
        )}
      </div>
    </div>
  )
}

export default function ComputeReport({ result, totalVCpus, totalMemoryGB, maintenanceReserveMode }: {
  result: ComputeResult
  totalVCpus?: number
  totalMemoryGB?: number
  maintenanceReserveMode?: MaintenanceReserveMode
}) {
  // Overcommit sensitivity — show usable vCPUs at common ratios
  const overcommitRatios = [1, 2, 3, 4, 6, 8]
  const { logicalCoresPerNode, nodeCount } = result

  const nPlusOneVCpuFit = totalVCpus !== undefined ? totalVCpus <= result.usableVCpusN1 : null
  const nPlusOneMemFit  = totalMemoryGB !== undefined ? totalMemoryGB <= result.usableMemoryGBN1 : null
  const nPlusTwoVCpuFit = totalVCpus !== undefined ? totalVCpus <= result.usableVCpusN2 : null
  const nPlusTwoMemFit  = totalMemoryGB !== undefined ? totalMemoryGB <= result.usableMemoryGBN2 : null
  // WAF resiliency target from Advanced Settings
  const reserveMode = maintenanceReserveMode ?? 'none'

  const computeIssues = runComputeHealthCheck({
    compute: result,
    totalVCpus: totalVCpus ?? 0,
    totalMemoryGB: totalMemoryGB ?? 0,
  })

  return (
    <div className="space-y-4">
      {/* Utilization gauges (#10) */}
      {(totalVCpus !== undefined || totalMemoryGB !== undefined) && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Compute Utilization</div>
          {totalVCpus !== undefined && (
            <UtilizationBar
              label="vCPU"
              used={totalVCpus}
              total={result.usableVCpus}
              unit="vCPUs"
              color={totalVCpus / result.usableVCpus > 0.9 ? 'bg-amber-500' : 'bg-brand-500'}
            />
          )}
          {totalMemoryGB !== undefined && (
            <UtilizationBar
              label="Memory"
              used={totalMemoryGB}
              total={result.usableMemoryGB}
              unit="GB"
              color={totalMemoryGB / result.usableMemoryGB > 0.9 ? 'bg-amber-500' : 'bg-brand-500'}
            />
          )}
        </div>
      )}

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
            <Row label="Usable vCPUs (all nodes)" value={String(result.usableVCpus)} highlight />
            <Row
              label={`Usable vCPUs — WAF N+1 (${Math.max(0, nodeCount - 1)} nodes active)`}
              value={String(result.usableVCpusN1)}
              sub={`WAF compute resiliency: one node drained/lost${reserveMode === 'n+1' ? ' — active target' : ''}`}
              highlight={reserveMode === 'n+1'}
            />
            <Row
              label={`Usable vCPUs — WAF N+2 (${Math.max(0, nodeCount - 2)} nodes active)`}
              value={String(result.usableVCpusN2)}
              sub={`WAF compute resiliency: two nodes drained/lost${reserveMode === 'n+2' ? ' — active target' : ''}`}
              highlight={reserveMode === 'n+2'}
            />

            <Section label="Memory" />
            <Row label="Physical memory" value={`${result.physicalMemoryGB} GB`} />
            <Row label="System reserved memory" value={`${result.systemReservedMemoryGB} GB`} />
            <Row label="Usable memory (all nodes)" value={`${result.usableMemoryGB} GB`} highlight />
            <Row
              label={`Usable memory — WAF N+1 (${Math.max(0, nodeCount - 1)} nodes active)`}
              value={`${result.usableMemoryGBN1} GB`}
              sub={`WAF compute resiliency: one node drained/lost${reserveMode === 'n+1' ? ' — active target' : ''}`}
              highlight={reserveMode === 'n+1'}
            />
            <Row
              label={`Usable memory — WAF N+2 (${Math.max(0, nodeCount - 2)} nodes active)`}
              value={`${result.usableMemoryGBN2} GB`}
              sub={`WAF compute resiliency: two nodes drained/lost${reserveMode === 'n+2' ? ' — active target' : ''}`}
              highlight={reserveMode === 'n+2'}
            />
            <Row label="NUMA domains (estimate)" value={String(result.numaDomainsEstimate)} />
          </tbody>
        </table>
      </div>

      {/* WAF Compute Resiliency Analysis (#23) */}
      {(totalVCpus !== undefined || totalMemoryGB !== undefined) && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">
            WAF Compute Resiliency — N+1 / N+2 Headroom
          </div>
          <p className="px-4 pt-3 text-xs text-gray-500">
            Per Microsoft WAF, N+1/N+2 reserves CPU and memory so nodes can be drained for updates or survive a node loss without dropping VMs.
            This is a compute concept — it does not reduce storage capacity.
            With {Math.max(0, nodeCount - 1)} node{Math.max(0, nodeCount - 1) !== 1 ? 's' : ''} active (N+1):
            {' '}{result.usableVCpusN1} vCPUs and {result.usableMemoryGBN1} GB RAM available.
            {nodeCount > 2 && (
              <> With {Math.max(0, nodeCount - 2)} node{Math.max(0, nodeCount - 2) !== 1 ? 's' : ''} active (N+2): {result.usableVCpusN2} vCPUs and {result.usableMemoryGBN2} GB RAM available.</>
            )}
          </p>
          <div className="grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-700 m-4 rounded-lg overflow-hidden">
            <div className={`px-4 py-3 ${nPlusOneVCpuFit === true ? 'bg-green-50 dark:bg-green-900/20' : nPlusOneVCpuFit === false ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-gray-900'}`}>
              <div className="text-xs text-gray-500 mb-1">vCPU headroom — N+1 ({Math.max(0, nodeCount - 1)} nodes)</div>
              {totalVCpus !== undefined ? (
                <>
                  <div className={`text-lg font-bold ${nPlusOneVCpuFit ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                    {nPlusOneVCpuFit ? 'Fits' : 'Overloaded'}
                  </div>
                  <div className="text-xs text-gray-500">{totalVCpus} needed / {result.usableVCpusN1} available</div>
                </>
              ) : <div className="text-sm text-gray-400">No workloads planned</div>}
            </div>
            <div className={`px-4 py-3 ${nPlusOneMemFit === true ? 'bg-green-50 dark:bg-green-900/20' : nPlusOneMemFit === false ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-gray-900'}`}>
              <div className="text-xs text-gray-500 mb-1">Memory headroom — N+1 ({Math.max(0, nodeCount - 1)} nodes)</div>
              {totalMemoryGB !== undefined ? (
                <>
                  <div className={`text-lg font-bold ${nPlusOneMemFit ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                    {nPlusOneMemFit ? 'Fits' : 'Overloaded'}
                  </div>
                  <div className="text-xs text-gray-500">{totalMemoryGB} GB needed / {result.usableMemoryGBN1} GB available</div>
                </>
              ) : <div className="text-sm text-gray-400">No workloads planned</div>}
            </div>
            {nodeCount > 2 && (
              <>
                <div className={`px-4 py-3 ${nPlusTwoVCpuFit === true ? 'bg-green-50 dark:bg-green-900/20' : nPlusTwoVCpuFit === false ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-gray-900'}`}>
                  <div className="text-xs text-gray-500 mb-1">vCPU headroom — N+2 ({Math.max(0, nodeCount - 2)} nodes)</div>
                  {totalVCpus !== undefined ? (
                    <>
                      <div className={`text-lg font-bold ${nPlusTwoVCpuFit ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {nPlusTwoVCpuFit ? 'Fits' : 'Overloaded'}
                      </div>
                      <div className="text-xs text-gray-500">{totalVCpus} needed / {result.usableVCpusN2} available</div>
                    </>
                  ) : <div className="text-sm text-gray-400">No workloads planned</div>}
                </div>
                <div className={`px-4 py-3 ${nPlusTwoMemFit === true ? 'bg-green-50 dark:bg-green-900/20' : nPlusTwoMemFit === false ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-gray-900'}`}>
                  <div className="text-xs text-gray-500 mb-1">Memory headroom — N+2 ({Math.max(0, nodeCount - 2)} nodes)</div>
                  {totalMemoryGB !== undefined ? (
                    <>
                      <div className={`text-lg font-bold ${nPlusTwoMemFit ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {nPlusTwoMemFit ? 'Fits' : 'Overloaded'}
                      </div>
                      <div className="text-xs text-gray-500">{totalMemoryGB} GB needed / {result.usableMemoryGBN2} GB available</div>
                    </>
                  ) : <div className="text-sm text-gray-400">No workloads planned</div>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* vCPU overcommit sensitivity table with N+1 Fit column (#25) */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">
          vCPU Overcommit Sensitivity
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 text-left">
              <th className="px-4 py-2 text-xs font-semibold text-gray-500">Overcommit Ratio</th>
              <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">All Nodes</th>
              <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">After Reserve</th>
              <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">N+1 Fit</th>
              <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">Per Node</th>
            </tr>
          </thead>
          <tbody>
            {overcommitRatios.map((ratio) => {
              const total = result.logicalCores * ratio
              const afterReserve = Math.max(0, total - result.systemReservedVCpus)
              const n1Total = logicalCoresPerNode * (nodeCount - 1) * ratio
              const n1Reserve = (result.systemReservedVCpus / nodeCount) * (nodeCount - 1)
              const n1Fit = Math.max(0, Math.round(n1Total - n1Reserve))
              const isActive = Math.abs(afterReserve - result.usableVCpus) < 1
              const workloadFitsN1 = totalVCpus !== undefined ? totalVCpus <= n1Fit : null
              return (
                <tr key={ratio}
                  className={`border-t border-gray-100 dark:border-gray-800 ${isActive ? 'bg-brand-50 dark:bg-brand-900/20 font-semibold' : ''}`}>
                  <td className="px-4 py-2">
                    {ratio}:1{isActive && <span className="ml-2 text-xs text-brand-600 dark:text-brand-400">← current</span>}
                  </td>
                  <td className="px-4 py-2 text-right">{total}</td>
                  <td className="px-4 py-2 text-right">{afterReserve}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={
                      workloadFitsN1 === true ? 'text-green-600 dark:text-green-400 font-semibold' :
                      workloadFitsN1 === false ? 'text-red-600 dark:text-red-400 font-semibold' :
                      'text-gray-700 dark:text-gray-300'
                    }>
                      {n1Fit}
                      {workloadFitsN1 !== null && (
                        <span className="ml-1 text-xs">{workloadFitsN1 ? '✓' : '✗'}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500">{Math.round(afterReserve / nodeCount)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Compute Health Check (Phase 13D) */}
      {computeIssues.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Compute Health Check</div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {computeIssues.map((issue) => (
              <ComputeHealthIssueRow key={issue.code} issue={issue} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ComputeHealthIssueRow({ issue }: { issue: HealthIssue }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 shrink-0">
        {issue.severity === 'error'   && <AlertCircle    className="w-4 h-4 text-red-500" />}
        {issue.severity === 'warning' && <AlertTriangle  className="w-4 h-4 text-amber-500" />}
        {issue.severity === 'info'    && <Info           className="w-4 h-4 text-blue-500" />}
      </span>
      <div>
        <div className="text-sm font-medium">{issue.message}</div>
        <div className="text-xs text-gray-400 mt-0.5 font-mono">{issue.code}</div>
      </div>
    </li>
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
