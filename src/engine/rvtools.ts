/**
 * RVTools import (AB#414).
 *
 * Parses an RVTools export — the `vInfo` tab of an .xlsx workbook, or a single
 * vInfo sheet saved as .csv — into Surveyor {@link CustomWorkload} entries so an
 * existing VMware estate can seed an Azure Local sizing.
 *
 * Mapping strategy: one CustomWorkload per distinct (vCPU, memory) signature.
 * Identical VMs (e.g. a fleet of session hosts) collapse into a single row with
 * `vmCount = count`, which keeps each group's compute totals exact while staying
 * legible. Per-VM provisioned storage is summed into the group's `storageTB`
 * (the field is a logical total, not per-VM) with `osDiskPerVmGB = 0` so storage
 * is never double-counted. `internalMirrorFactor` is 1: the provisioned figure is
 * the single guest-visible allocation, not a host-side copy.
 *
 * Units: RVTools reports memory and disk in MiB (columns labelled "MB" are also
 * MiB — a long-standing RVTools quirk). Memory is converted MiB → GiB (÷1024) and
 * reported as GB; storage is converted MiB → TiB (÷1024²) and reported as TB,
 * matching the binary convention the rest of the app uses for `storageTB`.
 *
 * Storage source: the "Provisioned" column is preferred (what you must size for);
 * "In Use" is the fallback when provisioned is absent. Template VMs are skipped;
 * powered-off VMs are kept (they still occupy capacity) but counted separately.
 */

import * as XLSX from 'xlsx'
import type { CustomWorkload } from './types'

const MIB_PER_GIB = 1024
const MIB_PER_TIB = 1024 * 1024

export type RvToolsStorageSource = 'provisioned' | 'in-use' | 'none'

export interface ParseRvToolsResult {
  /** CustomWorkload groups (one per distinct vCPU/memory signature). */
  workloads: CustomWorkload[]
  /** Number of workload groups created. */
  imported: number
  /** Total VMs folded into the import (after filtering templates). */
  vmCount: number
  /** Powered-off VMs included in the count. */
  poweredOff: number
  /** Template VMs skipped. */
  skippedTemplates: number
  /** Which RVTools column the storage figures came from. */
  storageSource: RvToolsStorageSource
  /** Aggregate vCPU across all imported VMs. */
  totalVCpus: number
  /** Aggregate memory (GB) across all imported VMs. */
  totalMemoryGB: number
  /** Aggregate storage (TB) across all imported VMs. */
  totalStorageTB: number
  /** Non-null when nothing was imported; the caller should display it. */
  error: string | null
}

function emptyResult(error: string | null): ParseRvToolsResult {
  return {
    workloads: [], imported: 0, vmCount: 0, poweredOff: 0, skippedTemplates: 0,
    storageSource: 'none', totalVCpus: 0, totalMemoryGB: 0, totalStorageTB: 0, error,
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Coerce a cell value to a number, tolerating thousands separators in CSV strings. */
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, '').trim())
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function isTruthyFlag(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  return typeof v === 'string' && v.trim().toLowerCase() === 'true'
}

/** Find the first key matching any predicate, tried in order. */
function pickKey(keys: string[], ...predicates: ((lc: string) => boolean)[]): string | undefined {
  for (const pred of predicates) {
    const hit = keys.find((k) => pred(k.trim().toLowerCase()))
    if (hit) return hit
  }
  return undefined
}

const normalizeSheetName = (n: string): string => n.toLowerCase().replace(/[^a-z0-9]/g, '')

interface SpecGroup {
  vCpus: number
  memGB: number
  vmCount: number
  poweredOff: number
  storageTB: number
}

/**
 * Parse an RVTools export into CustomWorkload entries.
 *
 * @param data Raw file bytes (ArrayBuffer/Uint8Array) from a .xlsx or .csv file.
 */
