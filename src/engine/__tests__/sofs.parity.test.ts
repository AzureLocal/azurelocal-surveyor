/**
 * SOFS parity test suite — 8 golden scenarios.
 *
 * Formula chain from sofs.ts:
 *   totalProfileStorageTB = userCount × profileSizeGB / 1024
 *   totalRedirectedStorageTB = userCount × redirectedFolderSizeGB / 1024
 *   totalStorageTB = profile + redirected
 *   internalMirrorFactor: simple=1, two-way=2, three-way=3
 *   internalFootprintTB = totalStorageTB × internalMirrorFactor
 *
 * IOPS (FSLogix sizing guidance):
 *   steadyStateIopsPerUser = 10
 *   loginStormIopsPerUser  = 50
 *   sizingUsers = concurrentUsers > 0 ? concurrentUsers : userCount
 *
 * Auto-size:
 *   autoSizeDriveSizeTB = internalFootprintTB / (drivesPerNode × nodes)
 *
 * Tolerance: ±0.02 TB for storage values.
 */

import { describe, it, expect } from 'vitest'
import { computeSofs } from '../sofs'
import type { SofsInputs } from '../types'

const TOL = 0.02

function near(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= TOL
}

const BASE_SOFS: SofsInputs = {
  userCount: 500,
  concurrentUsers: 0,
  profileSizeGB: 40,
  redirectedFolderSizeGB: 0,
  containerType: 'split',
  sofsGuestVmCount: 2,
  sofsVCpusPerVm: 4,
  sofsMemoryPerVmGB: 16,
  internalMirror: 'three-way',
  autoSizeDrivesPerNode: 0,
  autoSizeNodes: 0,
}

describe('SOFS parity — 8 golden scenarios', () => {
  // ── Scenario 01: 500 users, 40 GB profile, three-way internal mirror ──
  // profile = 500×40/1024 = 19.53 TB
  // internalFootprint = 19.53 × 3 = 58.59 TB
  // sofsVCpusTotal = 2×4 = 8, sofsMemoryTotalGB = 2×16 = 32
  it('01 — 500 users, 40 GB profile, three-way internal mirror', () => {
    const r = computeSofs(BASE_SOFS)
    expect(near(r.totalProfileStorageTB, 19.53)).toBe(true)
    expect(r.internalMirrorFactor).toBe(3)
    expect(near(r.internalFootprintTB, 58.59)).toBe(true)
    expect(r.sofsVCpusTotal).toBe(8)
    expect(r.sofsMemoryTotalGB).toBe(32)
  })

  // ── Scenario 02: 500 users, 40 GB profile, two-way internal mirror ──
  // internalFootprint = 19.53 × 2 = 39.06 TB
  it('02 — 500 users, 40 GB profile, two-way internal mirror', () => {
    const r = computeSofs({ ...BASE_SOFS, internalMirror: 'two-way' })
    expect(r.internalMirrorFactor).toBe(2)
    expect(near(r.internalFootprintTB, 39.06)).toBe(true)
  })

  // ── Scenario 03: 500 users, simple mirror (no compounding) ──
  // internalFootprint = 19.53 × 1 = 19.53 TB
  it('03 — 500 users, simple mirror (factor = 1)', () => {
    const r = computeSofs({ ...BASE_SOFS, internalMirror: 'simple' })
    expect(r.internalMirrorFactor).toBe(1)
    expect(near(r.internalFootprintTB, r.totalStorageTB)).toBe(true)
  })

  // ── Scenario 04: sofsProfileDemandTb override ──
  // Override takes precedence over userCount × profileSizeGB formula
  it('04 — sofsProfileDemandTb override = 10 TB', () => {
    const r = computeSofs(BASE_SOFS, { sofsProfileDemandTb: 10 })
    expect(r.totalProfileStorageTB).toBe(10)
    expect(near(r.internalFootprintTB, 30)).toBe(true)  // 10 × 3
  })

  // ── Scenario 05: IOPS — 200 concurrent users ──
  // sizingUsers = 200 (concurrentUsers > 0)
  // totalSteadyStateIops = 200×10 = 2000
  // totalLoginStormIops  = 200×50 = 10000
  it('05 — IOPS with 200 concurrent users', () => {
    const r = computeSofs({ ...BASE_SOFS, concurrentUsers: 200 })
    expect(r.totalSteadyStateIops).toBe(2000)
    expect(r.totalLoginStormIops).toBe(10000)
    expect(r.steadyStateIopsPerUser).toBe(10)
    expect(r.loginStormIopsPerUser).toBe(50)
  })

  // ── Scenario 06: IOPS — no concurrent users set, falls back to userCount ──
  // sizingUsers = 500
  // totalSteadyStateIops = 500×10 = 5000
  it('06 — IOPS fallback to userCount when concurrentUsers = 0', () => {
    const r = computeSofs({ ...BASE_SOFS, concurrentUsers: 0 })
    expect(r.totalSteadyStateIops).toBe(5000)
    expect(r.totalLoginStormIops).toBe(25000)
  })

  // ── Scenario 07: Auto-size drive calculation ──
  // internalFootprint = 19.53×3 = 58.59 TB
  // totalDrives = 4 drives/node × 2 nodes = 8
  // autoSizeDriveSizeTB = 58.59 / 8 = 7.32 TB
  it('07 — auto-size: 4 drives/node, 2 nodes → required drive size', () => {
    const r = computeSofs({ ...BASE_SOFS, autoSizeDrivesPerNode: 4, autoSizeNodes: 2 })
    expect(near(r.autoSizeDriveSizeTB, 7.32)).toBe(true)
  })

  // ── Scenario 08: Redirected folder storage adds to total ──
  // profile = 500×40/1024 = 19.53 TB
  // redirected = 500×5/1024 = 2.44 TB
  // totalStorage = 21.97 TB, internalFootprint (3×) = 65.92 TB
  it('08 — 500 users, 5 GB redirected folders, three-way mirror', () => {
    const r = computeSofs({ ...BASE_SOFS, redirectedFolderSizeGB: 5 })
    expect(near(r.totalRedirectedStorageTB, 2.44)).toBe(true)
    expect(near(r.totalStorageTB, 21.97)).toBe(true)
    expect(near(r.internalFootprintTB, 65.92)).toBe(true)
  })
})
