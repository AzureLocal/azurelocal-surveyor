/**
 * Parity test suite — 20 golden scenarios.
 *
 * Golden values recomputed for the canonical pipeline (docs/capacity-model.md,
 * Wave 1 / AB#4641 AB#4643). All internal values are decimal TB.
 *
 * Pipeline (in order):
 *   Stage 1 — raw        = driveSizeTB × drivesPerNode × nodes
 *   Stage 2 — poolMeta   = raw × POOL_METADATA_FACTOR (0.99)
 *   Stage 3 — reserve    = min(nodes, 4) × largestRawDriveSizeTB   (AB#4643)
 *   Stage 4 — infraVol   = infraVolumeSizeTB / resiliencyFactor
 *   Stage 5 — available  = poolMeta − reserve − infraVol
 *   Stage 6 — effective  = available × resiliencyFactor
 *
 * KEY CHANGE from previous version:
 *   The old `capacityEfficiencyFactor` (0.92) is NO LONGER applied to the pool.
 *   It was a blended constant that double-counted the TB→TiB unit conversion.
 *   (docs/capacity-model.md Q1 / AB#4641). The reserve now uses the largest
 *   raw drive size, not efficiency-adjusted usable (AB#4643).
 *
 * Scenario 17: capacityEfficiencyFactor was removed in 2.4.1 (field deleted from AdvancedSettings).
 * The field was never applied to the pool (AB#4641). Scenario 17 equals Scenario 02.
 * Per-drive override is still available via overrides.driveUsableTb.
 *
 * Dual Parity efficiency is node-count dependent:
 *   4–6 nodes → 0.5, 7–8 nodes → 0.667, 9–15 nodes → 0.75, 16 nodes → 0.8
 *
 * Resiliency gating (AB#4636): scenarios requesting a resiliency invalid for their
 * node count will have the result clamped to two-way-mirror.
 *
 * Tolerance: ±0.02 TB to account for floating-point rounding at 4 decimal places.
 */

import { describe, it, expect } from 'vitest'
import {
  computeCapacity,
  DEFAULT_ADVANCED_SETTINGS,
  type HardwareInputs,
  type AdvancedSettings,
} from '../index'

const TOL = 0.02

function near(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= TOL
}

const BASE_HW: HardwareInputs = {
  nodeCount: 4,
  capacityDrivesPerNode: 6,
  capacityDriveSizeTB: 3.84,
  cacheDrivesPerNode: 0,
  cacheDriveSizeTB: 0,
  cacheMediaType: 'none',
  capacityMediaType: 'nvme',
  coresPerNode: 32,
  memoryPerNodeGB: 256,
  hyperthreadingEnabled: true,
}

function scenario(
  label: string,
  hw: HardwareInputs,
  settings: Partial<AdvancedSettings>,
  expected: { rawPoolTB: number; effectiveUsableTB: number }
) {
  it(label, () => {
    const merged: AdvancedSettings = { ...DEFAULT_ADVANCED_SETTINGS, ...settings }
    const result = computeCapacity(hw, merged)
    expect(near(result.rawPoolTB, expected.rawPoolTB)).toBe(true)
    expect(near(result.effectiveUsableTB, expected.effectiveUsableTB)).toBe(true)
  })
}

