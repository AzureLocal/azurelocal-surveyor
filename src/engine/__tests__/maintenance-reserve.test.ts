/**
 * Maintenance Reserve tests — WAF N+1/N+2 optional deduction
 *
 * Feature spec:
 *   nodeRawTB = capacityDriveSizeTB × capacityDrivesPerNode
 *   maintenanceReserveNodes = mode==='n+1' ? 1 : mode==='n+2' ? 2 : 0
 *   maintenanceReserveTB    = nodeRawTB × maintenanceReserveNodes
 *   availableBeforeMaintenanceTB = max(0, poolAfterMetaTB − reserveTB − infraVolumeTB)
 *   availableForVolumesTB        = max(0, availableBeforeMaintenanceTB − maintenanceReserveTB)
 *   effectiveUsableTB            = availableForVolumesTB × resiliencyFactor
 *
 * Tests:
 *   1. mode='none' → outputs byte-identical to baseline (no regression).
 *   2. 2-node 8×3.84 POC (4 drives/node):
 *        nodeRawTB = 4 × 3.84 = 15.36
 *        availableBeforeMaintenanceTB = 22.2328
 *        N+1: maintenanceReserveTB = 15.36, availableForVolumes = 6.8728, nodes = 1
 *        N+2: maintenanceReserveTB = 30.72, availableForVolumes = 0 (clamped), nodes = 2
 *   3. expansionHeadroom re-computes against reduced availableForVolumesTB when N+1 active.
 */

import { describe, it, expect } from 'vitest'
import {
  computeCapacity,
  computeExpansionHeadroom,
  DEFAULT_ADVANCED_SETTINGS,
  type HardwareInputs,
  type AdvancedSettings,
} from '../index'

// Tolerance for golden value assertions (±0.02 TB as specified)
const TOL = 0.02

function near(actual: number, expected: number, tol = TOL): boolean {
  return Math.abs(actual - expected) <= tol
}

// ─── Shared hardware: 2-node, 4 capacity drives/node, 3.84 TB each ──────────

