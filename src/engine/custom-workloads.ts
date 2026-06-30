import type { CustomWorkload } from './types'

// ─── JSON import ──────────────────────────────────────────────────────────────

export interface ParseCustomWorkloadsResult {
  workloads: CustomWorkload[]
  imported: number
  error: string | null
}

/**
 * Parse, validate, and normalise a JSON string into CustomWorkload objects.
 *
 * Accepts either a single workload object or an array. The `resiliency` field
 * is silently stripped when present (resiliency is now per-volume, not per
 * workload). All optional numeric/boolean fields fall back to safe defaults
 * when absent or out-of-range so the caller never receives a partially-valid
 * object.
 *
 * Returns `{ workloads, imported, error }`. When `error` is non-null, the
 * workloads array will be empty and the caller should display the message.
 */
export function parseCustomWorkloadsJson(text: string): ParseCustomWorkloadsResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { workloads: [], imported: 0, error: 'Invalid JSON — check the format and try again.' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { workloads: [], imported: 0, error: 'JSON must be an object or array of workload objects.' }
  }

  // Support both single object and array
  const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed]
  const workloads: CustomWorkload[] = []

  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue
    const obj = item as Record<string, unknown>

    // Required: name must be a non-empty string
    if (typeof obj.name !== 'string' || !obj.name.trim()) {
      return { workloads: [], imported: 0, error: 'One or more workloads is missing a "name" field.' }
    }

    const wl: CustomWorkload = {
      id: `cw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name:                 obj.name,
      description:          typeof obj.description === 'string'                                    ? obj.description          : '',
      enabled:              typeof obj.enabled === 'boolean'                                       ? obj.enabled              : true,
      vmCount:              typeof obj.vmCount === 'number'              && obj.vmCount >= 1       ? obj.vmCount              : 1,
      vCpusPerVm:           typeof obj.vCpusPerVm === 'number'          && obj.vCpusPerVm >= 1    ? obj.vCpusPerVm           : 4,
      memoryPerVmGB:        typeof obj.memoryPerVmGB === 'number'        && obj.memoryPerVmGB >= 1 ? obj.memoryPerVmGB        : 16,
      osDiskPerVmGB:        typeof obj.osDiskPerVmGB === 'number'        && obj.osDiskPerVmGB >= 0 ? obj.osDiskPerVmGB        : 200,
      storageTB:            typeof obj.storageTB === 'number'            && obj.storageTB >= 0     ? obj.storageTB            : 0,
      internalMirrorFactor: typeof obj.internalMirrorFactor === 'number' && obj.internalMirrorFactor >= 1 ? obj.internalMirrorFactor : 1,
      bandwidthMbps:        typeof obj.bandwidthMbps === 'number'        && obj.bandwidthMbps >= 0 ? obj.bandwidthMbps        : 0,
      // resiliency silently stripped if present in imported JSON
    }
    workloads.push(wl)
  }

  if (workloads.length === 0) {
    return { workloads: [], imported: 0, error: 'No valid workload objects found in JSON.' }
  }

  return { workloads, imported: workloads.length, error: null }
}

// ─── Compute ──────────────────────────────────────────────────────────────────

function computeTotals(workload: CustomWorkload) {
  const totalVCpus = workload.vmCount * workload.vCpusPerVm
  const totalMemGB = workload.vmCount * workload.memoryPerVmGB
  const osDiskTB = (workload.vmCount * workload.osDiskPerVmGB) / 1024
  // Apply internal mirror factor: data storage footprint = logical × mirror
  const storageTB = workload.storageTB * (workload.internalMirrorFactor ?? 1)
  const totalStorageTB = osDiskTB + storageTB

  return { totalVCpus, totalMemGB, osDiskTB, storageTB, totalStorageTB }
}

export function computeAllCustomWorkloads(workloads: CustomWorkload[]) {
  let totalVCpus = 0
  let totalMemoryGB = 0
  let totalStorageTB = 0

  for (const workload of workloads) {
    if (!workload.enabled) continue

    const totals = computeTotals(workload)
    totalVCpus += totals.totalVCpus
    totalMemoryGB += totals.totalMemGB
    totalStorageTB += totals.totalStorageTB
  }

  return {
    totalVCpus,
    totalMemoryGB,
    totalStorageTB: Math.round(totalStorageTB * 100) / 100,
  }
}