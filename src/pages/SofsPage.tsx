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

      <SofsPlanner />
    </div>
  )
}