const HW_2NODE_4DRIVE: HardwareInputs = {
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

// ─── 1. mode='none' is byte-identical to baseline ────────────────────────────

describe('maintenance-reserve mode=none — byte-identical baseline', () => {
  // Baseline: compute without the field set (backward compat — field optional)
  const baselineSettings: AdvancedSettings = {
    ...DEFAULT_ADVANCED_SETTINGS,
    defaultResiliency: 'two-way-mirror',
  }
  // Explicitly set mode to 'none'
  const noneSettings: AdvancedSettings = {
    ...baselineSettings,
    maintenanceReserveMode: 'none',
  }

  const baseline = computeCapacity(HW_2NODE_4DRIVE, baselineSettings)
  const withNone = computeCapacity(HW_2NODE_4DRIVE, noneSettings)

  it('rawPoolTB identical', () => {
    expect(withNone.rawPoolTB).toBe(baseline.rawPoolTB)
  })

  it('reserveTB identical', () => {
    expect(withNone.reserveTB).toBe(baseline.reserveTB)
  })

  it('availableBeforeMaintenanceTB = availableForVolumesTB when mode=none', () => {
    // When no maintenance reserve, pre-deduction equals post-deduction
    expect(withNone.availableBeforeMaintenanceTB).toBe(withNone.availableForVolumesTB)
  })

  it('availableForVolumesTB identical', () => {
    expect(withNone.availableForVolumesTB).toBe(baseline.availableForVolumesTB)
  })

  it('effectiveUsableTB identical', () => {
    expect(withNone.effectiveUsableTB).toBe(baseline.effectiveUsableTB)
  })

  it('maintenanceReserveTB = 0', () => {
    expect(withNone.maintenanceReserveTB).toBe(0)
  })

  it('maintenanceReserveNodes = 0', () => {
    expect(withNone.maintenanceReserveNodes).toBe(0)
  })

  // Also verify with undefined (field omitted entirely — backward compat)
  it('undefined maintenanceReserveMode treated as none', () => {
    const undefinedMode: AdvancedSettings = { ...baselineSettings }
    // Remove the field entirely
    delete undefinedMode.maintenanceReserveMode
    const result = computeCapacity(HW_2NODE_4DRIVE, undefinedMode)
    expect(result.maintenanceReserveTB).toBe(0)
    expect(result.availableForVolumesTB).toBe(baseline.availableForVolumesTB)
  })
})

// ─── 2. 2-node 4-drive N+1 scenario ──────────────────────────────────────────

describe('maintenance-reserve N+1 — 2-node 4×3.84 TB (nodeRawTB=15.36)', () => {
  const settings: AdvancedSettings = {
    ...DEFAULT_ADVANCED_SETTINGS,
    defaultResiliency: 'two-way-mirror',
    maintenanceReserveMode: 'n+1',
  }
  const result = computeCapacity(HW_2NODE_4DRIVE, settings)

  // Reference values (manual):
  //   rawPoolTB = 3.84 × 4 × 2 = 30.72
  //   poolAfterMeta = 30.72 × 0.99 = 30.4128
  //   reserveDrives = min(2,4) = 2  → reserveTB = 2 × 3.84 = 7.68
  //   infraVolumeTB = 0.25 / 0.5 = 0.5
  //   availableBeforeMaintenance = 30.4128 - 7.68 - 0.5 = 22.2328
  //   nodeRawTB = 3.84 × 4 = 15.36
  //   maintenanceReserveTB (N+1) = 15.36
  //   availableForVolumesTB = 22.2328 - 15.36 = 6.8728
  //   effectiveUsableTB (two-way, factor=0.5) = 6.8728 × 0.5 = 3.4364

  it('maintenanceReserveNodes = 1', () => {
    expect(result.maintenanceReserveNodes).toBe(1)
  })

  it('maintenanceReserveTB ≈ 15.36 (one node raw)', () => {
    expect(near(result.maintenanceReserveTB!, 15.36)).toBe(true)
  })

  it('availableBeforeMaintenanceTB ≈ 22.2328', () => {
    expect(near(result.availableBeforeMaintenanceTB!, 22.2328, 0.01)).toBe(true)
  })

  it('availableForVolumesTB ≈ 6.8728 (22.2328 − 15.36)', () => {
    expect(near(result.availableForVolumesTB, 6.8728, 0.01)).toBe(true)
  })

  it('effectiveUsableTB ≈ 3.4364 (6.8728 × 0.5)', () => {
    expect(near(result.effectiveUsableTB, 3.4364, 0.02)).toBe(true)
  })

  it('rawPoolTB unchanged at 30.72', () => {
    expect(near(result.rawPoolTB, 30.72, 0.01)).toBe(true)
  })

  it('reserveTB unchanged at 7.68', () => {
    expect(near(result.reserveTB, 7.68, 0.01)).toBe(true)
  })
})

// ─── 3. 2-node 4-drive N+2 scenario ──────────────────────────────────────────

describe('maintenance-reserve N+2 — 2-node 4×3.84 TB (nodeRawTB=15.36, clamps to 0)', () => {
  const settings: AdvancedSettings = {
    ...DEFAULT_ADVANCED_SETTINGS,
    defaultResiliency: 'two-way-mirror',
    maintenanceReserveMode: 'n+2',
  }
  const result = computeCapacity(HW_2NODE_4DRIVE, settings)

  // Reference values:
  //   availableBeforeMaintenance = 22.2328
  //   maintenanceReserveTB (N+2) = 15.36 × 2 = 30.72
  //   availableForVolumesTB = max(0, 22.2328 - 30.72) = 0  (clamped)
  //   effectiveUsableTB = 0 × 0.5 = 0

  it('maintenanceReserveNodes = 2', () => {
    expect(result.maintenanceReserveNodes).toBe(2)
  })

  it('maintenanceReserveTB ≈ 30.72 (two nodes raw)', () => {
    expect(near(result.maintenanceReserveTB!, 30.72)).toBe(true)
  })

  it('availableBeforeMaintenanceTB ≈ 22.2328', () => {
    expect(near(result.availableBeforeMaintenanceTB!, 22.2328, 0.01)).toBe(true)
  })

  it('availableForVolumesTB = 0 (clamped — reserve exceeds available)', () => {
    expect(result.availableForVolumesTB).toBe(0)
  })

  it('effectiveUsableTB = 0', () => {
    expect(result.effectiveUsableTB).toBe(0)
  })
})

// ─── 4. expansionHeadroom re-computes against reduced availableForVolumesTB ──

describe('maintenance-reserve N+1 — expansionHeadroom uses reduced availableForVolumesTB', () => {
  const baseSettings: AdvancedSettings = {
    ...DEFAULT_ADVANCED_SETTINGS,
    defaultResiliency: 'two-way-mirror',
  }
  const n1Settings: AdvancedSettings = {
    ...baseSettings,
    maintenanceReserveMode: 'n+1',
  }

  const baseResult   = computeCapacity(HW_2NODE_4DRIVE, baseSettings)
  const n1Result     = computeCapacity(HW_2NODE_4DRIVE, n1Settings)

  // Headroom with N+1 uses the reduced A (6.8728 TB)
  const baseHeadroom = computeExpansionHeadroom(baseResult.availableForVolumesTB, 0, 'two-way-mirror')
  const n1Headroom   = computeExpansionHeadroom(n1Result.availableForVolumesTB,   0, 'two-way-mirror')

  it('N+1 availableForVolumesTB is less than baseline', () => {
    expect(n1Result.availableForVolumesTB).toBeLessThan(baseResult.availableForVolumesTB)
  })

  it('N+1 headroom availableForVolumesTB ≈ 6.87 (reduced from ~22.23)', () => {
    expect(near(n1Headroom.availableForVolumesTB, 6.8728, 0.02)).toBe(true)
  })

  it('N+1 headroom 100% budget ≈ 6.87 TB (vs baseline 100% budget ≈ 22.23 TB)', () => {
    const n1Row100   = n1Headroom.rows.find((r) => r.targetFraction === 1.00)!
    const baseRow100 = baseHeadroom.rows.find((r) => r.targetFraction === 1.00)!
    expect(n1Row100.footprintBudgetTB).toBeLessThan(baseRow100.footprintBudgetTB)
    expect(near(n1Row100.footprintBudgetTB, 6.8728, 0.02)).toBe(true)
  })

  it('N+1 headroom 100% new usable ≈ 3.44 TB (6.87 / 2 copies)', () => {
    const n1Row100 = n1Headroom.rows.find((r) => r.targetFraction === 1.00)!
    // 6.8728 / 2 = 3.4364
    expect(near(n1Row100.remainingNewUsableTB, 3.44, 0.05)).toBe(true)
  })
})

// ─── 5. Larger cluster — N+1 does not over-restrict ──────────────────────────

describe('maintenance-reserve N+1 — 4-node 6×3.84 TB cluster (standard size)', () => {
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

  const baseSettings: AdvancedSettings = {
    ...DEFAULT_ADVANCED_SETTINGS,
    defaultResiliency: 'three-way-mirror',
  }
  const n1Settings: AdvancedSettings = {
    ...baseSettings,
    maintenanceReserveMode: 'n+1',
  }

  const baseResult = computeCapacity(hw, baseSettings)
  const n1Result   = computeCapacity(hw, n1Settings)

  // nodeRawTB = 3.84 × 6 = 23.04
  // N+1 deducts 23.04 from availableBeforeMaintenance

  it('maintenanceReserveTB ≈ 23.04 (one node, 6 drives × 3.84)', () => {
    expect(near(n1Result.maintenanceReserveTB!, 23.04, 0.01)).toBe(true)
  })

  it('availableForVolumesTB is reduced by 23.04 vs baseline', () => {
    const diff = baseResult.availableForVolumesTB - n1Result.availableForVolumesTB
    expect(near(diff, 23.04, 0.01)).toBe(true)
  })

  it('availableForVolumesTB > 0 (cluster large enough to absorb N+1)', () => {
    expect(n1Result.availableForVolumesTB).toBeGreaterThan(0)
  })

  it('effectiveUsableTB < baseline (but > 0)', () => {
    expect(n1Result.effectiveUsableTB).toBeGreaterThan(0)
    expect(n1Result.effectiveUsableTB).toBeLessThan(baseResult.effectiveUsableTB)
  })
})
