import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  Home, Server, Cpu, Monitor, HardDrive, BarChart3,
  Settings, BookOpen, Link2, FileText, Container, X, Layers, ShieldCheck, Info,
} from 'lucide-react'
import { useSurveyorStore } from '../state/store'
import AdvancedSettings from './AdvancedSettings'
import { ErrorBoundary } from './ErrorBoundary'
import { version } from '../../package.json'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { avdEnabled, sofsEnabled, mabsEnabled, aks } = useSurveyorStore()
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Sidebar — always dark navy to match azurelocal.cloud brand */}
      <aside className="w-56 shrink-0 flex flex-col" style={{ backgroundColor: '#0f3057' }}>
        <div className="px-4 py-4 border-b border-white/10">
          {/* Azure Local logo mark — hexagon with circuit styling */}
          <Link to="/" className="flex items-center gap-2.5 mb-1 rounded-md hover:bg-white/5 transition-colors -mx-2 px-2 py-1">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="shrink-0">
              <polygon points="14,2 25,8 25,20 14,26 3,20 3,8" fill="#0078d4" stroke="#66aee4" strokeWidth="1.5"/>
              <circle cx="14" cy="14" r="4" fill="white" opacity="0.9"/>
              <line x1="14" y1="10" x2="14" y2="5" stroke="white" strokeWidth="1.5" opacity="0.6"/>
              <line x1="14" y1="18" x2="14" y2="23" stroke="white" strokeWidth="1.5" opacity="0.6"/>
              <line x1="10.5" y1="12" x2="6" y2="9.5" stroke="white" strokeWidth="1.5" opacity="0.6"/>
              <line x1="17.5" y1="16" x2="22" y2="18.5" stroke="white" strokeWidth="1.5" opacity="0.6"/>
            </svg>
            <div>
              <div className="text-xs font-semibold text-blue-200 uppercase tracking-widest leading-none">Azure Local</div>
              <div className="text-base font-bold leading-tight text-white">Surveyor</div>
            </div>
          </Link>
          <div className="text-xs text-blue-300/60 mt-1">Capacity Planning Tool</div>
          <div className="text-xs text-blue-300/40 mt-0.5 font-mono">v{version}</div>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          <NavItem to="/" label="Home" icon={Home} end />
          <NavItem to="/hardware" label="Hardware" icon={Server} end />
          <NavItem to="/workloads" label="Workloads" icon={Cpu} />
          {avdEnabled   && <NavItem to="/avd"  label="AVD"  icon={Monitor}    />}
          {sofsEnabled  && <NavItem to="/sofs" label="SOFS" icon={HardDrive}  />}
          {aks.enabled  && <NavItem to="/aks"  label="AKS"  icon={Container}  />}
          {mabsEnabled  && <NavItem to="/mabs" label="MABS" icon={ShieldCheck} />}
          <NavItem to="/volumes" label="Volumes" icon={HardDrive} />
          <NavItem to="/drive-layout" label="Drive Layout" icon={Layers} />
          <NavItem to="/reports" label="Reports" icon={BarChart3} />
          <NavItem to="/thin-provisioning" label="Thin Provision" icon={BookOpen} />
          <NavItem to="/references" label="References" icon={Link2} />
          <NavItem to="/docs" label="Docs" icon={FileText} />
          <NavItem to="/about" label="About" icon={Info} />
        </nav>
        <div className="px-2 py-3 border-t border-white/10">
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-200 hover:text-white rounded-md hover:bg-white/10 transition-colors"
            onClick={() => setAdvancedOpen(true)}
          >
            <Settings className="w-4 h-4" />
            Advanced Settings
          </button>
          <div className="px-3 pt-2 text-xs text-blue-300/30 leading-snug">
            &copy; 2026 Azure Local Cloud<br />MIT License
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>

      {/* Advanced Settings modal */}
      {advancedOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end"
          onClick={(e) => { if (e.target === e.currentTarget) setAdvancedOpen(false) }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />
          {/* Panel */}
          <div className="relative z-10 h-full w-full max-w-xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold">Advanced Settings</h2>
              <button
                onClick={() => setAdvancedOpen(false)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <AdvancedSettings />
            </div>
          </div>
        </div>
      )}
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
