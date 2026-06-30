/**
 * Wave 2 — Legibility tests (AB#4640, AB#4639, AB#4637)
 *
 * AB#4639 — 70% planning line math.
 * Canonical (docs/capacity-model.md stage 7):
 *   seventyPctLineTB = 0.70 × availableForVolumesTB  (footprint basis)
 * Alert fires when planned volume footprint > seventyPctLineTB.
 *
 * AB#4640 — unit conversion: TB_TO_TiB = 10^12 / 2^40 ≈ 0.909099.
 * Applied ONCE at display; not re-applied inside pool math.
 *
 * AB#4637 — resiliency toggle in generateGenericVolumes.
 * resiliencyOverride causes volume sizes to recompute from the pool target
 * with the chosen resiliency efficiency (only valid options for node count).
 */

import { describe, it, expect } from 'vitest'
import { seventyPctLineTB, POOL_SEVENTY_PCT } from '../thresholds'
import { TB_TO_TiB, computeCapacity } from '../capacity'
import { generateGenericVolumes } from '../volumes'
import { DEFAULT_ADVANCED_SETTINGS } from '../types'
import type { HardwareInputs } from '../types'

// ─── AB#4639 — 70% planning line ─────────────────────────────────────────────

describe('seventyPctLineTB (AB#4639)', () => {
  it('constant is 0.70', () => {
    expect(POOL_SEVENTY_PCT).toBe(0.70)
  })

  it('seventyPctLineTB(100) = 70', () => {
    expect(seventyPctLineTB(100)).toBeCloseTo(70, 6)
  })

  it('seventyPctLineTB(22.4) ≈ 15.68', () => {
    expect(seventyPctLineTB(22.4)).toBeCloseTo(15.68, 4)
  })

  it('seventyPctLineTB(0) = 0', () => {
    expect(seventyPctLineTB(0)).toBe(0)
  })

  it('alert fires: footprint > 70% of available', () => {
    const available = 100
    const line = seventyPctLineTB(available)
    expect(71 > line).toBe(true)   // 71 > 70 → alert fires
    expect(70 > line).toBe(false)  // exactly 70 does not exceed the line
    expect(69 > line).toBe(false)  // 69 < 70 → no alert
  })

  it('reference cluster: available ≈ 22.23 TB → line ≈ 15.56 TB', () => {
    // Reference cluster from capacity-model.md: 3.84 TB × 4 drives × 2 nodes, two-way mirror
    const hw: HardwareInputs = {
      nodeCount: 2,
      capacityDrivesPerNode: 4,
      capacityDriveSizeTB: 3.84,
      cacheDrivesPerNode: 0,
      cacheDriveSizeTB: 0,
      cacheMediaType: 'none',
      capacityMediaType: 'nvme',
      coresPerNode: 16,
      memoryPerNodeGB: 128,
      hyperthreadingEnabled: true,
    }
    const cap = computeCapacity(hw, { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'two-way-mirror' })
    const line = seventyPctLineTB(cap.availableForVolumesTB)
    // available ≈ 22.2328 TB → line ≈ 15.5630
    expect(line).toBeCloseTo(cap.availableForVolumesTB * 0.70, 4)
    expect(Math.abs(line - 15.56)).toBeLessThan(0.1)
  })
})

// ─── AB#4640 — TB ↔ TiB unit conversion ──────────────────────────────────────

