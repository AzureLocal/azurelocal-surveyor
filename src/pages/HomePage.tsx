import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Cpu,
  HardDrive,
  Info,
  Layers,
  LineChart,
  Monitor,
  Server,
  ShieldCheck,
} from 'lucide-react'

const MENU_GUIDE = [
  {
    title: 'Hardware',
    description: 'Start here. Define nodes, drives, CPU, memory, and the base cluster shape that every other calculation depends on.',
    icon: Server,
  },
  {
    title: 'Workloads',
    description: 'Enable the scenarios you plan to run so Surveyor can estimate compute and storage demand.',
    icon: Cpu,
  },
  {
    title: 'AVD / SOFS / AKS / MABS',
    description: 'These detailed planners appear when the related workload is enabled. Use them for deeper sizing and assumptions.',
    icon: Monitor,
  },
  {
    title: 'Volumes and Drive Layout',
    description: 'Translate your capacity plan into CSV volume design and compare hardware layouts before deployment.',
    icon: HardDrive,
  },
  {
    title: 'Reports',
    description: 'Review the roll-up plan, health checks, and export the results to PDF, XLSX, Markdown, JSON, or PowerShell.',
    icon: LineChart,
  },
  {
    title: 'Docs / References / About',
    description: 'Use these pages for guidance, source references, release notes, and project context.',
    icon: BookOpen,
  },
]

const GETTING_STARTED = [
  'Open Hardware and define your cluster baseline.',
  'Enable the workloads you care about and fill in the detailed planners that appear.',
  'Review Volumes and Reports before you export or share the plan.',
]

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
        <div className="bg-gradient-to-r from-brand-600 via-sky-700 to-cyan-700 px-6 py-8 text-white">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              <ShieldCheck className="w-3.5 h-3.5" />
              Azure Local Surveyor
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Plan before you rack the hardware.</h1>
              <p className="text-sm text-blue-100 mt-2 max-w-2xl leading-relaxed">
                Azure Local Surveyor is a browser-based planning tool for Azure Local clusters. It helps you estimate storage,
                compute, workload demand, and volume layout before deployment so you can spot problems early and export a clean plan.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                to="/hardware"
                className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-blue-50 transition-colors"
              >
                Start with Hardware
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/docs"
                className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
              >
                Read the Docs
                <BookOpen className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-px bg-gray-200 dark:bg-gray-700">
          <Callout
            title="What this site does"
            body="Turns cluster inputs and workload assumptions into capacity, compute, volume, and health outputs you can review before deployment."
            icon={Layers}
          />
          <Callout
            title="What it does not do"
            body="It does not deploy infrastructure for you. It is a planning and validation tool, not an orchestration engine."
            icon={Info}
          />
          <Callout
            title="Best first step"
            body="Go to Hardware first unless you are just browsing. Every downstream page depends on the hardware baseline."
            icon={Server}
          />
        </div>
      </section>

      <section className="grid lg:grid-cols-[1.2fr,0.8fr] gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-xl font-semibold mb-4">Left Menu Guide</h2>
          <div className="space-y-4">
            {MENU_GUIDE.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md bg-brand-50 dark:bg-brand-900/20 p-2 text-brand-700 dark:text-brand-300">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-0.5">{item.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
            <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
            <ol className="space-y-3">
              {GETTING_STARTED.map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
            <h2 className="text-xl font-semibold mb-3">Need More Detail?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Use the Docs page for workflow guidance and the References page for Microsoft Learn sources. If you already know your hardware,
              jump straight to the Hardware page and start building the plan.
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <Link
                to="/docs"
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Open Docs
              </Link>
              <Link
                to="/hardware"
                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Go to Hardware
              </Link>
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}

function Callout({
  title,
  body,
  icon: Icon,
}: {
  title: string
  body: string
  icon: React.ElementType
}) {
  return (
    <div className="bg-white dark:bg-gray-900 px-5 py-4">
      <div className="flex items-center gap-2 text-sm font-semibold mb-2">
        <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
        {title}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{body}</p>
    </div>
  )
}