describe('Capacity parity — 20 golden scenarios (canonical model, Wave 1)', () => {
  // ── Scenario 01: 2-node, all-NVMe, 6×3.84TB, two-way mirror ──
  // raw=46.08, poolMeta=46.08×0.99=45.6192, reserve=min(2,4)×3.84=7.68
  // infra=0.25/0.5=0.5, available=45.6192-7.68-0.5=37.4392, effective=37.4392×0.5=18.72
  scenario('01 — 2-node, 6×3.84TB, two-way mirror',
    { ...BASE_HW, nodeCount: 2 },
    { defaultResiliency: 'two-way-mirror' },
    { rawPoolTB: 46.08, effectiveUsableTB: 18.72 }
  )

  // ── Scenario 02: 4-node, all-NVMe, 6×3.84TB, three-way mirror ──
  // raw=92.16, poolMeta=92.16×0.99=91.2384, reserve=min(4,4)×3.84=15.36
  // infra=0.25/(1/3)=0.75, available=91.2384-15.36-0.75=75.1284, effective=75.1284/3=25.04
  scenario('02 — 4-node, 6×3.84TB, three-way mirror',
    { ...BASE_HW },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 92.16, effectiveUsableTB: 25.04 }
  )

  // ── Scenario 03: 4-node, all-NVMe, 6×3.84TB, dual-parity (4–6 nodes → 50%) ──
  // infra=0.25/0.5=0.5, available=91.2384-15.36-0.5=75.3784, effective=75.3784×0.5=37.69
  scenario('03 — 4-node, 6×3.84TB, dual-parity (50%)',
    { ...BASE_HW },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 92.16, effectiveUsableTB: 37.69 }
  )

  // ── Scenario 04: 8-node, all-NVMe, 6×3.84TB, three-way mirror ──
  // raw=184.32, poolMeta=182.4768, reserve=min(8,4)×3.84=15.36
  // infra=0.75, available=182.4768-15.36-0.75=166.3668, effective=166.3668/3=55.46
  scenario('04 — 8-node, 6×3.84TB, three-way mirror',
    { ...BASE_HW, nodeCount: 8 },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 184.32, effectiveUsableTB: 55.46 }
  )

  // ── Scenario 05: 8-node, all-NVMe, 6×3.84TB, dual-parity (7–8 nodes → 66.7%) ──
  // infra=0.25/(2/3)=0.375, available=182.4768-15.36-0.375=166.7418, effective=166.7418×(2/3)=111.16
  scenario('05 — 8-node, 6×3.84TB, dual-parity (66.7%)',
    { ...BASE_HW, nodeCount: 8 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 184.32, effectiveUsableTB: 111.16 }
  )

  // ── Scenario 06: 4-node, NVMe+HDD, 8×14TB, three-way mirror ──
  // raw=448, poolMeta=443.52, reserve=4×14=56, infra=0.75
  // available=443.52-56-0.75=386.77, effective=386.77/3=128.92
  scenario('06 — 4-node, NVMe+HDD, 8×14TB, three-way mirror',
    { ...BASE_HW, capacityDrivesPerNode: 8, capacityDriveSizeTB: 14, cacheDrivesPerNode: 2, cacheDriveSizeTB: 1.6, cacheMediaType: 'nvme', capacityMediaType: 'hdd', coresPerNode: 20, memoryPerNodeGB: 128 },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 448, effectiveUsableTB: 128.92 }
  )

  // ── Scenario 07: 4-node, NVMe+HDD, 8×14TB, dual-parity (4–6 nodes → 50%) ──
  // infra=0.5, available=443.52-56-0.5=387.02, effective=387.02×0.5=193.51
  scenario('07 — 4-node, NVMe+HDD, 8×14TB, dual-parity (50%)',
    { ...BASE_HW, capacityDrivesPerNode: 8, capacityDriveSizeTB: 14, cacheDrivesPerNode: 2, cacheDriveSizeTB: 1.6, cacheMediaType: 'nvme', capacityMediaType: 'hdd', coresPerNode: 20, memoryPerNodeGB: 128 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 448, effectiveUsableTB: 193.51 }
  )

  // ── Scenario 08: 2-node, all-NVMe, 10×7.68TB, two-way mirror ──
  // raw=153.6, poolMeta=152.064, reserve=min(2,4)×7.68=15.36
  // infra=0.5, available=152.064-15.36-0.5=136.204, effective=136.204×0.5=68.10
  scenario('08 — 2-node, 10×7.68TB, two-way mirror',
    { ...BASE_HW, nodeCount: 2, capacityDrivesPerNode: 10, capacityDriveSizeTB: 7.68, coresPerNode: 48, memoryPerNodeGB: 512 },
    { defaultResiliency: 'two-way-mirror' },
    { rawPoolTB: 153.6, effectiveUsableTB: 68.10 }
  )

  // ── Scenario 09: 16-node, all-NVMe, 6×3.84TB, three-way mirror ──
  // raw=368.64, poolMeta=364.9536, reserve=min(16,4)×3.84=15.36
  // infra=0.75, available=364.9536-15.36-0.75=348.8436, effective=348.8436/3=116.28
  scenario('09 — 16-node, 6×3.84TB, three-way mirror',
    { ...BASE_HW, nodeCount: 16 },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 368.64, effectiveUsableTB: 116.28 }
  )

  // ── Scenario 10: 16-node, all-NVMe, 6×3.84TB, dual-parity (16 nodes → 80%) ──
  // infra=0.25/0.8=0.3125, available=364.9536-15.36-0.3125=349.281, effective=349.281×0.8=279.42
  scenario('10 — 16-node, 6×3.84TB, dual-parity (80%)',
    { ...BASE_HW, nodeCount: 16 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 368.64, effectiveUsableTB: 279.42 }
  )

  // ── Scenario 11: 3-node, all-NVMe, 6×3.84TB, three-way mirror ──
  // raw=69.12, poolMeta=68.4288, reserve=min(3,4)×3.84=11.52
  // infra=0.75, available=68.4288-11.52-0.75=56.1588, effective=56.1588/3=18.72
  scenario('11 — 3-node, 6×3.84TB, three-way mirror',
    { ...BASE_HW, nodeCount: 3 },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 69.12, effectiveUsableTB: 18.72 }
  )

  // ── Scenario 12: 4-node, all-NVMe, 8×7.68TB, three-way mirror ──
  // raw=245.76, poolMeta=243.3024, reserve=4×7.68=30.72
  // infra=0.75, available=243.3024-30.72-0.75=211.8324, effective=211.8324/3=70.61
  scenario('12 — 4-node, 8×7.68TB, three-way mirror',
    { ...BASE_HW, capacityDrivesPerNode: 8, capacityDriveSizeTB: 7.68, coresPerNode: 40, memoryPerNodeGB: 512 },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 245.76, effectiveUsableTB: 70.61 }
  )

  // ── Scenario 13: 4-node, all-NVMe, 8×7.68TB, dual-parity (4–6 nodes → 50%) ──
  // infra=0.5, available=243.3024-30.72-0.5=212.0824, effective=212.0824×0.5=106.04
  scenario('13 — 4-node, 8×7.68TB, dual-parity (50%)',
    { ...BASE_HW, capacityDrivesPerNode: 8, capacityDriveSizeTB: 7.68, coresPerNode: 40, memoryPerNodeGB: 512 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 245.76, effectiveUsableTB: 106.04 }
  )

  // ── Scenario 14: 2-node, all-NVMe, 4×1.92TB, two-way mirror ──
  // raw=15.36, poolMeta=15.2064, reserve=min(2,4)×1.92=3.84
  // infra=0.5, available=15.2064-3.84-0.5=10.8664, effective=10.8664×0.5=5.43
  scenario('14 — 2-node, 4×1.92TB, two-way mirror',
    { ...BASE_HW, nodeCount: 2, capacityDrivesPerNode: 4, capacityDriveSizeTB: 1.92, coresPerNode: 16, memoryPerNodeGB: 128 },
    { defaultResiliency: 'two-way-mirror' },
    { rawPoolTB: 15.36, effectiveUsableTB: 5.43 }
  )

  // ── Scenario 15: 6-node, all-NVMe, 6×3.84TB, three-way mirror ──
  // raw=138.24, poolMeta=136.8576, reserve=min(6,4)×3.84=15.36
  // infra=0.75, available=136.8576-15.36-0.75=120.7476, effective=120.7476/3=40.25
  scenario('15 — 6-node, 6×3.84TB, three-way mirror',
    { ...BASE_HW, nodeCount: 6 },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 138.24, effectiveUsableTB: 40.25 }
  )

  // ── Scenario 16: 6-node, all-NVMe, 6×3.84TB, dual-parity (4–6 nodes → 50%) ──
  // infra=0.5, available=136.8576-15.36-0.5=120.9976, effective=120.9976×0.5=60.50
  scenario('16 — 6-node, 6×3.84TB, dual-parity (50%)',
    { ...BASE_HW, nodeCount: 6 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 138.24, effectiveUsableTB: 60.50 }
  )

  // ── Scenario 17: 4-node, 6×3.84TB, three-way mirror ──
  // capacityEfficiencyFactor was removed in 2.4.1 (AB#4641: never applied to pool).
  // Scenario now equals Scenario 02 — three-way-mirror defaults.
  // To test per-drive override, use overrides.driveUsableTb instead.
  // raw=92.16, poolMeta=91.2384, reserve=15.36, infra=0.75, available=75.1284, effective=25.04
  scenario('17 — 4-node, 6×3.84TB, three-way (capacityEfficiencyFactor removed; equals Scenario 02)',
    { ...BASE_HW },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 92.16, effectiveUsableTB: 25.04 }
  )

  // ── Scenario 18: 4-node, 6×3.84TB, nested-two-way (25%) ──
  // infra=0.25/0.25=1.0, available=91.2384-15.36-1.0=74.8784, effective=74.8784×0.25=18.72
  scenario('18 — 4-node, 6×3.84TB, nested-two-way (25%)',
    { ...BASE_HW },
    { defaultResiliency: 'nested-two-way' },
    { rawPoolTB: 92.16, effectiveUsableTB: 18.72 }
  )

  // ── Scenario 19: 8-node, 12×3.84TB (DataON high-density), dual-parity (7–8 → 66.7%) ──
  // raw=368.64, poolMeta=364.9536, reserve=min(8,4)×3.84=15.36
  // infra=0.25/(2/3)=0.375, available=364.9536-15.36-0.375=349.2186, effective=349.2186×(2/3)=232.81
  scenario('19 — 8-node, 12×3.84TB, dual-parity (DataON 66.7%)',
    { ...BASE_HW, nodeCount: 8, capacityDrivesPerNode: 12, coresPerNode: 24, memoryPerNodeGB: 192 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 368.64, effectiveUsableTB: 232.81 }
  )

  // ── Scenario 20: 4-node, 10×7.68TB, dual-parity (4–6 → 50%) ──
  // raw=307.2, poolMeta=304.128, reserve=4×7.68=30.72
  // infra=0.5, available=304.128-30.72-0.5=272.908, effective=272.908×0.5=136.45
  scenario('20 — 4-node, 10×7.68TB, dual-parity (50%)',
    { ...BASE_HW, capacityDrivesPerNode: 10, capacityDriveSizeTB: 7.68, coresPerNode: 48, memoryPerNodeGB: 512 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 307.2, effectiveUsableTB: 136.45 }
  )
})