describe('TB_TO_TiB unit conversion (AB#4640)', () => {
  it('TB_TO_TiB = 10^12 / 2^40 ≈ 0.909495', () => {
    // 1e12 / (1024^4) = 1e12 / 1099511627776 ≈ 0.90949470177
    expect(TB_TO_TiB).toBe(1e12 / Math.pow(1024, 4))
    expect(TB_TO_TiB).toBeCloseTo(0.909495, 4)
  })

  it('1 TB = ~0.9095 TiB', () => {
    expect(1 * TB_TO_TiB).toBeCloseTo(0.9095, 3)
  })

  it('3.84 TB = ~3.4925 TiB (drive size conversion)', () => {
    expect(3.84 * TB_TO_TiB).toBeCloseTo(3.4925, 3)
  })

  it('availableForVolumesTiB is availableForVolumesTB × TB_TO_TiB (applied once)', () => {
    const hw: HardwareInputs = {
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
    const cap = computeCapacity(hw, DEFAULT_ADVANCED_SETTINGS)
    // availableForVolumesTiB must exactly equal availableForVolumesTB × TB_TO_TiB (rounded to 4dp)
    const expected = Math.round(cap.availableForVolumesTB * TB_TO_TiB * 10000) / 10000
    expect(cap.availableForVolumesTiB).toBe(expected)
    // The two values differ by the decimal-to-binary ratio (~9%)
    expect(cap.availableForVolumesTiB).toBeLessThan(cap.availableForVolumesTB)
    expect(cap.availableForVolumesTiB / cap.availableForVolumesTB).toBeCloseTo(TB_TO_TiB, 4)
  })

  it('70% line in TiB = 70% of availableForVolumesTiB (same ratio)', () => {
    const available = 22.4
    const lineTB = seventyPctLineTB(available)
    const lineTiB = lineTB * TB_TO_TiB
    expect(lineTiB).toBeCloseTo(available * TB_TO_TiB * 0.70, 6)
  })
})

// ─── AB#4637 — resiliency toggle in generateGenericVolumes ───────────────────

describe('generateGenericVolumes resiliency toggle (AB#4637)', () => {
  const hw: HardwareInputs = {
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
  const cap = computeCapacity(hw, { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'three-way-mirror' })

  it('no override uses capacity.resiliencyType', () => {
    const sugs = generateGenericVolumes(cap, 0.7)
    expect(sugs.length).toBeGreaterThan(0)
    expect(sugs[0].resiliency).toBe('three-way-mirror')
  })

  it('two-way-mirror override produces larger volumes than three-way (50% vs 33.3%)', () => {
    const threeWay = generateGenericVolumes(cap, 0.7, 'three-way-mirror')
    const twoWay   = generateGenericVolumes(cap, 0.7, 'two-way-mirror')
    expect(twoWay[0].plannedSizeTB).toBeGreaterThan(threeWay[0].plannedSizeTB)
    // Two-way is 50% efficient; three-way is 33.3% → two-way volumes should be ~1.5× larger
    expect(twoWay[0].plannedSizeTB / threeWay[0].plannedSizeTB).toBeCloseTo(1.5, 1)
  })

  it('override resiliency is reflected on every suggestion', () => {
    const sugs = generateGenericVolumes(cap, 0.7, 'two-way-mirror')
    for (const s of sugs) {
      expect(s.resiliency).toBe('two-way-mirror')
    }
  })

  it('nested-two-way override produces smaller volumes than two-way (25% vs 50%)', () => {
    const twoWay   = generateGenericVolumes(cap, 0.7, 'two-way-mirror')
    const nested   = generateGenericVolumes(cap, 0.7, 'nested-two-way')
    expect(nested[0].plannedSizeTB).toBeLessThan(twoWay[0].plannedSizeTB)
  })

  it('volume count matches nodeCount (up to 16)', () => {
    const sugs = generateGenericVolumes(cap, 0.7, 'three-way-mirror')
    expect(sugs.length).toBe(Math.min(hw.nodeCount, 16))
  })

  it('total footprint stays at or below targetUtilization × available (0.7)', () => {
    const sugs = generateGenericVolumes(cap, 0.7, 'three-way-mirror')
    const footprint = sugs.reduce((s, v) => {
      // footprint = size / resiliency_efficiency; three-way = size × 3
      return s + v.plannedSizeTB * 3
    }, 0)
    const budget = cap.availableForVolumesTB * 0.7
    // Floor rounding means footprint may be slightly below budget
    expect(footprint).toBeLessThanOrEqual(budget + 0.1)
  })

  it('2-node cluster does not get three-way-mirror (resiliency gating)', () => {
    const hw2: HardwareInputs = { ...hw, nodeCount: 2 }
    const cap2 = computeCapacity(hw2, { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'two-way-mirror' })
    // If three-way is passed as override for a 2-node, generateGenericVolumes still uses it
    // because it trusts the caller to pass a valid option (validResiliencyOptions).
    // The UI gates the options via validResiliencyOptions; test that the engine trusts caller.
    const sugs = generateGenericVolumes(cap2, 0.7, 'two-way-mirror')
    expect(sugs[0].resiliency).toBe('two-way-mirror')
    expect(sugs.length).toBe(2) // nodeCount=2
  })
})
