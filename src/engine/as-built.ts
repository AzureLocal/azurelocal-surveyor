import { z } from 'zod'
import { load as loadYaml } from 'js-yaml'
import type { HardwareInputs } from './types'
import { assessHardwareFit, type FitInputs } from './fit'

/**
 * As-built hardware record: what was actually racked, compared with what the plan sized.
 *
 * Accepted shapes (all parsed locally, nothing is uploaded):
 *   0. the Azure Local Toolkit's infrastructure.yml (schema 5): the one file of the whole chain, and the source of the as-built record
 *      (owner decision O8). nodes[] gives the machine count, hardware.cpu_cores and memory_gib the machine, hardware.drives the drives
 *      and scenario.topology a rack aware build. YAML, or the same document as JSON.
 *   1. { "kind": "azurelocal-surveyor-asbuilt", "schemaVersion": 1, "hardware": { ... } }
 *   2. a saved Surveyor project or plan manifest (the inputs.hardware block is used)
 *   3. a bare hardware object { "nodeCount": 4, ... }
 * See docs/guide/as-built-fit.md.
 */

const media = z.enum(['nvme', 'ssd', 'hdd'])
const cacheMedia = z.enum(['nvme', 'ssd', 'none'])

export const asBuiltHardwareSchema = z.object({
  nodeCount: z.number().int().min(1).max(16),
  coresPerNode: z.number().positive(),
  memoryPerNodeGB: z.number().positive(),
  capacityDrivesPerNode: z.number().int().min(1),
  capacityDriveSizeTB: z.number().positive(),
  capacityMediaType: media,
  cacheDrivesPerNode: z.number().int().min(0).default(0),
  cacheDriveSizeTB: z.number().min(0).default(0),
  cacheMediaType: cacheMedia.default('none'),
  hyperthreadingEnabled: z.boolean().default(true),
  rackAware: z.boolean().optional(),
}).strict()

export interface AsBuiltRecord {
  source: string
  capturedAt?: string
  hardware: HardwareInputs
}

export type AsBuiltParse = { ok: true; record: AsBuiltRecord } | { ok: false; error: string }

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Keep only the hardware keys Surveyor knows, so a project or a Ranger-style manifest can be pasted whole. */
const HARDWARE_KEYS = ['nodeCount', 'coresPerNode', 'memoryPerNodeGB', 'capacityDrivesPerNode', 'capacityDriveSizeTB', 'capacityMediaType', 'cacheDrivesPerNode', 'cacheDriveSizeTB', 'cacheMediaType', 'hyperthreadingEnabled', 'rackAware']

const isInfrastructure = (v: Record<string, unknown>): boolean => isRecord(v._metadata) && (Array.isArray(v.nodes) || isRecord(v.hardware))

/** The hardware block of an infrastructure.yml (schema 5) in the keys of the as-built record. */
function hardwareFromInfrastructure(doc: Record<string, unknown>): { ok: true; hardware: Record<string, unknown> } | { ok: false; error: string } {
  const nodes = Array.isArray(doc.nodes) ? doc.nodes : []
  const hw = isRecord(doc.hardware) ? doc.hardware : {}
  const drives = isRecord(hw.drives) ? hw.drives : {}
  const capacity = isRecord(drives.capacity) ? drives.capacity : undefined
  const cache = isRecord(drives.cache) ? drives.cache : undefined
  if (nodes.length === 0) return { ok: false, error: 'This infrastructure.yml has no nodes: the as-built record needs the machines that were built.' }
  if (!capacity) return { ok: false, error: 'This infrastructure.yml has no hardware.drives.capacity (media, count, size_tb): write it with the hardware discovery or by hand.' }
  const scenario = isRecord(doc.scenario) ? doc.scenario : {}
  return {
    ok: true,
    hardware: {
      nodeCount: nodes.length,
      coresPerNode: hw.cpu_cores,
      memoryPerNodeGB: hw.memory_gib, // GiB in the file; Surveyor's memory per machine is GiB too, so the value is the same
      capacityDrivesPerNode: capacity.count,
      capacityDriveSizeTB: capacity.size_tb,
      capacityMediaType: capacity.media,
      cacheDrivesPerNode: cache ? cache.count : 0,
      cacheDriveSizeTB: cache ? cache.size_tb : 0,
      cacheMediaType: cache ? cache.media : 'none',
      ...(scenario.topology === 'rack_aware' ? { rackAware: true } : {}),
    },
  }
}

