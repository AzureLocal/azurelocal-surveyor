import { z } from 'zod'
import type { HardwareInputs } from './types'
import { assessHardwareFit, type FitInputs } from './fit'

/**
 * As-built hardware record: what was actually racked, compared with what the plan sized.
 *
 * Accepted shapes (all parsed locally, nothing is uploaded):
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

export function parseAsBuilt(text: string): AsBuiltParse {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return { ok: false, error: 'This is not valid JSON.' } }
  if (!isRecord(parsed)) return { ok: false, error: 'Expected a JSON object.' }
  let source = 'as-built record'
  let hardware: unknown
  if (parsed.kind === 'azurelocal-surveyor-asbuilt') {
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
