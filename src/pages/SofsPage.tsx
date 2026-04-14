import { ExternalLink } from 'lucide-react'
import SofsPlanner from '../components/SofsPlanner'
import { useSurveyorStore } from '../state/store'

export default function SofsPage() {
  const { sofsEnabled, setSofsEnabled } = useSurveyorStore()

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">SOFS Planner</h1>
          <p className="text-sm text-gray-500 mt-1">
            Scale-Out File Server guest cluster sizing for FSLogix profile share scale-out.
            Ports the 25 formulas from the SOFS Planner sheet.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1 shrink-0">
          <span className="text-sm text-gray-600 dark:text-gray-400">Include in cluster totals</span>
          <button
            onClick={() => setSofsEnabled(!sofsEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${sofsEnabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${sofsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {!sofsEnabled && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          SOFS is currently <strong>excluded</strong> from workload totals and health checks.
          Enable the toggle above to include SOFS compute and storage in cluster planning.
        </div>
      )}

      {/* #73: SOFS explanation and docs link */}
      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-4 text-sm space-y-2">
        <p className="text-gray-700 dark:text-gray-300">
          <strong>Scale-Out File Server (SOFS)</strong> is a Windows Server guest cluster running inside
          Azure Local that provides highly available SMB file shares for FSLogix profile containers.
          SOFS is recommended when AVD user counts exceed ~200 users or when you need HA for profile
          storage independent of any single VM. The SOFS guest VMs use S2D or Storage Spaces internally
          to mirror data, which compounds with the Azure Local cluster resiliency.
        </p>
        <p className="text-xs text-gray-500">
          When AVD host pools target SOFS for profile storage, Surveyor aggregates only those pools into the
          SOFS-linked user count, concurrency, and profile-size values. The toggle above still controls whether
          the SOFS guest cluster itself is included in cluster totals and health checks.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <DocLink href="https://azurelocal.cloud/azurelocal-sofs-fslogix/" label="SOFS + FSLogix Guide" />
          <DocLink href="https://learn.microsoft.com/windows-server/failover-clustering/sofs-overview" label="Microsoft Learn: SOFS Overview" />
        </div>
      </div>

      <SofsPlanner />
    </div>
  )
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-700 dark:text-brand-300 bg-white dark:bg-gray-900 border border-brand-200 dark:border-brand-800 rounded-md hover:bg-brand-50 dark:hover:bg-brand-900/50 transition-colors"
    >
      <ExternalLink className="w-3 h-3" />
      {label}
    </a>
  )
}
