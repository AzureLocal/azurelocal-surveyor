/**
 * Sizing handoff: the part of a Surveyor plan that a design tool needs, in one small file.
 *
 * Azure Local Trailwright imports it (Review and export, Import) to start a design from the sized cluster: the
 * number of machines, rack aware or not, cores and memory per machine, the drives per machine and the volumes. The key
 * names under hardware and storage are the Azure Local Toolkit's infrastructure.yml (schema 5) names, so a consumer can
 * copy them: hardware.cpu_cores, hardware.memory_gib, hardware.drives.{capacity,cache}.{media,count,size_tb} and
 * storage.volumes[].{name,size_gib,resiliency}. The sizing block carries the frozen results the plan was judged on.
 *
 * Contract: kind "azurelocal-sizing-handoff", schemaVersion "MAJOR.MINOR" (consumers check the major only; a new
 * optional field is a minor bump). Documented in docs/reference/sizing-handoff.md with a JSON schema next to it.
 */

import { version } from '../../package.json'
import { computeCapacity } from '../engine/capacity'
import { computeCompute } from '../engine/compute'
import { RELEASE_LABEL } from '../engine/facts'
import { runHealthCheck } from '../engine/healthcheck'
import { computePlanning } from '../engine/planning'
import type { ResiliencyType } from '../engine/types'
import { computeVolumeSummary } from '../engine/volumes'
import type { SurveyorState } from '../state/store'

export const SIZING_HANDOFF_KIND = 'azurelocal-sizing-handoff'
export const SIZING_HANDOFF_VERSION = '1.0'

/** infrastructure.yml storage.volumes[].resiliency for each Surveyor resiliency. */
export const SCHEMA5_RESILIENCY: Record<ResiliencyType, 'two_way' | 'three_way' | 'four_way' | 'parity' | 'nested_two_way'> = {
  'two-way-mirror': 'two_way',
  'three-way-mirror': 'three_way',
  'four-way-mirror': 'four_way',
  'dual-parity': 'parity',
  'nested-two-way': 'nested_two_way',
}

export interface DriveTier {
  media: 'nvme' | 'ssd' | 'hdd'
  count: number
  size_tb: number
}

export interface SizingHandoff {
  kind: typeof SIZING_HANDOFF_KIND
  schemaVersion: typeof SIZING_HANDOFF_VERSION
  generatedBy: 'azurelocal-surveyor'
  surveyorVersion: string
  /** The Azure Local release the plan was checked against, for example "Azure Local 12.2611". */
  targetRelease: string
  generatedAt: string
  plan: { name: string; purpose: 'buy' | 'existing' }
  cluster: {
    node_count: number
    /** rack_aware: two local zones with node_count / 2 machines each. */
    topology: 'standard' | 'rack_aware'
  }
  /** Per machine, as infrastructure.yml hardware.* writes it. */
  hardware: {
    cpu_cores: number
    memory_gib: number
    hyperthreading: boolean
    drives: { capacity: DriveTier; cache?: DriveTier }
  }
  storage: {
    /** The resiliency the capacity was computed with (after Surveyor's clamping), in the schema 5 spelling. */
    default_resiliency: string
    infrastructure_volume_tb: number
    /** size_gib: the planned size (decimal TB) in GiB, rounded down: the size to give New-Volume. */
    volumes: { name: string; size_gib: number; resiliency: string; provisioning: 'fixed' | 'thin' }[]
  }
  /** The results the plan was judged on, frozen at export time. Sizes in decimal TB. */
  sizing: {
    raw_pool_tb: number
    effective_usable_tb: number
    volumes_pool_footprint_tb: number
    utilization_pct: number
    usable_vcpus: number
    usable_memory_gb: number
    usable_vcpus_n_minus_1: number
    usable_memory_gb_n_minus_1: number
    workload_vcpus: number
    workload_memory_gb: number
    workload_storage_tb: number
    health: { passed: boolean; errors: number; warnings: number; issues: { code: string; severity: string; message: string }[] }
  }
}

type HandoffState = Pick<
  SurveyorState,
  | 'planName' | 'planningPurpose'
  | 'hardware' | 'advanced' | 'volumes' | 'volumeMode'
  | 'avd' | 'avdEnabled' | 'sofs' | 'sofsEnabled' | 'mabs' | 'mabsEnabled'
  | 'aks' | 'virtualMachines' | 'servicePresets' | 'customWorkloads' | 'inventory' | 'inventorySettings' | 'inventorySources'
>

const round = (n: number, digits = 2): number => Math.round(n * 10 ** digits) / 10 ** digits

/** plannedSizeTB is decimal TB (10^12 bytes); a volume size for New-Volume is in GiB (2^30 bytes). Rounded down, so it never asks for more. */
export const tbToGib = (tb: number): number => Math.max(0, Math.floor((tb * 1e12) / 2 ** 30))