export function parseRvToolsWorkbook(data: ArrayBuffer | Uint8Array): ParseRvToolsResult {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(data, { type: 'array' })
  } catch {
    return emptyResult('Could not read the file. Export RVTools as .xlsx, or save the vInfo tab as .csv, and try again.')
  }

  if (!wb.SheetNames.length) {
    return emptyResult('The workbook contains no sheets.')
  }

  // Prefer a sheet named "vInfo"; fall back to the only sheet (a CSV export of vInfo).
  const sheetName =
    wb.SheetNames.find((n) => normalizeSheetName(n) === 'vinfo') ??
    (wb.SheetNames.length === 1 ? wb.SheetNames[0] : undefined)

  if (!sheetName) {
    return emptyResult('No "vInfo" sheet found. Export the vInfo tab from RVTools (or save it as CSV) and import that.')
  }

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
  if (!rows.length) {
    return emptyResult(`The "${sheetName}" sheet has no VM rows.`)
  }

  // Resolve column keys from the union of all row keys (rows may omit blank cells).
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const cpuKey = pickKey(keys, (k) => k === 'cpus', (k) => k === 'cpu')
  const memKey = pickKey(keys, (k) => k === 'memory')
  const templateKey = pickKey(keys, (k) => k === 'template')
  const powerKey = pickKey(keys, (k) => k === 'powerstate')
  const provKey = pickKey(keys, (k) => k.includes('provisioned') && !k.includes('reservation'))
  const inUseKey = pickKey(keys, (k) => k.includes('in use'))

  if (!cpuKey || !memKey) {
    return emptyResult('This does not look like an RVTools vInfo export — the CPU and Memory columns are missing.')
  }

  const storageKey = provKey ?? inUseKey
  const storageSource: RvToolsStorageSource = provKey ? 'provisioned' : inUseKey ? 'in-use' : 'none'

  const groups = new Map<string, SpecGroup>()
  let vmCount = 0
  let poweredOff = 0
  let skippedTemplates = 0

  for (const row of rows) {
    if (templateKey && isTruthyFlag(row[templateKey])) {
      skippedTemplates++
      continue
    }

    const vCpus = Math.round(num(row[cpuKey]))
    const memGB = Math.round(num(row[memKey]) / MIB_PER_GIB)
    const storageTB = storageKey ? num(row[storageKey]) / MIB_PER_TIB : 0

    // Skip rows that carry no signal at all (blank/footer rows in some exports).
    if (vCpus === 0 && memGB === 0 && storageTB === 0) continue

    const isOff = !!powerKey && String(row[powerKey] ?? '').toLowerCase().includes('off')

    const key = `${vCpus}|${memGB}`
    const group = groups.get(key) ?? { vCpus, memGB, vmCount: 0, poweredOff: 0, storageTB: 0 }
    group.vmCount++
    if (isOff) group.poweredOff++
    group.storageTB += storageTB
    groups.set(key, group)

    vmCount++
    if (isOff) poweredOff++
  }

  if (vmCount === 0) {
    return emptyResult(`No VM rows could be read from the "${sheetName}" sheet.`)
  }

  // Largest fleets first, then biggest VMs — a sensible reading order.
  const sorted = Array.from(groups.values()).sort(
    (a, b) => b.vmCount - a.vmCount || b.vCpus - a.vCpus || b.memGB - a.memGB,
  )

  const workloads: CustomWorkload[] = sorted.map((g, i) => ({
    id: `cw-rvtools-${Date.now()}-${i}`,
    name: `RVTools: ${g.vCpus} vCPU / ${g.memGB} GB`,
    description: `${g.vmCount} VM${g.vmCount !== 1 ? 's' : ''} imported from RVTools (vInfo)`,
    enabled: true,
    vmCount: g.vmCount,
    vCpusPerVm: g.vCpus,
    memoryPerVmGB: g.memGB,
    osDiskPerVmGB: 0,
    storageTB: round2(g.storageTB),
    internalMirrorFactor: 1,
    bandwidthMbps: 0,
  }))

  const totalVCpus = workloads.reduce((s, w) => s + w.vmCount * w.vCpusPerVm, 0)
  const totalMemoryGB = workloads.reduce((s, w) => s + w.vmCount * w.memoryPerVmGB, 0)
  const totalStorageTB = round2(workloads.reduce((s, w) => s + w.storageTB, 0))

  return {
    workloads,
    imported: workloads.length,
    vmCount,
    poweredOff,
    skippedTemplates,
    storageSource,
    totalVCpus,
    totalMemoryGB,
    totalStorageTB,
    error: null,
  }
}
