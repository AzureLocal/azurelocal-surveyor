import { Fragment, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, ChevronDown, ChevronRight } from 'lucide-react'
import type { HealthCheckResult, HealthDetail, HealthIssue } from '../engine/types'

const RESILIENCY_LABELS: Record<string, string> = {
  'two-way-mirror':   'Two-Way Mirror',
  'three-way-mirror': 'Three-Way Mirror',
  'dual-parity':      'Dual Parity',
  'nested-two-way':   'Nested Two-Way Mirror',
}

// Categorize health check codes for grouped display
type Category = 'volume' | 'pool' | 'cluster' | 'compute'

function categorize(code: string): Category {
  if (code.startsWith('HC_VOLUME') || code === 'HC_RESILIENCY_NODE_COUNT' || code === 'HC_OVER_CAPACITY' || code === 'HC_HIGH_UTILIZATION') return 'volume'
  if (code === 'HC_THIN_PROVISIONING' || code === 'HC_DUAL_PARITY_REQUIRES_4_NODES') return 'pool'
  if (code.startsWith('HC_VCPU') || code.startsWith('HC_MEMORY')) return 'compute'
  return 'cluster'
}

const CATEGORY_LABELS: Record<Category, string> = {
  volume: 'Volume Validation',
  pool: 'Pool Capacity',
  cluster: 'Cluster Configuration',
  compute: 'Compute Resources',
}

const CATEGORY_ORDER: Category[] = ['volume', 'pool', 'cluster', 'compute']

