/**
 * Parity test suite — Phase 0 requirement.
 *
 * These 20 golden scenarios reproduce known-good values from the
 * S2D_Capacity_Calculator.xlsx (E:\git\azurelocal-toolkit\tools\planning\).
 * All numeric assertions use ±0.01 TB tolerance to account for floating-point.
 *
 * Run: pnpm test  (or npm test / yarn test)
 * All 20 must pass before UI work begins.
 *
 * TODO: As you extract golden values from the .xlsx, replace the `expected`
 *       numbers below with the actual cell values.  Current values are
 *       computed from first-principles math and must be validated against the
 *       workbook before the Phase 0 gate is considered closed.
 */

import { describe, it, expect } from 'vitest'
import {
  computeCapacity,
  DEFAULT_ADVANCED_SETTINGS,
  type HardwareInputs,
  type AdvancedSettings,
} from '../index'

const TOL = 0.01  // ±0.01 TB tolerance

function near(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= TOL
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
  // 1. 2-node all-NVMe (Dell AX-650 equivalent)
  //    6 × 3.84 TB × 2 nodes = 46.08 TB raw
  //    pool reserve = 3.84 TB → net = 42.24 TB
  //    2-way mirror (50%) → 21.12 TB × 0.92 = 19.43 TB effective
  scenario(
    '01 — 2-node, all-NVMe, 6×3.84TB',
    { nodeCount: 2, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256 },
    { defaultResiliency: '2-way-mirror' },
    { rawPoolTB: 46.08, effectiveUsableTB: 19.43 }
  )

  // 2. 4-node all-NVMe, 3-way mirror
  //    6 × 3.84 × 4 = 92.16 TB raw
  //    reserve = 3.84 → net = 88.32
  //    3-way (33.33%) → 29.44 × 0.92 = 27.0848 → round2 = 27.08 TB
  scenario(
    '02 — 4-node, all-NVMe, 6×3.84TB, 3-way mirror',
    { nodeCount: 4, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256 },
    { defaultResiliency: '3-way-mirror' },
    { rawPoolTB: 92.16, effectiveUsableTB: 27.08 }
  )

  // 3. 4-node all-NVMe, MAP
  //    net = 88.32, MAP (66.67%) → 58.88 × 0.92 = 54.17 TB
  scenario(
    '03 — 4-node, all-NVMe, 6×3.84TB, MAP',
    { nodeCount: 4, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256 },
    { defaultResiliency: 'mirror-accelerated-parity' },
    { rawPoolTB: 92.16, effectiveUsableTB: 54.17 }
  )

  // 4. 8-node all-NVMe, 3-way mirror
  //    6 × 3.84 × 8 = 184.32 raw; reserve = 3.84; net = 180.48
  //    3-way → 60.16 × 0.92 = 55.35 TB
  scenario(
    '04 — 8-node, all-NVMe, 6×3.84TB, 3-way mirror',
    { nodeCount: 8, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256 },
    { defaultResiliency: '3-way-mirror' },
    { rawPoolTB: 184.32, effectiveUsableTB: 55.35 }
  )

  // 5. 8-node all-NVMe, MAP
  //    net = 180.48; MAP → 120.32 × 0.92 = 110.69 TB
  scenario(
    '05 — 8-node, all-NVMe, 6×3.84TB, MAP',
    { nodeCount: 8, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256 },
    { defaultResiliency: 'mirror-accelerated-parity' },
    { rawPoolTB: 184.32, effectiveUsableTB: 110.69 }
  )

  // 6. 4-node NVMe cache + HDD capacity — DataON S2D-4112 equivalent
  //    8 × 14 TB × 4 nodes = 448 TB raw
  //    reserve = 14 TB; net = 434 TB
  //    3-way (33.33%) → 144.67 × 0.92 = 133.10 TB
  scenario(
    '06 — 4-node, NVMe+HDD, 8×14TB cap, 3-way mirror',
    { nodeCount: 4, capacityDrivesPerNode: 8, capacityDriveSizeTB: 14, cacheDrivesPerNode: 2, cacheDriveSizeTB: 1.6, cacheMediaType: 'nvme', capacityMediaType: 'hdd', coresPerNode: 20, memoryPerNodeGB: 128 },
    { defaultResiliency: '3-way-mirror' },
    { rawPoolTB: 448, effectiveUsableTB: 133.10 }
  )

  // 7. 4-node NVMe+HDD, MAP
  //    net = 434; MAP (66.67%) → 289.33 × 0.92 = 266.18 TB
  scenario(
    '07 — 4-node, NVMe+HDD, 8×14TB cap, MAP',
    { nodeCount: 4, capacityDrivesPerNode: 8, capacityDriveSizeTB: 14, cacheDrivesPerNode: 2, cacheDriveSizeTB: 1.6, cacheMediaType: 'nvme', capacityMediaType: 'hdd', coresPerNode: 20, memoryPerNodeGB: 128 },
    { defaultResiliency: 'mirror-accelerated-parity' },
    { rawPoolTB: 448, effectiveUsableTB: 266.18 }
  )

  // 8. 2-node, large drives (7.68 TB × 10 per node)
  //    153.6 raw; reserve 7.68; net 145.92; 2-way → 72.96 × 0.92 = 67.12 TB
  scenario(
    '08 — 2-node, all-NVMe, 10×7.68TB, 2-way mirror',
    { nodeCount: 2, capacityDrivesPerNode: 10, capacityDriveSizeTB: 7.68, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 48, memoryPerNodeGB: 512 },
    { defaultResiliency: '2-way-mirror' },
    { rawPoolTB: 153.6, effectiveUsableTB: 67.12 }
  )

  // 9. 16-node all-NVMe, 3-way mirror — max scale
  //    6 × 3.84 × 16 = 368.64 raw; reserve 3.84; net 364.8
  //    3-way → 121.6 × 0.92 = 111.87 TB
  scenario(
    '09 — 16-node, all-NVMe, 6×3.84TB, 3-way mirror',
    { nodeCount: 16, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256 },
    { defaultResiliency: '3-way-mirror' },
    { rawPoolTB: 368.64, effectiveUsableTB: 111.87 }
  )

  // 10. 16-node, MAP
  //    net = 364.8; MAP → 243.2 × 0.92 = 223.74 TB
  scenario(
    '10 — 16-node, all-NVMe, 6×3.84TB, MAP',
    { nodeCount: 16, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256 },
    { defaultResiliency: 'mirror-accelerated-parity' },
    { rawPoolTB: 368.64, effectiveUsableTB: 223.74 }
  )

  // 11. 3-node, all-NVMe, 3-way mirror
  //    6 × 3.84 × 3 = 69.12; reserve 3.84; net 65.28
  //    3-way → 21.76 × 0.92 = 20.02 TB
  scenario(
    '11 — 3-node, all-NVMe, 6×3.84TB, 3-way mirror',
    { nodeCount: 3, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256 },
    { defaultResiliency: '3-way-mirror' },
    { rawPoolTB: 69.12, effectiveUsableTB: 20.02 }
  )

  // 12. 4-node, 8×7.68TB all-NVMe, 3-way mirror
  //    8 × 7.68 × 4 = 245.76; reserve 7.68; net 238.08
  //    3-way → 79.36 × 0.92 = 73.01 TB
  scenario(
    '12 — 4-node, all-NVMe, 8×7.68TB, 3-way mirror',
    { nodeCount: 4, capacityDrivesPerNode: 8, capacityDriveSizeTB: 7.68, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 40, memoryPerNodeGB: 512 },
    { defaultResiliency: '3-way-mirror' },
    { rawPoolTB: 245.76, effectiveUsableTB: 73.01 }
  )

  // 13. 4-node, 8×7.68TB, MAP
  //    net 238.08; MAP → 158.72 × 0.92 = 146.02 TB
  scenario(
    '13 — 4-node, all-NVMe, 8×7.68TB, MAP',
    { nodeCount: 4, capacityDrivesPerNode: 8, capacityDriveSizeTB: 7.68, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 40, memoryPerNodeGB: 512 },
    { defaultResiliency: 'mirror-accelerated-parity' },
    { rawPoolTB: 245.76, effectiveUsableTB: 146.02 }
  )

  // 14. 2-node, 4×1.92TB, 2-way mirror — minimal entry node
  //    4 × 1.92 × 2 = 15.36; reserve 1.92; net 13.44
  //    2-way → 6.72 × 0.92 = 6.18 TB
  scenario(
    '14 — 2-node, all-NVMe, 4×1.92TB, 2-way mirror',
    { nodeCount: 2, capacityDrivesPerNode: 4, capacityDriveSizeTB: 1.92, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 16, memoryPerNodeGB: 128 },
    { defaultResiliency: '2-way-mirror' },
    { rawPoolTB: 15.36, effectiveUsableTB: 6.18 }
  )

  // 15. 6-node, 6×3.84TB, 3-way mirror
  //    138.24 raw; reserve 3.84; net 134.4
  //    3-way → 44.8 × 0.92 = 41.22 TB
  scenario(
    '15 — 6-node, all-NVMe, 6×3.84TB, 3-way mirror',
    { nodeCount: 6, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256 },
    { defaultResiliency: '3-way-mirror' },
    { rawPoolTB: 138.24, effectiveUsableTB: 41.22 }
  )

  // 16. 6-node, MAP
  //    net 134.4; MAP → 89.6 × 0.92 = 82.43 TB
  scenario(
    '16 — 6-node, all-NVMe, 6×3.84TB, MAP',
    { nodeCount: 6, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256 },
    { defaultResiliency: 'mirror-accelerated-parity' },
    { rawPoolTB: 138.24, effectiveUsableTB: 82.43 }
  )

  // 17. 4-node, custom efficiency factor 0.85 (customer override)
  //    6 × 3.84 × 4 = 92.16; reserve 3.84; net 88.32
  //    3-way → 29.44 × 0.85 = 25.02 TB
  scenario(
    '17 — 4-node, 6×3.84TB, 3-way, efficiency 0.85',
    { nodeCount: 4, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256 },
    { defaultResiliency: '3-way-mirror', capacityEfficiencyFactor: 0.85 },
    { rawPoolTB: 92.16, effectiveUsableTB: 25.02 }
  )

  // 18. 4-node, 2 pool-reserve drives (customer override)
  //    raw 92.16; reserve = 3.84×2 = 7.68; net 84.48
  //    3-way → 28.16 × 0.92 = 25.91 TB
  scenario(
    '18 — 4-node, 6×3.84TB, 3-way, 2 reserve drives',
    { nodeCount: 4, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256 },
    { defaultResiliency: '3-way-mirror', poolReserveDrives: 2 },
    { rawPoolTB: 92.16, effectiveUsableTB: 25.91 }
  )

  // 19. 8-node, 12×3.84TB per node (DataON S2D-5212 scale), MAP
  //    12 × 3.84 × 8 = 368.64; reserve 3.84; net 364.8
  //    MAP → 243.2 × 0.92 = 223.74 TB
  scenario(
    '19 — 8-node, 12×3.84TB, MAP (DataON high-density)',
    { nodeCount: 8, capacityDrivesPerNode: 12, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 24, memoryPerNodeGB: 192 },
    { defaultResiliency: 'mirror-accelerated-parity' },
    { rawPoolTB: 368.64, effectiveUsableTB: 223.74 }
  )

  // 20. 4-node, 10×7.68TB, MAP — largest common single-rack scenario
  //    10 × 7.68 × 4 = 307.2; reserve 7.68; net 299.52
  //    MAP → 199.68 × 0.92 = 183.71 TB
  scenario(
    '20 — 4-node, 10×7.68TB, MAP',
    { nodeCount: 4, capacityDrivesPerNode: 10, capacityDriveSizeTB: 7.68, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 48, memoryPerNodeGB: 512 },
    { defaultResiliency: 'mirror-accelerated-parity' },
    { rawPoolTB: 307.2, effectiveUsableTB: 183.71 }
  )
})
