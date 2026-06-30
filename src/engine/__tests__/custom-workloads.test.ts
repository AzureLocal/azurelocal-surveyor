/**
 * Custom Workloads — full import lifecycle tests (AB#154).
 *
 * Covers:
 *  - parseCustomWorkloadsJson: parse → validate → normalise
 *  - computeAllCustomWorkloads: round-trip totals
 *  - Template shape: JSON_TEMPLATE fields map to CustomWorkload
 */

import { describe, it, expect } from 'vitest'
import { parseCustomWorkloadsJson, computeAllCustomWorkloads } from '../custom-workloads'
import type { CustomWorkload } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    name: 'Test Workload',
    description: 'A test workload',
    enabled: true,
    vmCount: 3,
    vCpusPerVm: 8,
    memoryPerVmGB: 32,
    osDiskPerVmGB: 200,
    storageTB: 10,
    internalMirrorFactor: 2,
    bandwidthMbps: 1000,
    ...overrides,
  })
}

// ─── Parse: malformed JSON ────────────────────────────────────────────────────

describe('parseCustomWorkloadsJson — malformed JSON', () => {
  it('returns error for completely invalid JSON', () => {
    const result = parseCustomWorkloadsJson('not-json{{{')
    expect(result.error).toBe('Invalid JSON — check the format and try again.')
    expect(result.workloads).toHaveLength(0)
    expect(result.imported).toBe(0)
  })

  it('returns error for a bare string value', () => {
    const result = parseCustomWorkloadsJson('"just a string"')
    expect(result.error).toBe('JSON must be an object or array of workload objects.')
    expect(result.workloads).toHaveLength(0)
  })

  it('returns error for a number value', () => {
    const result = parseCustomWorkloadsJson('42')
    expect(result.error).toBe('JSON must be an object or array of workload objects.')
  })

  it('returns error for null', () => {
    const result = parseCustomWorkloadsJson('null')
    expect(result.error).toBe('JSON must be an object or array of workload objects.')
  })

  it('returns error for an empty array', () => {
    const result = parseCustomWorkloadsJson('[]')
    expect(result.error).toBe('No valid workload objects found in JSON.')
    expect(result.workloads).toHaveLength(0)
  })
})

// ─── Parse: missing or invalid required fields ────────────────────────────────

describe('parseCustomWorkloadsJson — missing required fields', () => {
  it('returns error when name field is absent', () => {
    const result = parseCustomWorkloadsJson(JSON.stringify({ vmCount: 2, vCpusPerVm: 4, memoryPerVmGB: 16 }))
    expect(result.error).toBe('One or more workloads is missing a "name" field.')
    expect(result.workloads).toHaveLength(0)
  })

  it('returns error when name is an empty string', () => {
    const result = parseCustomWorkloadsJson(validJson({ name: '' }))
    expect(result.error).toBe('One or more workloads is missing a "name" field.')
  })

  it('returns error when name is whitespace-only', () => {
    const result = parseCustomWorkloadsJson(validJson({ name: '   ' }))
    expect(result.error).toBe('One or more workloads is missing a "name" field.')
  })

  it('returns error when name is a number (wrong type)', () => {
    const result = parseCustomWorkloadsJson(validJson({ name: 42 }))
    expect(result.error).toBe('One or more workloads is missing a "name" field.')
  })

  it('returns error on first invalid item in array — all-or-nothing', () => {
    const json = JSON.stringify([
      { name: 'Valid', vmCount: 1, vCpusPerVm: 2, memoryPerVmGB: 8 },
      { vmCount: 3 },   // missing name
    ])
    const result = parseCustomWorkloadsJson(json)
    expect(result.error).toBe('One or more workloads is missing a "name" field.')
    expect(result.workloads).toHaveLength(0)
  })
})

// ─── Parse: valid single object ───────────────────────────────────────────────

describe('parseCustomWorkloadsJson — valid single object', () => {
  it('accepts a fully specified workload object', () => {
    const result = parseCustomWorkloadsJson(validJson())
    expect(result.error).toBeNull()
    expect(result.imported).toBe(1)
    expect(result.workloads).toHaveLength(1)
  })

  it('preserves all fields from valid input', () => {
    const result = parseCustomWorkloadsJson(validJson())
    const wl = result.workloads[0]
    expect(wl.name).toBe('Test Workload')
    expect(wl.description).toBe('A test workload')
    expect(wl.enabled).toBe(true)
    expect(wl.vmCount).toBe(3)
    expect(wl.vCpusPerVm).toBe(8)
    expect(wl.memoryPerVmGB).toBe(32)
    expect(wl.osDiskPerVmGB).toBe(200)
    expect(wl.storageTB).toBe(10)
    expect(wl.internalMirrorFactor).toBe(2)
    expect(wl.bandwidthMbps).toBe(1000)
  })

  it('assigns a generated id to each workload', () => {
    const result = parseCustomWorkloadsJson(validJson())
    expect(result.workloads[0].id).toMatch(/^cw-/)
  })

  it('accepts a workload with only name (minimum required fields)', () => {
    const result = parseCustomWorkloadsJson(JSON.stringify({ name: 'Minimal' }))
    expect(result.error).toBeNull()
    expect(result.workloads[0].name).toBe('Minimal')
  })
})

