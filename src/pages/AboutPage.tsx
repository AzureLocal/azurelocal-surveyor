import { version } from '../../package.json'

const RELEASE_HISTORY = [
  {
    version: '1.0.0',
    label: 'Quick-Start Volumes and Report Alignment',
    items: [
      'Quick-start volumes table — hardware-based equal-split reference with fit check',
      'Volume mode toggle — workload-based vs generic hardware-based sizing',
      'Expanded volume health check with summary banner and detailed breakdown',
      'OEM preset verification against Azure Local hardware catalog',
      'Unified exports, PowerShell scripts, and report alignment',
    ],
  },
  {
    version: '0.4.0',
    label: 'MABS, VM Scenarios, and Drive Layout',
    items: [
      'MABS (Microsoft Azure Backup Server) backup planner',
      'VM scenarios consolidation and workload-based volume suggestions',
      'Drive layout comparison page',
      'Advanced settings overrides for formula-calculated values',
      'Drive size standardized dropdown and TiB labeling',
    ],
  },
  {
    version: '0.3.0',
    label: 'SOFS, AKS, Health Check, and Exports',
    items: [
      'Scale-Out File Server (SOFS) planner — sizing, IOPS, FSLogix, readiness checklist',
      'AKS on Azure Local planning page',
      'Expanded volume health check matching Excel workbook (52 checks)',
      'PDF/XLSX exports, PowerShell volume commands, Best Practice Notes',
      'Thin Provisioning reference guide and Microsoft Learn references catalog',
      'N+1 failover analysis, per-scenario vCPU overcommit ratios',
    ],
  },
  {
    version: '0.2.0',
    label: 'AVD Planner and Compute Report',
    items: [
      'Azure Virtual Desktop planner — session host density, FSLogix sizing, network bandwidth',
      'AVD user type mix estimator and profile storage location selector',
      'Tabbed Reports view — Capacity / Compute / Final',
      'Conditional sidebar navigation, TiB vs TB callouts',
    ],
  },
  {
    version: '0.1.0',
    label: 'Initial Release',
    items: [
      'Hardware inputs, S2D capacity engine, and Capacity Report',
      'Workload planner with multi-scenario vCPU and memory planning',
      'Basic volume planning, Azure Local brand identity, GitHub Pages routing',
    ],
  },
]

const LINKS = [
  {
    label: 'GitHub Repository',
    href: 'https://github.com/AzureLocal/azurelocal-surveyor',
    description: 'Source code, issues, and pull requests',
  },
  {
    label: 'Release Roadmap',
    href: 'https://github.com/AzureLocal/azurelocal-surveyor/milestones',
    description: 'Planned releases and issue backlog organized by milestone',
  },
  {
    label: 'Report a Bug',
    href: 'https://github.com/AzureLocal/azurelocal-surveyor/issues/new',
    description: 'Open a GitHub issue to report a problem or request a feature',
  },
  {
    label: 'Changelog',
    href: 'https://github.com/AzureLocal/azurelocal-surveyor/blob/main/CHANGELOG.md',
    description: 'Full release history with detailed change notes',
  },
  {
    label: 'Azure Local Surveyor Docs',
    href: 'https://azurelocal.cloud/azurelocal-surveyor/',
    description: 'Feature overview, usage guide, and methodology',
  },
]

export default function AboutPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">About</h1>
        <p className="text-sm text-gray-500 mt-1">
          Azure Local Surveyor — capacity planning for Azure Local clusters.
        </p>
      </div>

      {/* Version badge */}
      <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Current Version</div>
          <div className="text-3xl font-bold text-brand-600 dark:text-brand-400 font-mono">v{version}</div>
        </div>
        <div className="h-10 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>Hardware sizing, volume planning, workload analysis, and capacity reports for Azure Local (Storage Spaces Direct) deployments.</p>
          <p className="mt-1">Ported from the Azure Local S2D Capacity Calculator Excel workbook.</p>
        </div>
      </section>

      {/* Links */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Resources</h2>
        <div className="space-y-2">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors group"
            >
              <div>
                <div className="text-sm font-semibold text-brand-700 dark:text-brand-300 group-hover:underline">{link.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{link.description}</div>
              </div>
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400 group-hover:text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ))}
        </div>
      </section>

      {/* Credits */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Credits</h2>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Built by </span>
            <a href="https://azurelocal.cloud" target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline">AzureLocal.cloud</a>
            {' '}— community-driven Azure Local guidance, tools, and reference architecture.
          </div>
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Based on </span>
            the Azure Local S2D Capacity Calculator Excel workbook — formulas and methodology ported directly from the workbook into a live web app.
          </div>
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Built with </span>
            React, Vite, TypeScript, Tailwind CSS, Radix UI, Zustand, jsPDF, and SheetJS.
          </div>
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
            &copy; 2026 Azure Local Cloud. Released under the{' '}
            <a href="https://github.com/AzureLocal/azurelocal-surveyor/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600 dark:hover:text-gray-300">MIT License</a>.
          </div>
        </div>
      </section>

      {/* Release history */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Release History</h2>
        <div className="space-y-4">
          {RELEASE_HISTORY.map((release) => (
            <div
              key={release.version}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400">v{release.version}</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{release.label}</span>
              </div>
              <ul className="space-y-1">
                {release.items.map((item) => (
                  <li key={item} className="text-xs text-gray-500 flex gap-2">
                    <span className="text-gray-300 dark:text-gray-600 shrink-0">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
