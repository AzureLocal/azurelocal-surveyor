import { NavLink } from 'react-router-dom'
import {
  Server, Cpu, Monitor, HardDrive, BarChart3,
  Settings
} from 'lucide-react'

const NAV = [
  { to: '/',          label: 'Hardware',    icon: Server      },
  { to: '/workloads', label: 'Workloads',   icon: Cpu         },
  { to: '/avd',       label: 'AVD',         icon: Monitor     },
  { to: '/sofs',      label: 'SOFS',        icon: HardDrive   },
  { to: '/volumes',   label: 'Volumes',     icon: HardDrive   },
  { to: '/reports',   label: 'Reports',     icon: BarChart3   },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-800">
          <div className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Azure Local</div>
          <div className="text-lg font-bold leading-tight">Surveyor</div>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ` +
                (isActive
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800')
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-2 py-3 border-t border-gray-200 dark:border-gray-800">
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