// ── Resiliency Gating Tests (AB#4636) ────────────────────────────────────────

describe('Resiliency gating (AB#4636)', () => {
  const HW_2NODE: HardwareInputs = {
    ...BASE_HW,
    nodeCount: 2,
  }

  it('three-way-mirror on 2-node → clamped to two-way-mirror', () => {
    const result = computeCapacity(HW_2NODE, { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'three-way-mirror' })
    expect(result.resiliencyClamped).toBe(true)
    expect(result.resiliencyRequested).toBe('three-way-mirror')
    expect(result.resiliencyType).toBe('two-way-mirror')
  })

  it('dual-parity on 2-node → clamped to two-way-mirror', () => {
    const result = computeCapacity(HW_2NODE, { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'dual-parity' })
    expect(result.resiliencyClamped).toBe(true)
    expect(result.resiliencyType).toBe('two-way-mirror')
  })

  it('dual-parity on 3-node → clamped (needs 4)', () => {
    const result = computeCapacity({ ...BASE_HW, nodeCount: 3 }, { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'dual-parity' })
    expect(result.resiliencyClamped).toBe(true)
    expect(result.resiliencyType).toBe('two-way-mirror')
  })

  it('two-way-mirror on 2-node → valid, not clamped', () => {
    const result = computeCapacity(HW_2NODE, { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'two-way-mirror' })
    expect(result.resiliencyClamped).toBe(false)
    expect(result.resiliencyType).toBe('two-way-mirror')
  })

  it('nested-two-way on 2-node → valid, not clamped', () => {
    const result = computeCapacity(HW_2NODE, { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'nested-two-way' })
    expect(result.resiliencyClamped).toBe(false)
    expect(result.resiliencyType).toBe('nested-two-way')
  })

  it('three-way-mirror on 3-node → valid, not clamped', () => {
    const result = computeCapacity({ ...BASE_HW, nodeCount: 3 }, { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'three-way-mirror' })
    expect(result.resiliencyClamped).toBe(false)
    expect(result.resiliencyType).toBe('three-way-mirror')
  })

  it('dual-parity on 4-node → valid, not clamped', () => {
    const result = computeCapacity(BASE_HW, { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'dual-parity' })
    expect(result.resiliencyClamped).toBe(false)
    expect(result.resiliencyType).toBe('dual-parity')
  })
})

