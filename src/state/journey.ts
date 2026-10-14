/**
 * Navigation-only step registry. It describes the fixed order of pages in
 * each planning area; it never reads or changes plan data.
 */
export type JourneyArea = 'storage' | 'workload'

export interface JourneySubStep {
  route: string
  label: string
}

export interface JourneyStep {
  route: string
  label: string
  description: string
  /** Pages that belong to this step but have their own route (for example the AVD planner under Specialized Workloads). */
  subSteps?: JourneySubStep[]
}

export interface JourneyDefinition {
  area: JourneyArea
  label: string
  /** The area's home page: where the bar's overview link and the final "Back to start" card lead. */
  home: string
  homeLabel: string
  steps: JourneyStep[]
}

const step = (route: string, label: string, description: string, subSteps?: JourneySubStep[]): JourneyStep => ({ route, label, description, subSteps })

export const JOURNEYS: Record<JourneyArea, JourneyDefinition> = {
  workload: {
    area: 'workload',
    label: 'Workload Planning',
    home: '/planning',
    homeLabel: 'Planning paths',
    steps: [
      step('/planning/hardware', 'Hardware', 'Describe the nodes you own or a proposed configuration.'),
      step('/planning/workloads', 'Workloads', 'Import or enter the VMs and services the cluster must run.'),
      step('/planning/specialized', 'Specialized Workloads', 'Enable AVD, AKS, SOFS or MABS and open their planners.', [
        { route: '/planning/avd', label: 'AVD Planner' },
        { route: '/planning/aks', label: 'AKS Planner' },
        { route: '/planning/sofs', label: 'SOFS Planner' },
        { route: '/planning/mabs', label: 'MABS Planner' },
      ]),
      step('/planning/recommendations', 'Hardware Options', 'Compare OEM configurations that fit the demand.'),
      step('/planning/fit', 'Fit', 'Check capacity, headroom and resilience, then lay out the storage.', [
        { route: '/planning/volumes', label: 'Storage Design' },
        { route: '/planning/drive-layout', label: 'Compare Drive Layouts' },
      ]),
      step('/planning/reports', 'Reports', 'Review the plan and download the deliverables.'),
      step('/planning/projects', 'Projects', 'Save, open and compare workload projects.'),
    ],
  },
  storage: {
    area: 'storage',
    label: 'Storage Sizing',
    home: '/storage',
    homeLabel: 'Storage overview',
    steps: [
      step('/storage/hardware', 'Hardware & Drives', 'Choose nodes, an OEM example and the drive configuration.'),
      step('/storage/volumes', 'Volume Planning', 'Design volumes with per-volume resiliency and provisioning.'),
      step('/storage/drive-layout', 'Compare Drive Layouts', 'Compare alternative drive layouts side by side.'),
      step('/storage/capacity', 'Capacity & Resiliency', 'Review reserves, resiliency overhead and usable storage.'),
      step('/storage/reports', 'Storage Report', 'Review the storage plan and download the deliverables.'),
      step('/storage/projects', 'Projects', 'Save, open and compare storage projects.'),
    ],
  },
}

export interface JourneyPosition {
  area: JourneyArea
  label: string
  home: string
  homeLabel: string
  steps: JourneyStep[]
  /** 1-based number of the current step. */
  number: number
  total: number
  step: JourneyStep
  /** Set when the page is one of the step's sub-pages rather than the step itself. */
  subStep?: JourneySubStep
  previous?: JourneyStep
  next?: JourneyStep
}

/** The planning area a journey page belongs to, or null for home, help and about pages. */
export function journeyArea(pathname: string): JourneyArea | null {
  if (pathname.startsWith('/storage/')) return 'storage'
  if (pathname.startsWith('/planning/')) return 'workload'
  return null
}

/** Every route (step or sub-step) in an area, in journey order. */
export function journeyRoutes(area: JourneyArea): string[] {
  return JOURNEYS[area].steps.flatMap(s => [s.route, ...(s.subSteps ?? []).map(sub => sub.route)])
}

/** Where the current page sits in its area's journey, or null when the page is not a journey page. */
export function journeyPosition(pathname: string): JourneyPosition | null {
  const area = journeyArea(pathname)
  if (!area) return null
  const journey = JOURNEYS[area]
  const index = journey.steps.findIndex(s => s.route === pathname || s.subSteps?.some(sub => sub.route === pathname))
  if (index < 0) return null
  const current = journey.steps[index]
  const subStep = current.subSteps?.find(sub => sub.route === pathname)
  return {
    area,
    label: journey.label,
    home: journey.home,
    homeLabel: journey.homeLabel,
    steps: journey.steps,
    number: index + 1,
    total: journey.steps.length,
    step: current,
    subStep,
    // From a sub-page, "previous" returns to its parent step; from a step it is the step before.
    previous: subStep ? current : journey.steps[index - 1],
    next: journey.steps[index + 1],
  }
}
