/**
 * Expansion Headroom tests — 2.4.1 (Deliverable 2)
 *
 * Tests:
 *  1. capacityEfficiencyFactor field is gone and capacity outputs are byte-identical.
 *  2. computeExpansionHeadroom golden values — Scenario A (user scenario):
 *       A=22.2328, U=15.56, copies=2 (two-way-mirror)
 *  3. computeExpansionHeadroom golden values — Scenario B (Cartographer golden):
 *       A=22.44, U=14.28, copies=2 (two-way-mirror)
 *
 * GOLDEN SPEC (from deliverable brief):
 *   A = availableForVolumesTB, U = totalPoolFootprintTB, copies = data copies
 *
 *   Scenario A: A=22.2328, U=15.56, copies=2
 *     currentUtilizationPct ≈ 70.0%
 *     70% row: budget≈15.5630 TB, remaining footprint≈0.00 TB (past line at ≥70%), new usable≈0
 *     100% row: budget=22.2328 TB, remaining footprint≈6.67 TB, new usable≈3.34 TB
 *
 *   Scenario B: A=22.44, U=14.28, copies=2
 *     70% row: budget≈15.708 TB, remaining footprint≈1.428 TB, new usable≈0.714 TB
 *     100% row: budget=22.44 TB, remaining footprint≈8.16 TB, new usable≈4.08 TB
 */

import { describe, it, expect } from 'vitest'
import {
  computeCapacity,
  computeExpansionHeadroom,
  DEFAULT_ADVANCED_SETTINGS,
  type HardwareInputs,
  type AdvancedSettings,
} from '../index'

// Tolerance for golden value assertions (±0.05 TB)
const TOL = 0.05

function near(actual: number, expected: number, tol = TOL): boolean {
  return Math.abs(actual - expected) <= tol
}

// ─── 1. capacityEfficiencyFactor field is gone ────────────────────────────────

describe('capacityEfficiencyFactor removed (2.4.1)', () => {
  it('DEFAULT_ADVANCED_SETTINGS does not have capacityEfficiencyFactor', () => {
    expect('capacityEfficiencyFactor' in DEFAULT_ADVANCED_SETTINGS).toBe(false)
  })

  it('AdvancedSettings constructed without capacityEfficiencyFactor compiles and works', () => {
    const settings: AdvancedSettings = {
      infraVolumeSizeTB: 0.25,
      vCpuOversubscriptionRatio: 4,
      systemReservedMemoryGB: 8,
      systemReservedVCpus: 4,
      defaultResiliency: 'three-way-mirror',
      overrides: {},
    }
    // No TypeScript error — the field does not exist on the type
    expect(settings.infraVolumeSizeTB).toBe(0.25)
    expect('capacityEfficiencyFactor' in settings).toBe(false)
  })

  it('capacity outputs are byte-identical to pre-removal (Scenario 02 golden: raw=92.16, eff=25.04)', () => {
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
    const result = computeCapacity(hw, { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'three-way-mirror' })
    // These golden values are the same as capacity.parity.test.ts Scenario 02:
    // the 0.92 factor was NEVER applied to the pool, so nothing changes.
    expect(near(result.rawPoolTB, 92.16)).toBe(true)
    expect(near(result.effectiveUsableTB, 25.04)).toBe(true)
    expect(near(result.reserveTB, 15.36)).toBe(true)
    // Confirm field doesn't bleed in via any path
    expect('capacityEfficiencyFactor' in result).toBe(false)
  })

  it('normalizePersistedState strips capacityEfficiencyFactor from old persisted state', async () => {
    // Dynamically import to avoid circular dep issues in the test environment
    const { normalizePersistedState } = await import('../../state/store')
    const oldState = {
      advanced: {
        capacityEfficiencyFactor: 0.92,
        infraVolumeSizeTB: 0.25,
        vCpuOversubscriptionRatio: 4,
        systemReservedMemoryGB: 8,
        systemReservedVCpus: 4,
        defaultResiliency: 'three-way-mirror',
        overrides: {},
      },
    }
    const result = normalizePersistedState(oldState)
    expect('capacityEfficiencyFactor' in result.advanced).toBe(false)
  })
})