// ── Reserve Basis Tests (AB#4643) ────────────────────────────────────────────

describe('Reserve basis — raw drive size (AB#4643)', () => {
  it('2-node, 4×3.84TB: reserve = 2 × 3.84 = 7.68 TB (not efficiency-adjusted)', () => {
    const result = computeCapacity(
      { ...BASE_HW, nodeCount: 2, capacityDrivesPerNode: 4 },
      { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'two-way-mirror' }
    )
    expect(result.reserveDrives).toBe(2)
    expect(Math.abs(result.reserveTB - 7.68)).toBeLessThan(0.001)
  })

  it('4-node, 6×3.84TB: reserve = 4 × 3.84 = 15.36 TB', () => {
    const result = computeCapacity(BASE_HW, DEFAULT_ADVANCED_SETTINGS)
    expect(result.reserveDrives).toBe(4)
    expect(Math.abs(result.reserveTB - 15.36)).toBeLessThan(0.001)
  })

  it('8-node (capped at 4): reserve = 4 × 3.84 = 15.36 TB', () => {
    const result = computeCapacity({ ...BASE_HW, nodeCount: 8 }, DEFAULT_ADVANCED_SETTINGS)
    expect(result.reserveDrives).toBe(4)
    expect(Math.abs(result.reserveTB - 15.36)).toBeLessThan(0.001)
  })
})

