import FinalReport from '../components/FinalReport'
import AdvancedSettings from '../components/AdvancedSettings'
import { useState } from 'react'
import { Settings } from 'lucide-react'

export default function ReportsPage() {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Final Report</h1>
          <p className="text-sm text-gray-500 mt-1">
            Full plan summary — capacity, compute, volumes, AVD, SOFS, and health check.
            Export to PDF, XLSX, PowerShell, or Markdown.
          </p>
        </div>
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Settings className="w-4 h-4" />
          Advanced Settings
        </button>
      </div>

      {showAdvanced && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold mb-4">Advanced Settings</h2>
          <AdvancedSettings />
        </div>
      )}

      <FinalReport />
    </div>
  )
}