// ─── Parse: valid array ───────────────────────────────────────────────────────

describe('parseCustomWorkloadsJson — valid array', () => {
  it('accepts an array of valid workloads', () => {
    const json = JSON.stringify([
      { name: 'WL-1', vmCount: 2, vCpusPerVm: 4, memoryPerVmGB: 8 },
      { name: 'WL-2', vmCount: 5, vCpusPerVm: 2, memoryPerVmGB: 16 },
    ])
    const result = parseCustomWorkloadsJson(json)
    expect(result.error).toBeNull()
    expect(result.imported).toBe(2)
    expect(result.workloads).toHaveLength(2)
    expect(result.workloads[0].name).toBe('WL-1')
    expect(result.workloads[1].name).toBe('WL-2')
  })

  it('assigns unique ids to each workload in an array', () => {
    const json = JSON.stringify([{ name: 'A' }, { name: 'B' }, { name: 'C' }])
    const result = parseCustomWorkloadsJson(json)
    const ids = result.workloads.map((w) => w.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(3)
  })
})

// ─── Parse: normalisation — defaults for missing/out-of-range optional fields ─

describe('parseCustomWorkloadsJson — normalisation', () => {
  it('defaults description to empty string when absent', () => {
    const result = parseCustomWorkloadsJson(JSON.stringify({ name: 'X' }))
    expect(result.workloads[0].description).toBe('')
  })

  it('defaults enabled to true when absent', () => {
    const result = parseCustomWorkloadsJson(JSON.stringify({ name: 'X' }))
    expect(result.workloads[0].enabled).toBe(true)
  })

  it('preserves enabled: false when explicitly set', () => {
    const result = parseCustomWorkloadsJson(validJson({ enabled: false }))
    expect(result.workloads[0].enabled).toBe(false)
  })

  it('defaults vmCount to 1 when absent', () => {
    const result = parseCustomWorkloadsJson(JSON.stringify({ name: 'X' }))
    expect(result.workloads[0].vmCount).toBe(1)
  })

  it('defaults vmCount to 1 when value is 0 (out of range)', () => {
    const result = parseCustomWorkloadsJson(validJson({ vmCount: 0 }))
    expect(result.workloads[0].vmCount).toBe(1)
  })

  it('defaults vmCount to 1 when value is negative', () => {
    const result = parseCustomWorkloadsJson(validJson({ vmCount: -5 }))
    expect(result.workloads[0].vmCount).toBe(1)
  })

  it('defaults vmCount to 1 when value is a string', () => {
    const result = parseCustomWorkloadsJson(validJson({ vmCount: '3' }))
    expect(result.workloads[0].vmCount).toBe(1)
  })

  it('defaults vCpusPerVm to 4 when absent', () => {
    const result = parseCustomWorkloadsJson(JSON.stringify({ name: 'X' }))
    expect(result.workloads[0].vCpusPerVm).toBe(4)
  })

  it('defaults vCpusPerVm to 4 when out of range (< 1)', () => {
    const result = parseCustomWorkloadsJson(validJson({ vCpusPerVm: 0 }))
    expect(result.workloads[0].vCpusPerVm).toBe(4)
  })

  it('defaults memoryPerVmGB to 16 when absent', () => {
    const result = parseCustomWorkloadsJson(JSON.stringify({ name: 'X' }))
    expect(result.workloads[0].memoryPerVmGB).toBe(16)
  })

  it('defaults osDiskPerVmGB to 200 when absent', () => {
    const result = parseCustomWorkloadsJson(JSON.stringify({ name: 'X' }))
    expect(result.workloads[0].osDiskPerVmGB).toBe(200)
  })

  it('accepts osDiskPerVmGB = 0 (no OS disk)', () => {
    const result = parseCustomWorkloadsJson(validJson({ osDiskPerVmGB: 0 }))
    expect(result.workloads[0].osDiskPerVmGB).toBe(0)
  })

  it('defaults storageTB to 0 when absent', () => {
    const result = parseCustomWorkloadsJson(JSON.stringify({ name: 'X' }))
    expect(result.workloads[0].storageTB).toBe(0)
  })

  it('defaults internalMirrorFactor to 1 when absent', () => {
    const result = parseCustomWorkloadsJson(JSON.stringify({ name: 'X' }))
    expect(result.workloads[0].internalMirrorFactor).toBe(1)
  })

  it('defaults internalMirrorFactor to 1 when value < 1', () => {
    const result = parseCustomWorkloadsJson(validJson({ internalMirrorFactor: 0 }))
    expect(result.workloads[0].internalMirrorFactor).toBe(1)
  })

  it('defaults bandwidthMbps to 0 when absent', () => {
    const result = parseCustomWorkloadsJson(JSON.stringify({ name: 'X' }))
    expect(result.workloads[0].bandwidthMbps).toBe(0)
  })

  it('defaults bandwidthMbps to 0 when negative', () => {
    const result = parseCustomWorkloadsJson(validJson({ bandwidthMbps: -100 }))
    expect(result.workloads[0].bandwidthMbps).toBe(0)
  })
})

// ─── Parse: resiliency field stripping ───────────────────────────────────────

describe('parseCustomWorkloadsJson — resiliency stripping', () => {
  it('silently strips resiliency field from imported JSON', () => {
    const json = JSON.stringify({
      name: 'Workload with resiliency',
      resiliency: 'three-way-mirror',
      vmCount: 2,
      vCpusPerVm: 4,
      memoryPerVmGB: 16,
    })
    const result = parseCustomWorkloadsJson(json)
    expect(result.error).toBeNull()
    const wl = result.workloads[0] as unknown as Record<string, unknown>
    expect('resiliency' in wl).toBe(false)
  })
})

// ─── Parse: skips non-object array items ─────────────────────────────────────

describe('parseCustomWorkloadsJson — array item filtering', () => {
  it('skips null items in an array', () => {
    // A null in the array is skipped; remaining valid items still import
    const json = JSON.stringify([null, { name: 'Valid' }])
    const result = parseCustomWorkloadsJson(json)
    expect(result.error).toBeNull()
    expect(result.imported).toBe(1)
    expect(result.workloads[0].name).toBe('Valid')
  })

  it('skips primitive items in an array', () => {
    const json = JSON.stringify([42, 'string', { name: 'Valid' }])
    const result = parseCustomWorkloadsJson(json)
    expect(result.error).toBeNull()
    expect(result.imported).toBe(1)
  })
})

// ─── Round-trip: import then compute totals ───────────────────────────────────

describe('round-trip: parseCustomWorkloadsJson → computeAllCustomWorkloads', () => {
  it('computes zero totals for an empty list', () => {
    const totals = computeAllCustomWorkloads([])
    expect(totals.totalVCpus).toBe(0)
    expect(totals.totalMemoryGB).toBe(0)
    expect(totals.totalStorageTB).toBe(0)
  })

  it('computes correct totals for a single parsed workload', () => {
    // vmCount=3, vCpusPerVm=8, memoryPerVmGB=32, osDiskPerVmGB=0, storageTB=10, internalMirrorFactor=1
    const result = parseCustomWorkloadsJson(JSON.stringify({
      name: 'Compute Test',
      vmCount: 3,
      vCpusPerVm: 8,
      memoryPerVmGB: 32,
      osDiskPerVmGB: 0,
      storageTB: 10,
      internalMirrorFactor: 1,
      bandwidthMbps: 0,
    }))
    expect(result.error).toBeNull()
    const totals = computeAllCustomWorkloads(result.workloads)
    expect(totals.totalVCpus).toBe(24)       // 3 × 8
    expect(totals.totalMemoryGB).toBe(96)    // 3 × 32
    expect(totals.totalStorageTB).toBe(10)   // 0 osDisk + 10 storage × 1 mirror
  })

  it('applies internalMirrorFactor=2 to storage in totals', () => {
    const result = parseCustomWorkloadsJson(JSON.stringify({
      name: 'Mirrored',
      vmCount: 1,
      vCpusPerVm: 2,
      memoryPerVmGB: 8,
      osDiskPerVmGB: 0,
      storageTB: 5,
      internalMirrorFactor: 2,
      bandwidthMbps: 0,
    }))
    expect(result.error).toBeNull()
    const totals = computeAllCustomWorkloads(result.workloads)
    // storageTB × mirror = 5 × 2 = 10
    expect(totals.totalStorageTB).toBe(10)
  })

  it('includes OS disk contribution in totalStorageTB', () => {
    const result = parseCustomWorkloadsJson(JSON.stringify({
      name: 'OsDisk Test',
      vmCount: 2,
      vCpusPerVm: 4,
      memoryPerVmGB: 16,
      osDiskPerVmGB: 512,  // 0.5 TB each → 1 TB total
      storageTB: 0,
      internalMirrorFactor: 1,
      bandwidthMbps: 0,
    }))
    expect(result.error).toBeNull()
    const totals = computeAllCustomWorkloads(result.workloads)
    // osDisk = (2 × 512) / 1024 = 1 TB
    expect(totals.totalStorageTB).toBeCloseTo(1.0, 4)
  })

  it('sums across multiple parsed workloads', () => {
    const json = JSON.stringify([
      { name: 'A', vmCount: 2, vCpusPerVm: 4,  memoryPerVmGB: 16, osDiskPerVmGB: 0, storageTB: 5,  internalMirrorFactor: 1, bandwidthMbps: 0 },
      { name: 'B', vmCount: 3, vCpusPerVm: 8,  memoryPerVmGB: 32, osDiskPerVmGB: 0, storageTB: 10, internalMirrorFactor: 2, bandwidthMbps: 0 },
    ])
    const result = parseCustomWorkloadsJson(json)
    expect(result.error).toBeNull()
    const totals = computeAllCustomWorkloads(result.workloads)
    expect(totals.totalVCpus).toBe(8 + 24)     // 2×4 + 3×8 = 32
    expect(totals.totalMemoryGB).toBe(32 + 96)  // 2×16 + 3×32 = 128
    // A: 5 TB × 1 = 5; B: 10 TB × 2 = 20; total = 25
    expect(totals.totalStorageTB).toBe(25)
  })

  it('skips disabled workloads in totals', () => {
    const json = JSON.stringify([
      { name: 'Enabled',  enabled: true,  vmCount: 2, vCpusPerVm: 4, memoryPerVmGB: 16, storageTB: 5 },
      { name: 'Disabled', enabled: false, vmCount: 5, vCpusPerVm: 8, memoryPerVmGB: 32, storageTB: 20 },
    ])
    const result = parseCustomWorkloadsJson(json)
    expect(result.error).toBeNull()
    const totals = computeAllCustomWorkloads(result.workloads)
    // Only the enabled workload contributes
    expect(totals.totalVCpus).toBe(8)
    expect(totals.totalMemoryGB).toBe(32)
  })

  it('totalStorageTB is rounded to 2 decimal places', () => {
    // 1/3 TB storage × internalMirrorFactor 3 = 1 TB — but use values that produce fractional TB
    const wl: CustomWorkload = {
      id: 'cw-test',
      name: 'Fractional',
      description: '',
      enabled: true,
      vmCount: 1,
      vCpusPerVm: 1,
      memoryPerVmGB: 1,
      osDiskPerVmGB: 0,
      storageTB: 1.555,
      internalMirrorFactor: 1,
      bandwidthMbps: 0,
    }
    const totals = computeAllCustomWorkloads([wl])
    // totalStorageTB should be rounded to at most 2 decimal places
    const decimals = totals.totalStorageTB.toString().split('.')[1]?.length ?? 0
    expect(decimals).toBeLessThanOrEqual(2)
  })
})

// ─── Template shape ───────────────────────────────────────────────────────────

describe('JSON template shape', () => {
  // Validate that the template produced by the UI (JSON_TEMPLATE constant)
  // round-trips through parseCustomWorkloadsJson without errors.
  const TEMPLATE_JSON = JSON.stringify({
    name: 'My Custom Workload',
    description: 'Optional description of what this workload does',
    enabled: true,
    vmCount: 3,
    vCpusPerVm: 8,
    memoryPerVmGB: 32,
    osDiskPerVmGB: 200,
    storageTB: 10,
    internalMirrorFactor: 1,
    bandwidthMbps: 0,
  })

  it('template JSON parses without errors', () => {
    const result = parseCustomWorkloadsJson(TEMPLATE_JSON)
    expect(result.error).toBeNull()
    expect(result.imported).toBe(1)
  })

  it('template produces correct workload field values', () => {
    const result = parseCustomWorkloadsJson(TEMPLATE_JSON)
    const wl = result.workloads[0]
    expect(wl.name).toBe('My Custom Workload')
    expect(wl.vmCount).toBe(3)
    expect(wl.vCpusPerVm).toBe(8)
    expect(wl.memoryPerVmGB).toBe(32)
    expect(wl.osDiskPerVmGB).toBe(200)
    expect(wl.storageTB).toBe(10)
    expect(wl.internalMirrorFactor).toBe(1)
    expect(wl.bandwidthMbps).toBe(0)
  })

  it('template workload computes expected totals', () => {
    // 3 VMs × 8 vCPU = 24; 3 × 32 GB = 96 GB; (3×200/1024) + 10×1 ≈ 10.59 TB
    const result = parseCustomWorkloadsJson(TEMPLATE_JSON)
    const totals = computeAllCustomWorkloads(result.workloads)
    expect(totals.totalVCpus).toBe(24)
    expect(totals.totalMemoryGB).toBe(96)
    expect(totals.totalStorageTB).toBeCloseTo(10.59, 1)
  })
})