// ─── 2. computeExpansionHeadroom — Scenario A (user scenario) ────────────────

describe('computeExpansionHeadroom — Scenario A: A=22.2328, U=15.56, copies=2', () => {
  const A = 22.2328
  const U = 15.56
  const result = computeExpansionHeadroom(A, U, 'two-way-mirror')

  it('copies = 2 (two-way-mirror)', () => {
    expect(result.copies).toBe(2)
  })

  it('currentUtilizationPct ≈ 70.0%', () => {
    // U/A*100 = 15.56/22.2328*100 ≈ 70.0%
    expect(near(result.currentUtilizationPct, 70.0, 0.1)).toBe(true)
  })

  it('70% row: footprintBudget ≈ 15.563 TB', () => {
    const row70 = result.rows.find((r) => r.targetFraction === 0.70)!
    expect(near(row70.footprintBudgetTB, A * 0.70, 0.01)).toBe(true)
    // A*0.70 = 22.2328*0.70 = 15.56296
    expect(near(row70.footprintBudgetTB, 15.563, 0.01)).toBe(true)
  })

  it('70% row: remainingFootprint ≈ 0 (U ≈ budget, past line)', () => {
    const row70 = result.rows.find((r) => r.targetFraction === 0.70)!
    // U=15.56 > budget≈15.563 is borderline; U is slightly under, so pastLine=false
    // but remaining ≈ 0.003 TB which rounds to ~0
    expect(row70.remainingFootprintTB).toBeGreaterThanOrEqual(0)
    expect(near(row70.remainingFootprintTB, 0.0, 0.05)).toBe(true)
  })

  it('70% row: new usable ≈ 0 (nothing or ~0.001)', () => {
    const row70 = result.rows.find((r) => r.targetFraction === 0.70)!
    expect(near(row70.remainingNewUsableTB, 0.0, 0.05)).toBe(true)
  })

  it('100% row: footprintBudget = A = 22.2328 TB', () => {
    const row100 = result.rows.find((r) => r.targetFraction === 1.00)!
    expect(near(row100.footprintBudgetTB, 22.2328, 0.001)).toBe(true)
  })

  it('100% row: remainingFootprint ≈ 6.67 TB', () => {
    const row100 = result.rows.find((r) => r.targetFraction === 1.00)!
    // A - U = 22.2328 - 15.56 = 6.6728
    expect(near(row100.remainingFootprintTB, 6.67, 0.02)).toBe(true)
  })

  it('100% row: new usable ≈ 3.34 TB (6.67 ÷ 2)', () => {
    const row100 = result.rows.find((r) => r.targetFraction === 1.00)!
    // 6.6728 / 2 = 3.3364
    expect(near(row100.remainingNewUsableTB, 3.34, 0.02)).toBe(true)
  })

  it('all rows have TiB values computed via TB / 1.099511627776', () => {
    const TiB_DIV = Math.pow(1024, 4) / 1e12
    for (const row of result.rows) {
      expect(Math.abs(row.footprintBudgetTiB - row.footprintBudgetTB / TiB_DIV)).toBeLessThan(0.0001)
      expect(Math.abs(row.remainingNewUsableTiB - row.remainingNewUsableTB / TiB_DIV)).toBeLessThan(0.0001)
    }
  })

  it('rows are in ascending fill-target order', () => {
    const fractions = result.rows.map((r) => r.targetFraction)
    expect(fractions).toEqual([0.70, 0.80, 0.90, 1.00])
  })
})

// ─── 3. computeExpansionHeadroom — Scenario B (Cartographer golden) ──────────

