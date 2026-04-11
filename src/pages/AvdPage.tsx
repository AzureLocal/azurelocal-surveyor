import { ExternalLink } from 'lucide-react'
import AvdPlanner from '../components/AvdPlanner'

export default function AvdPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AVD Planner</h1>
        <p className="text-sm text-gray-500 mt-1">
          Azure Virtual Desktop session host and FSLogix storage sizing.
          Ports the 80 formulas from the AVD Planning sheet.
        </p>
      </div>

      {/* #73: AVD explanation and docs link */}
      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-4 text-sm space-y-2">
        <p className="text-gray-700 dark:text-gray-300">
          <strong>Azure Virtual Desktop (AVD)</strong> delivers Windows 11 multi-session or single-session VDI
          desktops from session hosts running on your Azure Local cluster. Each session host is a Hyper-V VM
          consuming vCPUs, memory, and OS disk storage. FSLogix profile containers store user profiles as
          VHDXs — sizing depends on user count, profile size, and growth buffer.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <DocLink href="https://azurelocal.cloud/azurelocal-avd/" label="AVD on Azure Local Guide" />
          <DocLink href="https://learn.microsoft.com/azure/virtual-desktop/azure-local-overview" label="Microsoft Learn: AVD on Azure Local" />
        </div>
      </div>

      <AvdPlanner />
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
