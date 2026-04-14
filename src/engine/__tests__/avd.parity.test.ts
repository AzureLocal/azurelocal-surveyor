/**
 * AVD parity test suite — 12 golden scenarios.
 *
 * All expected values computed from the HOST_PROFILES constants in avd.ts
 * and the formula chain documented in the AVD Planning sheet.
 *
 * Host profile constants (from avd.ts):
 *   light:  2 vCPU, 8 GB,  16 users/host (multi), 128 GB OS disk
 *   medium: 4 vCPU, 16 GB,  8 users/host (multi), 128 GB OS disk
 *   heavy:  8 vCPU, 32 GB,  4 users/host (multi), 128 GB OS disk
 *   power: 16 vCPU, 64 GB,  2 users/host (multi), 256 GB OS disk
 *   single-session: always 1 user/host for all types
 *
 * Storage formula:
 *   OS storage    = sessionHostCount × osDiskGB / 1024
 *   Profile       = totalUsers × profileSizeGB / 1024 × (1 + growthBufferPct/100)
 *   Office cont.  = totalUsers × officeContainerSizeGB / 1024 (when enabled)
 *   Data disk     = sessionHostCount × dataDiskPerHostGB / 1024
 *   totalStorage  = OS + profile + officeContainer + dataDisk
 *
 * Tolerance: ±0.02 TB for storage values.
 */

import { describe, it, expect } from 'vitest'
import { computeAvd } from '../avd'
import type { AvdInputs } from '../types'

const TOL = 0.02

function near(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= TOL
}

const BASE_AVD: AvdInputs = {
  totalUsers: 100,
  concurrentUsers: 0,
  workloadType: 'medium',
  multiSession: true,
  profileSizeGB: 40,
  userTypeMixEnabled: false,
  userTypeMix: { taskPct: 0, taskProfileGB: 15, knowledgePct: 0, knowledgeProfileGB: 40, powerPct: 0, powerProfileGB: 80 },
  growthBufferPct: 0,
  officeContainerEnabled: false,
  officeContainerSizeGB: 20,
  dataDiskPerHostGB: 0,
  profileStorageLocation: 's2d',
}