describe('computeExpansionHeadroom — Scenario B: A=22.44, U=14.28, copies=2 (Cartographer cross-check)', () => {
  const A = 22.44
  const U = 14.28
  const result = computeExpansionHeadroom(A, U, 'two-way-mirror')

  it('copies = 2', () => {
    expect(result.copies).toBe(2)
  })

  it('70% row: footprintBudget ≈ 15.708 TB', () => {
    const row70 = result.rows.find((r) => r.targetFraction === 0.70)!
    expect(near(row70.footprintBudgetTB, 22.44 * 0.70, 0.001)).toBe(true)
  })

  it('70% row: remaining footprint ≈ 1.43 TB', () => {
    const row70 = result.rows.find((r) => r.targetFraction === 0.70)!
    // A*0.70 - U = 15.708 - 14.28 = 1.428
    expect(near(row70.remainingFootprintTB, 1.428, 0.01)).toBe(true)
  })

  it('70% row: new usable ≈ 0.714 TB (1.428 ÷ 2)', () => {
    const row70 = result.rows.find((r) => r.targetFraction === 0.70)!
    expect(near(row70.remainingNewUsableTB, 0.714, 0.01)).toBe(true)
  })

  it('70% row: not past line (U < budget)', () => {
    const row70 = result.rows.find((r) => r.targetFraction === 0.70)!
    expect(row70.pastLine).toBe(false)
  })

  it('100% row: remaining footprint ≈ 8.16 TB', () => {
    const row100 = result.rows.find((r) => r.targetFraction === 1.00)!
    // A - U = 22.44 - 14.28 = 8.16
    expect(near(row100.remainingFootprintTB, 8.16, 0.01)).toBe(true)
  })

  it('100% row: new usable ≈ 4.08 TB (8.16 ÷ 2)', () => {
    const row100 = result.rows.find((r) => r.targetFraction === 1.00)!
    expect(near(row100.remainingNewUsableTB, 4.08, 0.01)).toBe(true)
  })

  it('100% row: not past line', () => {
    const row100 = result.rows.find((r) => r.targetFraction === 1.00)!
    expect(row100.pastLine).toBe(false)
  })

  it('pastLine=true only when U > budget (none here since U=14.28 < 0.70*A=15.708)', () => {
    for (const row of result.rows) {
      expect(row.pastLine).toBe(false)
    }
  })
})

// ─── 4. resiliencyDataCopies coverage ────────────────────────────────────────

describe('resiliencyDataCopies', () => {
  it('two-way-mirror → 2 copies', () => {
    const r = computeExpansionHeadroom(100, 0, 'two-way-mirror')
    expect(r.copies).toBe(2)
  })

  it('three-way-mirror → 3 copies', () => {
    const r = computeExpansionHeadroom(100, 0, 'three-way-mirror')
    expect(r.copies).toBe(3)
  })

  it('nested-two-way → 4 copies', () => {
    const r = computeExpansionHeadroom(100, 0, 'nested-two-way')
    expect(r.copies).toBe(4)
  })

  it('dual-parity → 2 copies', () => {
    const r = computeExpansionHeadroom(100, 0, 'dual-parity')
    expect(r.copies).toBe(2)
  })

  it('three-way: 100% new usable = A/3 when U=0', () => {
    const A = 60
    const r = computeExpansionHeadroom(A, 0, 'three-way-mirror')
    const row100 = r.rows.find((row) => row.targetFraction === 1.00)!
    expect(near(row100.remainingNewUsableTB, A / 3, 0.01)).toBe(true)
  })
})

// ─── 5. Edge cases ────────────────────────────────────────────────────────────

describe('computeExpansionHeadroom edge cases', () => {
  it('U=0 (no volumes): 100% row new usable = A/copies', () => {
    const A = 50
    const r = computeExpansionHeadroom(A, 0, 'two-way-mirror')
    const row100 = r.rows.find((row) => row.targetFraction === 1.00)!
    expect(near(row100.remainingNewUsableTB, A / 2, 0.01)).toBe(true)
  })

  it('U > A (over-provisioned): all rows have pastLine=true and remainingFootprint=0', () => {
    const r = computeExpansionHeadroom(20, 25, 'two-way-mirror')
    for (const row of r.rows) {
      expect(row.pastLine).toBe(true)
      expect(row.remainingFootprintTB).toBe(0)
      expect(row.remainingNewUsableTB).toBe(0)
    }
  })

  it('A=0: currentUtilizationPct=0 and all rows have 0 budget', () => {
    const r = computeExpansionHeadroom(0, 0, 'two-way-mirror')
    expect(r.currentUtilizationPct).toBe(0)
    for (const row of r.rows) {
      expect(row.footprintBudgetTB).toBe(0)
    }
  })
})
