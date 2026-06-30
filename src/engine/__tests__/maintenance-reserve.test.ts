/**
 * WAF N+1/N+2 — Compute resiliency, not storage
 *
 * KEY INVARIANT (2.6.0 correction):
 *   Per Microsoft WAF, N+1/N+2 is a COMPUTE resiliency concept (CPU + memory headroom
 *   so nodes can be drained for updates or survive a node loss without dropping VMs).
 *   It does NOT reduce storage capacity.
 *
 *   Therefore: availableForVolumesTB must be INVARIANT to maintenanceReserveMode.
 *   The only MS-documented storage reserves are:
 *     - Per-drive rebuild reserve: min(nodeCount, 4) drives
 *     - Volume footprints must fit within availableForVolumesTB (HC_OVER_CAPACITY)
 *
 * Compute N+1/N+2 formulas:
 *   nodesN1 = max(0, nodeCount - 1)
 *   usableVCpusN1 = max(0, logicalCoresPerNode × nodesN1 × oversubRatio - sysReserved × nodesN1)
 *   usableMemoryGBN1 = max(0, memPerNode × nodesN1 - sysReservedMem × nodesN1)
 *   nodesN2 = max(0, nodeCount - 2)
 *   usableVCpusN2 = max(0, logicalCoresPerNode × nodesN2 × oversubRatio - sysReserved × nodesN2)
 *   usableMemoryGBN2 = max(0, memPerNode × nodesN2 - sysReservedMem × nodesN2)
 */

import { describe, it, expect } from 'vitest'
import {
  computeCapacity,
  DEFAULT_ADVANCED_SETTINGS,
  type HardwareInputs,
  type AdvancedSettings,
} from '../index'
import { computeCompute } from '../compute'

// Tolerance for numeric assertions
const TOL = 0.02

function near(actual: number, expected: number, tol = TOL): boolean {
  return Math.abs(actual - expected) <= tol
}

// ─── Shared hardware fixtures ─────────────────────────────────────────────────