export function parseAsBuilt(text: string): AsBuiltParse {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // Not JSON: an infrastructure.yml is YAML (flow style included). Text that starts like JSON and is not YAML either keeps the JSON message.
    try { parsed = loadYaml(text) } catch { return { ok: false, error: /^\s*[{[]/.test(text) ? 'This is not valid JSON.' : 'This is neither valid JSON nor valid YAML.' } }
  }
  if (!isRecord(parsed)) return { ok: false, error: 'Expected a JSON object.' }
  let source = 'as-built record'
  let hardware: unknown
  if (isInfrastructure(parsed)) {
    const fromFile = hardwareFromInfrastructure(parsed)
    if (!fromFile.ok) return { ok: false, error: fromFile.error }
    source = 'infrastructure.yml'
    hardware = fromFile.hardware
  } else if (parsed.kind === 'azurelocal-surveyor-asbuilt') {
    if (parsed.schemaVersion !== 1) return { ok: false, error: 'Unsupported as-built schemaVersion. This Surveyor reads schemaVersion 1.' }
    hardware = parsed.hardware
  } else if (isRecord(parsed.inputs) && isRecord(parsed.inputs.hardware)) {
    source = parsed.kind === 'azurelocal-surveyor-project' ? 'Surveyor project' : 'plan manifest'
    hardware = parsed.inputs.hardware
  } else {
    hardware = isRecord(parsed.hardware) ? parsed.hardware : parsed
  }
  if (!isRecord(hardware)) return { ok: false, error: 'No hardware block found.' }
  const picked = Object.fromEntries(Object.entries(hardware).filter(([k]) => HARDWARE_KEYS.includes(k)))
  const result = asBuiltHardwareSchema.safeParse(picked)
  if (!result.success) {
    const issue = result.error.issues[0]
    return { ok: false, error: `Invalid hardware at "${issue.path.join('.') || 'hardware'}": ${issue.message}.` }
  }
  const capturedAt = typeof parsed.capturedAt === 'string' ? parsed.capturedAt : undefined
  if (typeof parsed.source === 'string' && parsed.kind === 'azurelocal-surveyor-asbuilt') source = parsed.source.slice(0, 80)
  const { rackAware, ...rest } = result.data
  return { ok: true, record: { source, ...(capturedAt ? { capturedAt } : {}), hardware: { ...rest, ...(rackAware ? { rackAware: true } : {}) } } }
}

export interface BuiltComparison {
  planned: ReturnType<typeof assessHardwareFit>['current']
  built: ReturnType<typeof assessHardwareFit>['current']
  builtWithN1: ReturnType<typeof assessHardwareFit>['current']
  /** Remaining capacity on the built hardware after the sized demand, as a fraction of the built capacity. */
  headroom: { cpu: number; memory: number; pool: number }
  /** Built capacity with one node down (N+1) against the sized demand. */
  n1Fits: boolean | null
  hasDemand: boolean
  verdict: 'no-demand' | 'fits-with-n1' | 'fits-no-n1' | 'does-not-fit'
  notes: string[]
}

/** Compare the demand sized in the plan with the capacity that was built, reusing the fit engine. */
export function compareBuiltToDemand(state: FitInputs, built: HardwareInputs): BuiltComparison {
  const planned = assessHardwareFit(state)
  const asBuilt = assessHardwareFit({ ...state, hardware: built })
  const withN1 = assessHardwareFit({ ...state, hardware: built, advanced: { ...state.advanced, maintenanceReserveMode: 'n+1' } })
  const demand = asBuilt.demand
  const frac = (capacity: number, used: number) => (capacity > 0 ? (capacity - used) / capacity : 0)
  const reserveFree = asBuilt.current
  const verdict: BuiltComparison['verdict'] = !asBuilt.hasDemand ? 'no-demand'
    : !reserveFree.fits ? 'does-not-fit'
    : withN1.current.fits ? 'fits-with-n1' : 'fits-no-n1'
  const notes: string[] = []
  if (built.nodeCount === 1 && !built.rackAware) notes.push('Single node: N+1 cannot be met; a host restart interrupts all workloads.')
  if (built.nodeCount !== state.hardware.nodeCount) notes.push(`Built ${built.nodeCount} nodes; the plan sized ${state.hardware.nodeCount}.`)
  if (asBuilt.current.errors.length) notes.push(...asBuilt.current.errors)
  return {
    planned: planned.current, built: asBuilt.current, builtWithN1: withN1.current,
    headroom: {
      cpu: frac(reserveFree.cpu, demand.totalVCpus),
      memory: frac(reserveFree.memory, demand.totalMemoryGB),
      pool: frac(reserveFree.poolTB, reserveFree.requiredFootprintTB),
    },
    n1Fits: asBuilt.hasDemand ? withN1.current.fits : null,
    hasDemand: asBuilt.hasDemand,
    verdict, notes,
  }
}
