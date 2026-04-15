/**
 * Parity test suite — 20 golden scenarios.
 *
 * All values computed from the correct Excel formula chain:
 *   usablePerDrive = driveSizeTB × efficiencyFactor           (per drive, not pool)
 *   totalUsable    = usablePerDrive × drivesPerNode × nodes
 *   reserve        = min(nodes, 4) × usablePerDrive           (S2D formula)
 *   infraFootprint = infraVolumeSizeTB / resiliencyFactor     (0.25 TB logical / factor)
 *   available      = totalUsable − reserve − infraFootprint   (pool space for volumes)
 *   effectiveUsable= available × resiliencyFactor             (planning number)
 *
 * Dual Parity efficiency is node-count dependent:
 *   4–6 nodes → 0.5, 7–8 nodes → 0.667, 9–15 nodes → 0.75, 16 nodes → 0.8
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

describe('Capacity parity — 20 golden scenarios', () => {
  // ── Scenario 01: 2-node, all-NVMe, 6×3.84TB, two-way mirror ──
  // usablePerDrive=3.5328, totalUsable=42.3936, reserve=min(2,4)×3.5328=7.0656
  // infraFootprint=0.25/0.5=0.5, available=34.828, effective=34.828×0.5=17.414
  scenario('01 — 2-node, 6×3.84TB, two-way mirror',
    { ...BASE_HW, nodeCount: 2 },
    { defaultResiliency: 'two-way-mirror' },
    { rawPoolTB: 46.08, effectiveUsableTB: 17.41 }
  )

  // ── Scenario 02: 4-node, all-NVMe, 6×3.84TB, three-way mirror ──
  // usablePerDrive=3.5328, totalUsable=84.7872, reserve=4×3.5328=14.1312
  // infraFootprint=0.25/(1/3)=0.75, available=69.906, effective=69.906×(1/3)=23.302
  scenario('02 — 4-node, 6×3.84TB, three-way mirror',
    { ...BASE_HW },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 92.16, effectiveUsableTB: 23.30 }
  )

  // ── Scenario 03: 4-node, all-NVMe, 6×3.84TB, dual-parity (4–6 nodes → 50%) ──
  // infraFootprint=0.25/0.5=0.5, available=70.156, effective=70.156×0.5=35.078
  scenario('03 — 4-node, 6×3.84TB, dual-parity (50%)',
    { ...BASE_HW },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 92.16, effectiveUsableTB: 35.08 }
  )

  // ── Scenario 04: 8-node, all-NVMe, 6×3.84TB, three-way mirror ──
  // totalUsable=169.5744, reserve=min(8,4)×3.5328=14.1312
  // infraFootprint=0.75, available=154.6932, effective=154.6932/3=51.564
  scenario('04 — 8-node, 6×3.84TB, three-way mirror',
    { ...BASE_HW, nodeCount: 8 },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 184.32, effectiveUsableTB: 51.56 }
  )

  // ── Scenario 05: 8-node, all-NVMe, 6×3.84TB, dual-parity (7–8 nodes → 66.7%) ──
  // infraFootprint=0.25/0.667=0.375, available=155.068, effective=155.068×0.667=103.38
  scenario('05 — 8-node, 6×3.84TB, dual-parity (66.7%)',
    { ...BASE_HW, nodeCount: 8 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 184.32, effectiveUsableTB: 103.38 }
  )

  // ── Scenario 06: 4-node, NVMe+HDD, 8×14TB, three-way mirror ──
  // usablePerDrive=14×0.92=12.88, totalUsable=12.88×8×4=412.16
  // reserve=4×12.88=51.52, infraFootprint=0.75, available=359.89, effective/3=119.96
  scenario('06 — 4-node, NVMe+HDD, 8×14TB, three-way mirror',
    { ...BASE_HW, capacityDrivesPerNode: 8, capacityDriveSizeTB: 14, cacheDrivesPerNode: 2, cacheDriveSizeTB: 1.6, cacheMediaType: 'nvme', capacityMediaType: 'hdd', coresPerNode: 20, memoryPerNodeGB: 128 },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 448, effectiveUsableTB: 119.96 }
  )

  // ── Scenario 07: 4-node, NVMe+HDD, 8×14TB, dual-parity (4–6 nodes → 50%) ──
  // infraFootprint=0.5, available=360.14, effective=180.07
  scenario('07 — 4-node, NVMe+HDD, 8×14TB, dual-parity (50%)',
    { ...BASE_HW, capacityDrivesPerNode: 8, capacityDriveSizeTB: 14, cacheDrivesPerNode: 2, cacheDriveSizeTB: 1.6, cacheMediaType: 'nvme', capacityMediaType: 'hdd', coresPerNode: 20, memoryPerNodeGB: 128 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 448, effectiveUsableTB: 180.07 }
  )

  // ── Scenario 08: 2-node, all-NVMe, 10×7.68TB, two-way mirror ──
  // usablePerDrive=7.0656, totalUsable=141.312, reserve=min(2,4)×7.0656=14.1312
  // infraFootprint=0.5, available=126.681, effective=63.34
  scenario('08 — 2-node, 10×7.68TB, two-way mirror',
    { ...BASE_HW, nodeCount: 2, capacityDrivesPerNode: 10, capacityDriveSizeTB: 7.68, coresPerNode: 48, memoryPerNodeGB: 512 },
    { defaultResiliency: 'two-way-mirror' },
    { rawPoolTB: 153.6, effectiveUsableTB: 63.34 }
  )

  // ── Scenario 09: 16-node, all-NVMe, 6×3.84TB, three-way mirror ──
  // totalUsable=339.1488, reserve=min(16,4)×3.5328=14.1312
  // infraFootprint=0.75, available=324.268, effective/3=108.09
  scenario('09 — 16-node, 6×3.84TB, three-way mirror',
    { ...BASE_HW, nodeCount: 16 },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 368.64, effectiveUsableTB: 108.09 }
  )

  // ── Scenario 10: 16-node, all-NVMe, 6×3.84TB, dual-parity (16 nodes → 80%) ──
  // infraFootprint=0.25/0.8=0.3125, available=324.705, effective=324.705×0.8=259.77
  scenario('10 — 16-node, 6×3.84TB, dual-parity (80%)',
    { ...BASE_HW, nodeCount: 16 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 368.64, effectiveUsableTB: 259.76 }
  )

  // ── Scenario 11: 3-node, all-NVMe, 6×3.84TB, three-way mirror ──
  // totalUsable=63.5904, reserve=min(3,4)×3.5328=10.5984
  // infraFootprint=0.75, available=52.242, effective/3=17.414
  scenario('11 — 3-node, 6×3.84TB, three-way mirror',
    { ...BASE_HW, nodeCount: 3 },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 69.12, effectiveUsableTB: 17.41 }
  )

  // ── Scenario 12: 4-node, all-NVMe, 8×7.68TB, three-way mirror ──
  // usablePerDrive=7.0656, totalUsable=226.0992, reserve=4×7.0656=28.2624
  // infraFootprint=0.75, available=197.087, effective/3=65.70
  scenario('12 — 4-node, 8×7.68TB, three-way mirror',
    { ...BASE_HW, capacityDrivesPerNode: 8, capacityDriveSizeTB: 7.68, coresPerNode: 40, memoryPerNodeGB: 512 },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 245.76, effectiveUsableTB: 65.70 }
  )

  // ── Scenario 13: 4-node, all-NVMe, 8×7.68TB, dual-parity (4–6 nodes → 50%) ──
  // infraFootprint=0.5, available=197.337, effective=98.67
  scenario('13 — 4-node, 8×7.68TB, dual-parity (50%)',
    { ...BASE_HW, capacityDrivesPerNode: 8, capacityDriveSizeTB: 7.68, coresPerNode: 40, memoryPerNodeGB: 512 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 245.76, effectiveUsableTB: 98.67 }
  )

  // ── Scenario 14: 2-node, all-NVMe, 4×1.92TB, two-way mirror ──
  // usablePerDrive=1.7664, totalUsable=14.1312, reserve=min(2,4)×1.7664=3.5328
  // infraFootprint=0.5, available=10.098, effective=5.05
  scenario('14 — 2-node, 4×1.92TB, two-way mirror',
    { ...BASE_HW, nodeCount: 2, capacityDrivesPerNode: 4, capacityDriveSizeTB: 1.92, coresPerNode: 16, memoryPerNodeGB: 128 },
    { defaultResiliency: 'two-way-mirror' },
    { rawPoolTB: 15.36, effectiveUsableTB: 5.05 }
  )

  // ── Scenario 15: 6-node, all-NVMe, 6×3.84TB, three-way mirror ──
  // totalUsable=127.1808, reserve=min(6,4)×3.5328=14.1312
  // infraFootprint=0.75, available=112.30, effective/3=37.43
  scenario('15 — 6-node, 6×3.84TB, three-way mirror',
    { ...BASE_HW, nodeCount: 6 },
    { defaultResiliency: 'three-way-mirror' },
    { rawPoolTB: 138.24, effectiveUsableTB: 37.43 }
  )

  // ── Scenario 16: 6-node, all-NVMe, 6×3.84TB, dual-parity (4–6 nodes → 50%) ──
  // infraFootprint=0.5, available=112.55, effective=56.27
  scenario('16 — 6-node, 6×3.84TB, dual-parity (50%)',
    { ...BASE_HW, nodeCount: 6 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 138.24, effectiveUsableTB: 56.27 }
  )

  // ── Scenario 17: 4-node, 6×3.84TB, three-way mirror, efficiency=0.85 ──
  // usablePerDrive=3.84×0.85=3.264, totalUsable=78.336, reserve=4×3.264=13.056
  // infraFootprint=0.75, available=64.53, effective/3=21.51
  scenario('17 — 4-node, 6×3.84TB, three-way, efficiency 0.85',
    { ...BASE_HW },
    { defaultResiliency: 'three-way-mirror', capacityEfficiencyFactor: 0.85 },
    { rawPoolTB: 92.16, effectiveUsableTB: 21.51 }
  )

  // ── Scenario 18: 4-node, 6×3.84TB, nested-two-way (25%) ──
  // infraFootprint=0.25/0.25=1.0, available=69.656, effective=17.41
  scenario('18 — 4-node, 6×3.84TB, nested-two-way (25%)',
    { ...BASE_HW },
    { defaultResiliency: 'nested-two-way' },
    { rawPoolTB: 92.16, effectiveUsableTB: 17.41 }
  )

  // ── Scenario 19: 8-node, 12×3.84TB (DataON high-density), dual-parity (7–8 → 66.7%) ──
  // usablePerDrive=3.5328, totalUsable=339.1488, reserve=4×3.5328=14.1312
  // infraFootprint=0.25/0.667=0.375, available=324.642, effective×0.667=216.43
  scenario('19 — 8-node, 12×3.84TB, dual-parity (DataON 66.7%)',
    { ...BASE_HW, nodeCount: 8, capacityDrivesPerNode: 12, coresPerNode: 24, memoryPerNodeGB: 192 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 368.64, effectiveUsableTB: 216.43 }
  )

  // ── Scenario 20: 4-node, 10×7.68TB, dual-parity (4–6 → 50%) ──
  // usablePerDrive=7.0656, totalUsable=282.624, reserve=4×7.0656=28.2624
  // infraFootprint=0.5, available=253.862, effective=126.93
  scenario('20 — 4-node, 10×7.68TB, dual-parity (50%)',
    { ...BASE_HW, capacityDrivesPerNode: 10, capacityDriveSizeTB: 7.68, coresPerNode: 48, memoryPerNodeGB: 512 },
    { defaultResiliency: 'dual-parity' },
    { rawPoolTB: 307.2, effectiveUsableTB: 126.93 }
  )
})