const HW_2NODE: HardwareInputs = {
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

const HW_4NODE: HardwareInputs = {
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

const HW_8NODE: HardwareInputs = {
  nodeCount: 8,
  capacityDrivesPerNode: 4,
  capacityDriveSizeTB: 7.68,
  cacheDrivesPerNode: 0,
  cacheDriveSizeTB: 0,
  cacheMediaType: 'none',
  capacityMediaType: 'nvme',
  coresPerNode: 24,
  memoryPerNodeGB: 384,
  hyperthreadingEnabled: true,
}

// ─── 1. INVARIANT: availableForVolumesTB does NOT change with mode ────────────

describe('maintenance-reserve: availableForVolumesTB is invariant to mode', () => {
  const baseSettings: AdvancedSettings = {
    ...DEFAULT_ADVANCED_SETTINGS,
    defaultResiliency: 'two-way-mirror',
    maintenanceReserveMode: 'none',
  }
  const n1Settings: AdvancedSettings = { ...baseSettings, maintenanceReserveMode: 'n+1' }
  const n2Settings: AdvancedSettings = { ...baseSettings, maintenanceReserveMode: 'n+2' }

  const none2 = computeCapacity(HW_2NODE, baseSettings)
  const n1_2  = computeCapacity(HW_2NODE, n1Settings)
  const n2_2  = computeCapacity(HW_2NODE, n2Settings)

  it('2-node: mode=n+1 does NOT reduce availableForVolumesTB', () => {
    expect(n1_2.availableForVolumesTB).toBe(none2.availableForVolumesTB)
  })

  it('2-node: mode=n+2 does NOT reduce availableForVolumesTB', () => {
    expect(n2_2.availableForVolumesTB).toBe(none2.availableForVolumesTB)
  })

  const base4Settings: AdvancedSettings = { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'three-way-mirror', maintenanceReserveMode: 'none' }
  const none4 = computeCapacity(HW_4NODE, base4Settings)
  const n1_4  = computeCapacity(HW_4NODE, { ...base4Settings, maintenanceReserveMode: 'n+1' })
  const n2_4  = computeCapacity(HW_4NODE, { ...base4Settings, maintenanceReserveMode: 'n+2' })

  it('4-node: mode=n+1 does NOT reduce availableForVolumesTB', () => {
    expect(n1_4.availableForVolumesTB).toBe(none4.availableForVolumesTB)
  })

  it('4-node: mode=n+2 does NOT reduce availableForVolumesTB', () => {
    expect(n2_4.availableForVolumesTB).toBe(none4.availableForVolumesTB)
  })

  const none8 = computeCapacity(HW_8NODE, baseSettings)
  const n1_8  = computeCapacity(HW_8NODE, n1Settings)
  const n2_8  = computeCapacity(HW_8NODE, n2Settings)

  it('8-node: mode=n+1 does NOT reduce availableForVolumesTB', () => {
    expect(n1_8.availableForVolumesTB).toBe(none8.availableForVolumesTB)
  })

  it('8-node: mode=n+2 does NOT reduce availableForVolumesTB', () => {
    expect(n2_8.availableForVolumesTB).toBe(none8.availableForVolumesTB)
  })
})

// ─── 2. INVARIANT: effectiveUsableTB does NOT change with mode ───────────────

describe('maintenance-reserve: effectiveUsableTB is invariant to mode', () => {
  const base: AdvancedSettings = {
    ...DEFAULT_ADVANCED_SETTINGS,
    defaultResiliency: 'two-way-mirror',
    maintenanceReserveMode: 'none',
  }

  const none = computeCapacity(HW_4NODE, { ...base, defaultResiliency: 'three-way-mirror' })
  const n1   = computeCapacity(HW_4NODE, { ...base, defaultResiliency: 'three-way-mirror', maintenanceReserveMode: 'n+1' })
  const n2   = computeCapacity(HW_4NODE, { ...base, defaultResiliency: 'three-way-mirror', maintenanceReserveMode: 'n+2' })

  it('effectiveUsableTB same for none vs n+1', () => {
    expect(n1.effectiveUsableTB).toBe(none.effectiveUsableTB)
  })

  it('effectiveUsableTB same for none vs n+2', () => {
    expect(n2.effectiveUsableTB).toBe(none.effectiveUsableTB)
  })
})

// ─── 3. Compute N+1 values ────────────────────────────────────────────────────

describe('compute.ts: N+1 compute fields — 4-node 32c/256GB HT enabled', () => {
  const settings: AdvancedSettings = {
    ...DEFAULT_ADVANCED_SETTINGS,
    defaultResiliency: 'three-way-mirror',
  }
  const result = computeCompute(HW_4NODE, settings)

  // With HT: logicalCoresPerNode = 32 × 2 = 64
  // vCpuOversubscriptionRatio = 4 (DEFAULT)
  // systemReservedVCpus = 4/node (DEFAULT)
  // nodesN1 = max(0, 4-1) = 3
  // usableVCpusN1 = max(0, 64 × 3 × 4 - 4 × 3) = max(0, 768 - 12) = 756
  // systemReservedMemoryGB = 8/node (DEFAULT)
  // usableMemoryGBN1 = max(0, 256 × 3 - 8 × 3) = max(0, 768 - 24) = 744

  it('usableVCpusN1 ≈ 756 (3 nodes, 64 lCPU/node × 4 oversub, 4 reserved/node)', () => {
    expect(near(result.usableVCpusN1, 756, 2)).toBe(true)
  })

  it('usableMemoryGBN1 ≈ 744 GB (3 nodes, 256 GB/node, 8 reserved/node)', () => {
    expect(near(result.usableMemoryGBN1, 744, 5)).toBe(true)
  })
})

// ─── 4. Compute N+2 values ────────────────────────────────────────────────────

describe('compute.ts: N+2 compute fields — 4-node 32c/256GB HT enabled', () => {
  const settings: AdvancedSettings = {
    ...DEFAULT_ADVANCED_SETTINGS,
    defaultResiliency: 'three-way-mirror',
  }
  const result = computeCompute(HW_4NODE, settings)

  // nodesN2 = max(0, 4-2) = 2
  // usableVCpusN2 = max(0, 64 × 2 × 4 - 4 × 2) = max(0, 512 - 8) = 504
  // usableMemoryGBN2 = max(0, 256 × 2 - 8 × 2) = max(0, 512 - 16) = 496

  it('usableVCpusN2 ≈ 504 (2 nodes, 64 lCPU/node × 4 oversub, 4 reserved/node)', () => {
    expect(near(result.usableVCpusN2, 504, 2)).toBe(true)
  })

  it('usableMemoryGBN2 ≈ 496 GB (2 nodes, 256 GB/node, 8 reserved/node)', () => {
    expect(near(result.usableMemoryGBN2, 496, 5)).toBe(true)
  })
})

// ─── 5. Edge case: 2-node N+2 compute → 0 (can't go below 0 active nodes) ───

describe('compute.ts: N+2 on 2-node cluster → 0 (floor at 0 active nodes)', () => {
  const settings: AdvancedSettings = {
    ...DEFAULT_ADVANCED_SETTINGS,
    defaultResiliency: 'two-way-mirror',
  }
  const result = computeCompute(HW_2NODE, settings)

  // nodesN2 = max(0, 2-2) = 0
  // usableVCpusN2 = 0, usableMemoryGBN2 = 0

  it('usableVCpusN2 = 0 on 2-node cluster', () => {
    expect(result.usableVCpusN2).toBe(0)
  })

  it('usableMemoryGBN2 = 0 on 2-node cluster', () => {
    expect(result.usableMemoryGBN2).toBe(0)
  })

  it('usableVCpusN1 > 0 on 2-node cluster', () => {
    expect(result.usableVCpusN1).toBeGreaterThan(0)
  })
})

// ─── 6. 1-node cluster: both N+1 and N+2 → 0 ────────────────────────────────

describe('compute.ts: 1-node cluster — both N+1 and N+2 floor to 0', () => {
  const hw1: HardwareInputs = { ...HW_2NODE, nodeCount: 1 }
  const settings: AdvancedSettings = { ...DEFAULT_ADVANCED_SETTINGS, defaultResiliency: 'two-way-mirror' }
  const result = computeCompute(hw1, settings)

  it('usableVCpusN1 = 0 (1 node − 1 = 0 active)', () => {
    expect(result.usableVCpusN1).toBe(0)
  })

  it('usableVCpusN2 = 0 (1 node − 2 clamped to 0)', () => {
    expect(result.usableVCpusN2).toBe(0)
  })

  it('usableMemoryGBN1 = 0', () => {
    expect(result.usableMemoryGBN1).toBe(0)
  })

  it('usableMemoryGBN2 = 0', () => {
    expect(result.usableMemoryGBN2).toBe(0)
  })
})

// ─── 7. N+2 strictly ≤ N+1 (always) ─────────────────────────────────────────

describe('compute.ts: usableVCpusN2 ≤ usableVCpusN1 for any node count', () => {
  const settings: AdvancedSettings = { ...DEFAULT_ADVANCED_SETTINGS }

  it('8-node: N+2 < N+1 vCPUs', () => {
    const r = computeCompute(HW_8NODE, settings)
    expect(r.usableVCpusN2).toBeLessThan(r.usableVCpusN1)
  })

  it('4-node: N+2 < N+1 vCPUs', () => {
    const r = computeCompute(HW_4NODE, settings)
    expect(r.usableVCpusN2).toBeLessThan(r.usableVCpusN1)
  })

  it('2-node: N+2 = 0 ≤ N+1', () => {
    const r = computeCompute(HW_2NODE, settings)
    expect(r.usableVCpusN2).toBeLessThanOrEqual(r.usableVCpusN1)
    expect(r.usableVCpusN2).toBe(0)
  })
})

// ─── 8. undefined/none mode: backward compat — storage unchanged ──────────────

describe('maintenance-reserve: undefined mode treated as none (backward compat)', () => {
  const settingsWithUndefined: AdvancedSettings = {
    ...DEFAULT_ADVANCED_SETTINGS,
    defaultResiliency: 'two-way-mirror',
  }
  // Remove the field entirely to test pre-2.5.0 state objects
  delete settingsWithUndefined.maintenanceReserveMode

  const settingsWithNone: AdvancedSettings = {
    ...DEFAULT_ADVANCED_SETTINGS,
    defaultResiliency: 'two-way-mirror',
    maintenanceReserveMode: 'none',
  }

  const undefinedResult = computeCapacity(HW_4NODE, settingsWithUndefined)
  const noneResult      = computeCapacity(HW_4NODE, settingsWithNone)

  it('availableForVolumesTB identical', () => {
    expect(undefinedResult.availableForVolumesTB).toBe(noneResult.availableForVolumesTB)
  })

  it('effectiveUsableTB identical', () => {
    expect(undefinedResult.effectiveUsableTB).toBe(noneResult.effectiveUsableTB)
  })
})