/** What would make the file break its contract (docs/reference/sizing-handoff.schema.json). Empty when the handoff can be written. */
export function sizingHandoffProblems(h: SizingHandoff): string[] {
  const out: string[] = []
  const whole = (v: number, min: number) => Number.isInteger(v) && v >= min
  if (!whole(h.cluster.node_count, 1) || h.cluster.node_count > 16) out.push(`The number of machines must be a whole number from 1 to 16 (it is ${h.cluster.node_count}).`)
  if (!whole(h.hardware.cpu_cores, 1)) out.push(`Cores per machine must be a whole number of at least 1 (it is ${h.hardware.cpu_cores}).`)
  if (!whole(h.hardware.memory_gib, 1)) out.push(`Memory per machine must be a whole number of GB of at least 1 (it is ${h.hardware.memory_gib}).`)
  for (const [tier, t] of Object.entries(h.hardware.drives)) if (t && !whole(t.count, 0)) out.push(`The ${tier} drive count must be a whole number (it is ${t.count}).`)
  return out
}

export function createSizingHandoff(state: HandoffState, now: Date = new Date()): SizingHandoff {
  const hw = state.hardware
  const capacity = computeCapacity(hw, state.advanced)
  const volumeSummary = computeVolumeSummary(state.volumes, capacity)
  const compute = computeCompute(hw, state.advanced)
  const workloadTotals = computePlanning(state).workloadTotals
  const health = runHealthCheck({ hardware: hw, settings: state.advanced, volumes: state.volumes, capacity, compute, workloadSummary: workloadTotals })
  const hasCache = hw.cacheMediaType !== 'none' && hw.cacheDrivesPerNode > 0

  return {
    kind: SIZING_HANDOFF_KIND,
    schemaVersion: SIZING_HANDOFF_VERSION,
    generatedBy: 'azurelocal-surveyor',
    surveyorVersion: version,
    targetRelease: RELEASE_LABEL,
    generatedAt: now.toISOString(),
    plan: { name: state.planName, purpose: state.planningPurpose },
    cluster: { node_count: hw.nodeCount, topology: hw.rackAware ? 'rack_aware' : 'standard' },
    hardware: {
      cpu_cores: hw.coresPerNode,
      memory_gib: hw.memoryPerNodeGB,
      hyperthreading: hw.hyperthreadingEnabled,
      drives: {
        capacity: { media: hw.capacityMediaType, count: hw.capacityDrivesPerNode, size_tb: hw.capacityDriveSizeTB },
        ...(hasCache ? { cache: { media: hw.cacheMediaType as 'nvme' | 'ssd', count: hw.cacheDrivesPerNode, size_tb: hw.cacheDriveSizeTB } } : {}),
      },
    },
    storage: {
      default_resiliency: SCHEMA5_RESILIENCY[capacity.resiliencyType],
      infrastructure_volume_tb: state.advanced.infraVolumeSizeTB,
      volumes: state.volumes.map((v) => ({
        name: v.name,
        size_gib: tbToGib(v.plannedSizeTB),
        resiliency: SCHEMA5_RESILIENCY[v.resiliency],
        provisioning: v.provisioning,
      })),
    },
    sizing: {
      raw_pool_tb: round(capacity.rawPoolTB),
      effective_usable_tb: round(capacity.effectiveUsableTB),
      volumes_pool_footprint_tb: round(volumeSummary.totalPoolFootprintTB),
      utilization_pct: round(volumeSummary.utilizationPct, 1),
      usable_vcpus: compute.usableVCpus,
      usable_memory_gb: compute.usableMemoryGB,
      usable_vcpus_n_minus_1: compute.usableVCpusN1,
      usable_memory_gb_n_minus_1: compute.usableMemoryGBN1,
      workload_vcpus: workloadTotals.totalVCpus,
      workload_memory_gb: workloadTotals.totalMemoryGB,
      workload_storage_tb: round(workloadTotals.totalStorageTB),
      health: {
        passed: health.passed,
        errors: health.errorCount,
        warnings: health.warningCount,
        issues: health.issues.filter((i) => i.severity !== 'info').map((i) => ({ code: i.code, severity: i.severity, message: i.message })),
      },
    },
  }
}

export function sizingHandoffFilename(now: Date = new Date()): string {
  return `azure-local-sizing-handoff-${now.toISOString().slice(0, 10)}.json`
}

/** Downloads the handoff. Returns what stops it instead when the plan cannot be written within the contract. */
export function exportSizingHandoff(state: HandoffState): string[] {
  const now = new Date()
  const handoff = createSizingHandoff(state, now)
  const problems = sizingHandoffProblems(handoff)
  if (problems.length) return problems
  const blob = new Blob([JSON.stringify(handoff, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = sizingHandoffFilename(now)
  a.click()
  URL.revokeObjectURL(url)
  return []
}
