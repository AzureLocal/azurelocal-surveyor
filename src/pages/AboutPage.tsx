import { version } from '../../package.json'

const RELEASE_HISTORY = [
  {
    version: '2.1.4',
    label: 'Multi-Threshold Pool Utilization Reference',
    items: [
      'Best Practice Volume Reference table now shows four threshold bands (70/80/90/100%) for Three-Way Mirror and Two-Way Mirror (#156)',
      'Suggested Volumes section adds a 70/80/90/100% pool utilization target selector; defaults to 70% to avoid the WAC rebuild-headroom alert (#156)',
      'PowerShell quick-create script follows the selected reference band via a segmented button selector (#156)',
    ],
  },
  {
    version: '2.1.3',
    label: 'Generic Volume Suggestion Fix',
    items: [
      'Generic Hardware-Based volume suggestions now floor per-volume size to prevent Over Capacity error on add (#154)',
    ],
  },
  {
    version: '2.1.2',
    label: 'About Page Link Corrections',
    items: [
      'About page Docs link now routes to the in-app documentation page; S2DCartographer link points to the documentation site (#153)',
    ],
  },
  {
    version: '2.1.1',
    label: 'SOFS Volume Layout Fix',
    items: [
      'SOFS host volume suggestions now combine guest OS disk and data on the same Azure Local volume for both shared and per-VM layouts (#152)',
    ],
  },
  {
    version: '2.1.0',
    label: 'Planner Accuracy and Release Alignment',
    items: [
      'Capacity Report now shows Two-Way Mirror and Three-Way Mirror efficiency and effective usable values side by side',
      'SOFS auto-sizing now uses the SOFS guest VM count directly and is colocated with guest cluster configuration',
      'Pool utilization display no longer shows 101% from rounding drift and only turns red on true over-capacity',
      'HC_HIGH_UTILIZATION wording now distinguishes reserve drives from rebuild headroom inside the pool',
      'AVD profile and Office Container volume suggestions are suppressed when FSLogix is hosted on SOFS',
      'MABS planner now supports OS disk placement as either a dedicated volume or shared VM storage',
      'ReFS deduplication and compression research documented for future capacity-model enhancements',
    ],
  },
  {
    version: '2.0.0',
    label: 'Comprehensive Quality Overhaul',
    items: [
      'Per-volume resiliency and provisioning — each volume on the Volumes page controls its own resiliency and fixed/thin setting',
      'AKS multi-cluster support — plan multiple independent AKS clusters, each with their own node specs and PVC storage',
      'Arc-enabled service presets integrated into AKS worker capacity instead of being additive',
      'AVD planner intelligence — conditional field behavior by storage location, separate session host VM storage section',
      'SOFS planner overhaul — shared vs per-VM volume layout, OS disk volumes per VM',
      'MABS planner cleanup — CSV-level resiliency removed, MABS-BackupData defaults to thin provisioning',
      'VM storage groups — define multiple VM tiers (e.g. SQL vs web), each generating its own volume suggestion',
      'Custom workloads — internalMirrorFactor wired into engine, JSON import validation, OS disk volumes',
      'Volumes page overhaul — Quick Start rewritten as pure hardware reference, corrected pool footprint calculations, health check split from compute checks',
      'Reports — conditional AVD, AKS, and MABS report tabs; compute health checks moved to Compute Report',
      'Zustand store migrated v8→v9 with full backward-compatible data migration',
    ],
  },
  {
    version: '1.7.0',
    label: 'Architecture Documentation',
    items: [
      'Architecture docs: overview.md — app layer diagram, page-to-engine map, state structure, export layer table, OEM preset overview',
      'Architecture docs: engine-flow.md — end-to-end pipeline flowchart, capacity computation chain, workload aggregation flow, health-check evaluation diagram',
      'Formula map updated with deferred/implemented-with-enhancements statuses, AVD/SOFS/Compute parity test counts, and app-added modules table',
      'Plan manifest (SurveyorPlan JSON export) and Ranger integration contract documented in docs/reference/plan-manifest.md',
    ],
  },
  {
    version: '1.6.0',
    label: 'AKS Dependencies, Terminology Clarity',
    items: [
      'Arc-enabled service presets: requiresAks flag on all 5 catalog entries; amber dependency banner with one-click Enable AKS',
      'AKS disable-protection: confirmation dialog when disabling AKS while an AKS-dependent preset is active',
      'Navigation: subtitle labels under workload nav items (Virtual Machines, Azure Virtual Desktop, Kubernetes, Scale-Out File Server, Azure Backup Server)',
      'PDF export: full SOFS Solution Report section added (12-row parameter table)',
      'AVD: "Host Pools" renamed to Session Host Groups throughout UI and exports',
    ],
  },
  {
    version: '1.5.0',
    label: 'AVD Maturity',
    items: [
      'AVD multi-pool support — plan up to 10 independent host pools, each with its own user count, workload model, and profile storage location',
      'Per-pool breakdown table in AVD planner; aggregate totals always shown at top',
      'SOFS sync aggregates across SOFS-targeted pools only, reflecting combined profile demand',
      'AVD ↔ SOFS cross-page navigation links in both planners',
      'Markdown and XLSX exports include per-pool breakdown when multiple pools are configured',
      'Zustand store migrated to v8; legacy flat AVD state converted to pools[] array format',
    ],
  },
  {
    version: '1.4.0',
    label: 'Stability and UX Clarity',
    items: [
      'Landing page and home navigation for first-run orientation',
      'Absorbed the unreleased v1.2.0 research and documentation work into the shipped release track',
      'AVD guidance updated for concurrent users, total users, and RemoteApp planning',
      'Docs audit, MkDocs repairs, and Surveyor to S2DCartographer cross-links',
    ],
  },
  {
    version: '1.3.0',
    label: 'Workload Intelligence',
    items: [
      'AKS resiliency wiring fix and clearer AKS scope note',
      'Arc-enabled service presets for SQL MI, IoT Operations, AI Foundry Local, and Container Apps',
      'Custom workload builder with JSON import and export integration',
      'AVD page note clarifying single-pool scope and RemoteApp mention',
    ],
  },
  {
    version: '1.1.0',
    label: 'Planner Features',
    items: [
      'SOFS planner architecture guidance and dedicated SOFS report tab',
      'AVD to SOFS sync workflow and in-sync indicator',
      'Burst-headroom warning for low concurrency assumptions',
      'AVD wording updates clarifying concurrent users vs total users semantics',
    ],
  },
  {
    version: '1.0.1',
    label: 'Stability and UX Clarity',
    items: [
      'About page, changelog, version display, and ErrorBoundary',
      'State hydration fixes for stale persisted data',
      'Preset verification and resiliency wording cleanup',
      'Milestone structure updated to break out research and docs work',
    ],
  },
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

const ROADMAP = [
  {
    version: '2.5.0',
    status: 'Planned',
    items: [
      { type: 'enhancement', text: 'Hardware Sizing Calculator — reverse planner: given a target workload, find the minimum hardware configuration (#140)' },
      { type: 'testing', text: 'Custom Workloads JSON import — expanded test coverage across full schema and edge cases (#148)' },
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
    href: 'https://azurelocal.cloud/azurelocal-surveyor/#/docs',
    description: 'Feature overview, usage guide, and methodology',
  },
  {
    label: 'S2DCartographer',
    href: 'https://azurelocal.cloud/azurelocal-s2d-cartographer/',
    description: 'Post-deployment S2D inventory, diagrams, and reporting for running clusters',
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
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Related project </span>
            <a href="https://azurelocal.cloud/azurelocal-s2d-cartographer/" target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline">S2DCartographer</a>
            {' '}provides post-deployment inventory, health analysis, and reporting for running Azure Local clusters. Surveyor plans; S2DCartographer verifies.
          </div>
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
            &copy; 2026 Azure Local Cloud. Released under the{' '}
            <a href="https://github.com/AzureLocal/azurelocal-surveyor/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600 dark:hover:text-gray-300">MIT License</a>.
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Roadmap</h2>
        <div className="space-y-4">
          {ROADMAP.map((milestone) => (
            <div
              key={milestone.version}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400">v{milestone.version}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  milestone.status === 'In Progress'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>{milestone.status}</span>
              </div>
              <ul className="space-y-1.5">
                {milestone.items.map((item) => (
                  <li key={item.text} className="text-xs text-gray-500 flex gap-2">
                    <span className={`shrink-0 font-medium ${
                      item.type === 'bug' ? 'text-red-400' :
                      item.type === 'enhancement' ? 'text-blue-400' :
                      item.type === 'research' ? 'text-purple-400' :
                      'text-gray-400'
                    }`}>{
                      item.type === 'bug' ? 'fix' :
                      item.type === 'enhancement' ? 'feat' :
                      item.type === 'research' ? 'research' :
                      'test'
                    }</span>
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
