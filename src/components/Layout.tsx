import { NavLink } from 'react-router-dom'
import {
  Server, Cpu, Monitor, HardDrive, BarChart3,
  Settings, BookOpen, Link2, FileText, Container
} from 'lucide-react'
import { useSurveyorStore } from '../state/store'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { avdEnabled, sofsEnabled, aks } = useSurveyorStore()

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Sidebar — always dark navy to match azurelocal.cloud brand */}
      <aside className="w-56 shrink-0 flex flex-col" style={{ backgroundColor: '#0f3057' }}>
        <div className="px-4 py-5 border-b border-white/10">
          <div className="text-xs font-semibold text-blue-200 uppercase tracking-wider">Azure Local</div>
          <div className="text-lg font-bold leading-tight text-white">Surveyor</div>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          <NavItem to="/" label="Hardware" icon={Server} end />
          <NavItem to="/workloads" label="Workloads" icon={Cpu} />
          {avdEnabled   && <NavItem to="/avd"  label="AVD"  icon={Monitor}    />}
          {sofsEnabled  && <NavItem to="/sofs" label="SOFS" icon={HardDrive}  />}
          {aks.enabled  && <NavItem to="/aks"  label="AKS"  icon={Container}  />}
          <NavItem to="/volumes" label="Volumes" icon={HardDrive} />
          <NavItem to="/reports" label="Reports" icon={BarChart3} />
          <NavItem to="/thin-provisioning" label="Thin Provision" icon={BookOpen} />
          <NavItem to="/references" label="References" icon={Link2} />
          <NavItem to="/docs" label="Docs" icon={FileText} />
        </nav>
        <div className="px-2 py-3 border-t border-white/10">
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-200 hover:text-white rounded-md hover:bg-white/10 transition-colors"
            onClick={() => document.getElementById('advanced-settings-dialog')?.showPopover?.()}
          >
            <Settings className="w-4 h-4" />
            Advanced Settings
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}

function NavItem({
  to, label, icon: Icon, end,
}: {
  to: string; label: string; icon: React.ElementType; end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ` +
        (isActive
          ? 'bg-brand-500/40 text-white'
          : 'text-blue-200 hover:bg-white/10 hover:text-white')
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </NavLink>
  )
}
