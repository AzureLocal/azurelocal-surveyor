import { useState } from 'react'
import HardwareForm from '../components/HardwareForm'
import CapacityReport from '../components/CapacityReport'
import { useSurveyorStore } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { validateHardwareInputs } from '../engine/hardware'
import HealthCheck from '../components/HealthCheck'
import { X } from 'lucide-react'

export default function HardwarePage() {
  const { hardware, advanced, volumes } = useSurveyorStore()
  const capacity = computeCapacity(hardware, advanced)
  const validation = validateHardwareInputs(hardware)
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  // Show onboarding banner when user hasn't added volumes yet (#19)
  const showOnboarding = !onboardingDismissed && volumes.length === 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Hardware Inputs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Define your Azure Local cluster hardware. All other calculations derive from this sheet.
        </p>
      </div>

      {/* Onboarding banner (#19) */}
      {showOnboarding && (
        <div className="rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-brand-800 dark:text-brand-300 mb-2">
                Welcome to Azure Local Surveyor
              </h2>
              <p className="text-sm text-brand-700 dark:text-brand-400 mb-3">
                Plan your Azure Local S2D cluster capacity in 4 steps:
              </p>
              <ol className="space-y-1.5 text-sm text-brand-700 dark:text-brand-400">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 font-bold">1.</span>
                  <span><strong>Hardware</strong> (this page) — enter node count, drive configuration, CPU and memory.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 font-bold">2.</span>
                  <span><strong>Workloads</strong> — enable scenarios (AVD, AKS, VMs, SOFS) to size compute and storage demand.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 font-bold">3.</span>
                  <span><strong>Volumes</strong> — plan your Cluster Shared Volumes with resiliency types.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 font-bold">4.</span>
                  <span><strong>Reports</strong> — review health checks, export to PDF, XLSX, PowerShell, or Markdown.</span>
                </li>
              </ol>
              <p className="text-xs text-brand-600 dark:text-brand-500 mt-3">
                Tip: use an OEM Preset to quickly populate hardware specs, or check the <strong>Docs</strong> page for detailed guidance.
              </p>
            </div>
            <button
              onClick={() => setOnboardingDismissed(true)}
              className="shrink-0 text-brand-400 hover:text-brand-600 dark:text-brand-600 dark:hover:text-brand-400"
              title="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <HardwareForm />

      {!validation.passed && (
        <HealthCheck result={validation} />
      )}

      <CapacityReport result={capacity} />
    </div>
  )
}
