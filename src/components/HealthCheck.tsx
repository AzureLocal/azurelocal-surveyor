import type { HealthCheckResult } from '../engine/types'
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'

export default function HealthCheck({ result }: { result: HealthCheckResult }) {
  const icon = result.passed
    ? <CheckCircle className="w-5 h-5 text-green-500" />
    : <XCircle className="w-5 h-5 text-red-500" />

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold ${result.passed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
        {icon}
        Volume Health Check — {result.passed ? 'Passed' : 'Failed'}
      </div>
      {result.issues.length === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-500">No issues detected.</div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {result.issues.map((issue, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3">
              {issue.severity === 'error' && <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />}
              {issue.severity === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />}
              {issue.severity === 'info' && <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />}
              <div>
                <div className="text-sm">{issue.message}</div>
                <div className="text-xs text-gray-400 mt-0.5">{issue.code}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