// ── Reference Cluster Reconciliation (docs/capacity-model.md) ────────────────

describe('Reference cluster: 3.84 TB × 4 drives × 2 nodes, two-way mirror', () => {
  it('matches canonical pipeline stages from docs/capacity-model.md', () => {
    const result = computeCapacity(
      { ...BASE_HW, nodeCount: 2, capacityDrivesPerNode: 4 },
      { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'two-way-mirror', infraVolumeSizeTB: 0.25 }
    )
    // Stage 1 — raw
    expect(Math.abs(result.rawPoolTB - 30.72)).toBeLessThan(0.001)
    // Stage 2 — pool after ~1% overhead: 30.72 × 0.99 = 30.4128 (displayed as totalUsableTB)
    expect(Math.abs(result.totalUsableTB - 30.4128)).toBeLessThan(0.001)
    // Stage 3 — reserve: 2 × 3.84 = 7.68 (raw drive basis)
    expect(Math.abs(result.reserveTB - 7.68)).toBeLessThan(0.001)
    // Stage 4 — infra vol footprint: 0.25 / 0.5 = 0.5
    expect(Math.abs(result.infraVolumeTB - 0.5)).toBeLessThan(0.001)
    // Stage 5 — available: 30.4128 - 7.68 - 0.5 = 22.2328 (canonical: ~22.4 with measured infra)
    expect(Math.abs(result.availableForVolumesTB - 22.2328)).toBeLessThan(0.01)
    // Resiliency not clamped
    expect(result.resiliencyClamped).toBe(false)
  })
})