describe('AVD parity — 12 golden scenarios', () => {
  // ── Scenario 01: Light multi-session, 100 total users, no concurrent override ──
  // usersPerHost=16, sessionHostCount=ceil(100/16)=7
  // vCPUs=7×2=14, memory=7×8=56 GB
  // OS=7×128/1024=0.875 TB, profile=100×40/1024=3.91 TB, total≈4.79 TB
  it('01 — light multi-session, 100 users, no concurrent override', () => {
    const r = computeAvd({ ...BASE_AVD, workloadType: 'light', totalUsers: 100 })
    expect(r.sessionHostCount).toBe(7)
    expect(r.totalVCpus).toBe(14)
    expect(r.totalMemoryGB).toBe(56)
    expect(near(r.totalProfileStorageTB, 3.91)).toBe(true)
  })

  // ── Scenario 02: Light multi-session, 1000 total, 200 concurrent ──
  // sizingUsers=200, sessionHostCount=ceil(200/16)=13
  // profile still uses totalUsers=1000: 1000×40/1024=39.06 TB
  it('02 — light multi-session, 1000 total users, 200 concurrent', () => {
    const r = computeAvd({ ...BASE_AVD, workloadType: 'light', totalUsers: 1000, concurrentUsers: 200 })
    expect(r.sessionHostCount).toBe(13)
    expect(r.sizingUsers).toBe(200)
    expect(near(r.totalProfileStorageTB, 39.06)).toBe(true)
  })

  // ── Scenario 03: Medium multi-session, 500 users ──
  // usersPerHost=8, sessionHostCount=ceil(500/8)=63
  // vCPUs=63×4=252, memory=63×16=1008 GB
  // OS=63×128/1024=7.88 TB, profile=500×40/1024=19.53 TB
  it('03 — medium multi-session, 500 users', () => {
    const r = computeAvd({ ...BASE_AVD, workloadType: 'medium', totalUsers: 500 })
    expect(r.sessionHostCount).toBe(63)
    expect(r.totalVCpus).toBe(252)
    expect(r.totalMemoryGB).toBe(1008)
    expect(near(r.totalProfileStorageTB, 19.53)).toBe(true)
  })

  // ── Scenario 04: Medium multi-session, 500 users, user type mix 30/50/20 ──
  // effectiveProfile = (30×15 + 50×40 + 20×80) / 100 = (450+2000+1600)/100 = 40.5 → rounds to 41 GB
  // profile = 500×41/1024 = 20.02 TB
  it('04 — medium, 500 users, user type mix 30% task/50% knowledge/20% power', () => {
    const r = computeAvd({
      ...BASE_AVD,
      totalUsers: 500,
      userTypeMixEnabled: true,
      userTypeMix: { taskPct: 30, taskProfileGB: 15, knowledgePct: 50, knowledgeProfileGB: 40, powerPct: 20, powerProfileGB: 80 },
    })
    expect(r.effectiveProfileSizeGB).toBe(41)
    expect(near(r.totalProfileStorageTB, 20.02)).toBe(true)
  })

  // ── Scenario 05: Heavy multi-session, 200 users ──
  // usersPerHost=4, sessionHostCount=ceil(200/4)=50
  // vCPUs=50×8=400, memory=50×32=1600 GB
  it('05 — heavy multi-session, 200 users', () => {
    const r = computeAvd({ ...BASE_AVD, workloadType: 'heavy', totalUsers: 200 })
    expect(r.sessionHostCount).toBe(50)
    expect(r.totalVCpus).toBe(400)
    expect(r.totalMemoryGB).toBe(1600)
  })

  // ── Scenario 06: Power multi-session, 50 users ──
  // usersPerHost=2, sessionHostCount=ceil(50/2)=25
  // vCPUs=25×16=400, memory=25×64=1600 GB
  // OS=25×256/1024=6.25 TB
  it('06 — power multi-session, 50 users', () => {
    const r = computeAvd({ ...BASE_AVD, workloadType: 'power', totalUsers: 50 })
    expect(r.sessionHostCount).toBe(25)
    expect(r.totalVCpus).toBe(400)
    expect(near(r.totalOsStorageTB, 6.25)).toBe(true)
  })

  // ── Scenario 07: Single-session VDI, 100 users ──
  // usersPerHost=1 (single-session always 1), sessionHostCount=100
  // vCPUs=100×4=400, memory=100×16=1600 GB
  it('07 — single-session VDI, medium, 100 users', () => {
    const r = computeAvd({ ...BASE_AVD, multiSession: false })
    expect(r.usersPerHost).toBe(1)
    expect(r.sessionHostCount).toBe(100)
    expect(r.totalVCpus).toBe(400)
  })

  // ── Scenario 08: Medium, 100 users, growthBuffer 20% ──
  // profile base = 100×40/1024 = 3.906 TB
  // with 20% buffer: 3.906 × 1.20 = 4.69 TB
  it('08 — medium, 100 users, 20% growth buffer', () => {
    const r = computeAvd({ ...BASE_AVD, growthBufferPct: 20 })
    expect(near(r.totalProfileStorageTB, 4.69)).toBe(true)
    expect(near(r.profileStorageWithGrowthTB, 4.69)).toBe(true)
  })

  // ── Scenario 09: Medium, 100 users, office container enabled ──
  // profile = 100×40/1024 = 3.91 TB
  // office  = 100×20/1024 = 1.95 TB
  // total includes both
  it('09 — medium, 100 users, office container 20 GB enabled', () => {
    const r = computeAvd({ ...BASE_AVD, officeContainerEnabled: true, officeContainerSizeGB: 20 })
    expect(near(r.totalOfficeContainerStorageTB, 1.95)).toBe(true)
    expect(near(r.totalStorageTB, r.totalOsStorageTB + r.totalProfileStorageTB + 1.95)).toBe(true)
  })

  // ── Scenario 10: Session host count override ──
  // Override avdSessionHostsNeeded=20 — engine ignores density formula
  it('10 — medium, 100 users, avdSessionHostsNeeded override = 20', () => {
    const r = computeAvd(BASE_AVD, { avdSessionHostsNeeded: 20 })
    expect(r.sessionHostCount).toBe(20)
    expect(r.totalVCpus).toBe(80)  // 20 × 4
  })

  // ── Scenario 11: Data disk per host ──
  // sessionHostCount=ceil(100/8)=13, dataDiskPerHostGB=100
  // dataDiskTB = 13×100/1024 = 1.27 TB
  it('11 — medium, 100 users, 100 GB data disk per host', () => {
    const r = computeAvd({ ...BASE_AVD, dataDiskPerHostGB: 100 })
    expect(r.sessionHostCount).toBe(13)
    expect(near(r.totalDataDiskStorageTB, 13 * 100 / 1024)).toBe(true)
  })

  // ── Scenario 12: Zero concurrent users falls back to totalUsers for sizing ──
  // concurrentUsers=0 → sizingUsers=totalUsers=100
  // sessionHostCount=ceil(100/8)=13
  it('12 — concurrentUsers=0 falls back to totalUsers for host sizing', () => {
    const r = computeAvd({ ...BASE_AVD, concurrentUsers: 0 })
    expect(r.sizingUsers).toBe(100)
    expect(r.sessionHostCount).toBe(13)
  })
})
