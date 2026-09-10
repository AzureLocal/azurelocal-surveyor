import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ExternalLink, Settings, X } from 'lucide-react'
import { useSurveyorStore } from '../state/usePlanStore'
import { createProject, downloadProject } from '../state/project'
import { usePlanningArea } from '../state/planning-area'
import AdvancedSettings from './AdvancedSettings'
import { ErrorBoundary } from './ErrorBoundary'
import { version } from '../../package.json'

const storageLinks = [
  ['/storage', 'Storage overview'], ['/storage/hardware', 'Hardware & Drives'],
  ['/storage/capacity', 'Capacity & Resiliency'], ['/storage/volumes', 'Volume Planning'],
  ['/storage/drive-layout', 'Compare Drive Layouts'], ['/storage/reports', 'Storage Report'],
]
const workloadLinks = [
  ['/planning', 'Planning paths'], ['/planning/workloads', 'Workloads'],
  ['/planning/specialized', 'Specialized Workloads'], ['/planning/hardware', 'Hardware'],
  ['/planning/volumes', 'Storage Design'], ['/planning/fit', 'Fit & Recommendations'],
  ['/planning/recommendations', 'Hardware Options'], ['/planning/reports', 'Reports & Exports'],
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const state = useSurveyorStore()
  const area = usePlanningArea()
  const { pathname } = useLocation()
  const inPlan = pathname.startsWith('/storage') || pathname.startsWith('/planning')
  const prefix = area === 'storage' ? '/storage' : '/planning'
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const navClass = ({ isActive }: { isActive: boolean }) => 'block rounded-md px-3 py-2 text-sm transition-colors ' + (isActive ? 'bg-blue-500/30 text-white font-semibold' : 'text-blue-200 hover:bg-white/10 hover:text-white')
  return <div className="min-h-screen lg:flex bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
    <aside className="lg:w-64 lg:h-screen lg:sticky lg:top-0 shrink-0 bg-[#0f3057] text-white no-print overflow-y-auto">
      <Link to="/" className="block p-5 border-b border-white/10"><span className="block text-xs uppercase tracking-widest text-blue-200">Azure Local</span><span className="text-xl font-bold">Surveyor</span><span className="block text-xs text-blue-200 mt-1">Plan your cluster · v{version}</span></Link>
      <nav aria-label="Main navigation" className="p-3 space-y-1">
        <NavLink to="/" end className={navClass}>Overview</NavLink>
        <NavLink to="/storage" className={navClass}>Storage Sizing</NavLink>
        <NavLink to="/planning" className={navClass}>Workload Planning</NavLink>
      </nav>
      {inPlan && <nav aria-label={area === 'storage' ? 'Storage sizing sections' : 'Workload planning sections'} className="px-3 pb-4 space-y-1 border-b border-white/10">
        <p className="px-3 py-2 text-xs uppercase tracking-wide text-blue-300">{area === 'storage' ? 'Storage plan' : 'Workload plan'}</p>
        {(area === 'storage' ? storageLinks : workloadLinks).map(([to, label]) => <NavLink key={to} to={to} end className={navClass}>{label}</NavLink>)}
      </nav>}
      <nav aria-label="Help and related tools" className="p-3 space-y-1">
        <NavLink to="/help" className={navClass}>Help & Reference</NavLink>
        <NavLink to="/about" className={navClass}>About</NavLink>
        <a href="https://labs.hybridsolutions.cloud/hyperv-surveyor" target="_blank" rel="noopener noreferrer" className="block rounded-md border border-blue-300/30 px-3 py-3 mt-4 text-sm text-blue-200 hover:bg-white/10">
          <strong className="block text-xs mb-1">Planning Windows Server Hyper-V?</strong>
          Open Hyper-V Surveyor <ExternalLink className="inline w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </nav>
    </aside>
    <div className="flex-1 min-w-0">
      {inPlan && <header className="no-print border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-500 flex-1 min-w-48">{area === 'storage' ? 'Storage Sizing' : 'Workload Planning'} · active project<input aria-label="Active project name" className="input mt-1" value={state.planName} onChange={e => state.setPlanName(e.target.value)} /></label>
          <Link to={prefix + '/projects'} className="action-secondary">Open / Compare</Link>
          <button className="action" onClick={() => { downloadProject(createProject(state, state.planName, area)); setNotice('Project downloaded.') }}>Save project</button>
          <Dialog.Root open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <Dialog.Trigger asChild><button className="action-secondary"><Settings className="inline w-4 h-4 mr-1" />Planning assumptions</button></Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 no-print" />
              <Dialog.Content aria-describedby={undefined} className="fixed right-0 top-0 z-50 w-full max-w-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 h-full overflow-y-auto p-5 no-print">
                <div className="flex justify-between items-center mb-4"><Dialog.Title className="text-lg font-semibold">Planning assumptions</Dialog.Title><Dialog.Close asChild><button className="action-secondary" aria-label="Close planning assumptions"><X className="w-4 h-4" /></button></Dialog.Close></div>
                <AdvancedSettings />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
        {notice && <p className="text-xs text-green-700 mt-2" role="status">{notice}</p>}
      </header>}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6"><ErrorBoundary>{children}</ErrorBoundary></main>
    </div>
  </div>
}