function humanName(code: string): string {
  return code
    .replace(/^HC_/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export default function HealthCheck({ result }: { result: HealthCheckResult }) {
  const [expanded, setExpanded] = useState(!result.passed)
  const [expandedVolumes, setExpandedVolumes] = useState<Record<string, boolean>>({})
  const [expandedIssues, setExpandedIssues] = useState<Record<string, boolean>>({})

  const summaryParts: string[] = []
  if (result.volumeDetails.length > 0) {
    summaryParts.push(`${result.volumeDetails.length} volume${result.volumeDetails.length > 1 ? 's' : ''} planned`)
  }
  if (result.utilizationPct > 0) {
    summaryParts.push(`${result.utilizationPct}% utilized`)
  }
  const summaryText = summaryParts.length > 0 ? summaryParts.join(', ') + '.' : ''

  // Group issues by category
  const grouped = new Map<Category, HealthIssue[]>()
  for (const issue of result.issues) {
    const cat = categorize(issue.code)
    const list = grouped.get(cat) ?? []
    list.push(issue)
    grouped.set(cat, list)
  }

  function toggleVolume(key: string) {
    setExpandedVolumes((current) => ({ ...current, [key]: !current[key] }))
  }

  function toggleIssue(key: string) {
    setExpandedIssues((current) => ({ ...current, [key]: !current[key] }))
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Summary Banner */}
      <button
        className={`flex items-center gap-2 w-full px-4 py-3 text-sm font-semibold text-left transition-colors ${
          result.passed
            ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
            : 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
        }`}
        onClick={() => setExpanded((o) => !o)}
      >
        {result.passed
          ? <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          : <XCircle className="w-5 h-5 text-red-500 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <span>Volume Health Check — {result.passed ? 'Passed' : 'Issues Detected'}</span>
          {result.passed ? (
            <span className="ml-2 text-xs font-normal text-gray-500">
              {summaryText || 'No issues detected.'}
            </span>
          ) : (
            <span className="ml-2 text-xs font-normal text-gray-500">
              {result.errorCount > 0 && `${result.errorCount} error${result.errorCount > 1 ? 's' : ''}`}
              {result.errorCount > 0 && result.warningCount > 0 && ', '}
              {result.warningCount > 0 && `${result.warningCount} warning${result.warningCount > 1 ? 's' : ''}`}
              {(result.errorCount > 0 || result.warningCount > 0) && result.infoCount > 0 && ', '}
              {result.infoCount > 0 && `${result.infoCount} info`}
              {summaryText && ` — ${summaryText}`}
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {/* Per-volume validation table */}
          {result.volumeDetails.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Per-Volume Validation
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs bg-gray-50 dark:bg-gray-800">
                    <th className="px-4 py-1.5 font-semibold">Volume Name</th>
                    <th className="px-4 py-1.5 font-semibold">Resiliency</th>
                    <th className="px-4 py-1.5 font-semibold text-right">Planned (TiB)</th>
                    <th className="px-4 py-1.5 font-semibold text-right">Pool Footprint (TB)</th>
                    <th className="px-4 py-1.5 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.volumeDetails.map((v, i) => {
                    const rowKey = `${v.name}-${i}`
                    const isOpen = !!expandedVolumes[rowKey]

                    return (
                      <Fragment key={rowKey}>
                        <tr
                          className="border-t border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40"
                          onClick={() => toggleVolume(rowKey)}
                        >
                          <td className="px-4 py-1.5 font-medium">
                            <span className="inline-flex items-center gap-2">
                              {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                              {v.name}
                            </span>
                          </td>
                          <td className="px-4 py-1.5 text-xs text-gray-500">{RESILIENCY_LABELS[v.resiliency] ?? v.resiliency}</td>
                          <td className="px-4 py-1.5 text-right font-mono">{v.plannedSizeTiB.toFixed(2)}</td>
                          <td className="px-4 py-1.5 text-right font-mono">{v.poolFootprintTB.toFixed(2)}</td>
                          <td className="px-4 py-1.5 text-center">
                            {v.status === 'pass'
                              ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400"><CheckCircle className="w-3.5 h-3.5" /> PASS</span>
                              : <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400"><XCircle className="w-3.5 h-3.5" /> {v.failReason}</span>
                            }
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40">
                            <td className="px-4 py-3" colSpan={5}>
                              <DetailPanel
                                title={`${v.name} validation checks`}
                                subtitle="Every check that ran against this volume, including calculations, thresholds, and rule sources."
                                details={v.checks}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold">
                    <td className="px-4 py-2" colSpan={3}>Total Pool Footprint</td>
                    <td className="px-4 py-2 text-right font-mono">{result.totalPoolFootprintTB.toFixed(2)} TB</td>
                    <td className="px-4 py-2 text-center text-xs text-gray-500">
                      of {result.availablePoolTB.toFixed(2)} TB available
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Utilization bar */}
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Pool Utilization</span>
                  <span className={`font-semibold ${
                    result.utilizationPct > 100 ? 'text-red-600 dark:text-red-400'
                    : result.utilizationPct > 70 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-green-600 dark:text-green-400'
                  }`}>{result.utilizationPct}%</span>
                </div>
                <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      result.utilizationPct > 100 ? 'bg-red-500'
                      : result.utilizationPct > 70 ? 'bg-amber-500'
                      : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(result.utilizationPct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Categorized issues */}
          {result.issues.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">No issues detected.</div>
          ) : (
            CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => (
              <div key={cat}>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-100 dark:border-gray-800">
                  {CATEGORY_LABELS[cat]}
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {grouped.get(cat)!.map((issue, i) => (
                    <li key={i} className="px-4 py-3">
                      {(() => {
                        const issueKey = `${issue.code}-${i}`
                        const isOpen = !!expandedIssues[issueKey]

                        return (
                          <>
                            <button
                              className="flex items-start gap-3 w-full text-left"
                              onClick={() => toggleIssue(issueKey)}
                            >
                              {issue.severity === 'error' && <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />}
                              {issue.severity === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />}
                              {issue.severity === 'info' && <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-gray-400">{humanName(issue.code)}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    issue.severity === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                    : issue.severity === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  }`}>{issue.severity}</span>
                                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                </div>
                                <div className="text-sm mt-0.5">{issue.message}</div>
                              </div>
                            </button>
                            {isOpen && issue.details && issue.details.length > 0 && (
                              <div className="mt-3 pl-7">
                                <DetailPanel
                                  title="Underlying evaluation"
                                  subtitle="The checks and thresholds that produced this grouped issue."
                                  details={issue.details}
                                />
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function DetailPanel({ title, subtitle, details }: { title: string; subtitle?: string; details: HealthDetail[] }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {details.map((item, index) => (
          <div key={index} className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <StatusBadge status={item.status} />
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{item.label}</span>
            </div>
            <div className="grid gap-2 text-xs text-gray-600 dark:text-gray-400 sm:grid-cols-3">
              <DetailField label="Calculation" value={item.calculation} />
              <DetailField label="Threshold" value={item.threshold} />
              <DetailField label="Outcome" value={item.outcome} />
            </div>
            {item.ruleSource && (
              <div className="text-[11px] text-gray-400">Rule source: {item.ruleSource}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: HealthDetail['status'] }) {
  const classes = status === 'fail'
    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
    : status === 'warning'
      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
      : status === 'info'
        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'

  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${classes}`}>{status}</span>
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold text-gray-500">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  )
}
