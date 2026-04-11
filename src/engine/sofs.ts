import type { AdvancedSettingsOverrides, SofsInputs, SofsInternalMirror, SofsResult } from './types'

/** Returns the multiplier for SOFS internal mirror type. */
function internalMirrorMultiplier(mirror: SofsInternalMirror): number {
  switch (mirror) {
    case 'three-way': return 3
    case 'two-way':   return 2
    case 'simple':    return 1
    default:          return 3  // fallback to three-way
  }
}

/** Sanitize a number — replace NaN/Infinity/negative with a safe fallback. */
function safe(n: number, fallback = 0): number {
  return isFinite(n) && !isNaN(n) ? n : fallback
}

/**
 * Compute SOFS guest cluster sizing.
 *
 * SOFS (Scale-Out File Server) is a guest VM cluster inside Azure Local,
 * typically used to host FSLogix profile shares at scale beyond what a
 * single VM can serve. It requires HA — minimum 2 guest VMs.
 *
 * Data flow mirrors the "SOFS Planner" sheet (25 formulas).
 * Additional features: #41 IOPS, #43 auto-sizing, #45 container types.
 */
export function computeSofs(inputs: SofsInputs, overrides?: AdvancedSettingsOverrides): SofsResult {
  const userCount            = Math.max(0, safe(inputs.userCount, 0))
  const concurrentUsers      = Math.max(0, safe(inputs.concurrentUsers, 0))
  const profileSizeGB        = Math.max(0, safe(inputs.profileSizeGB, 0))
  const redirectedFolderSizeGB = Math.max(0, safe(inputs.redirectedFolderSizeGB, 0))
  const sofsGuestVmCount     = Math.max(1, safe(inputs.sofsGuestVmCount, 2))
  const sofsVCpusPerVm       = Math.max(1, safe(inputs.sofsVCpusPerVm, 4))
  const sofsMemoryPerVmGB    = Math.max(1, safe(inputs.sofsMemoryPerVmGB, 16))
  const autoSizeDrivesPerNode = Math.max(0, safe(inputs.autoSizeDrivesPerNode, 0))
  const autoSizeNodes        = Math.max(0, safe(inputs.autoSizeNodes, 0))

  // #64: override SOFS profile demand when set
  const totalProfileStorageTB =
    overrides?.sofsProfileDemandTb && overrides.sofsProfileDemandTb > 0
      ? overrides.sofsProfileDemandTb
      : round2((userCount * profileSizeGB) / 1024)
  const totalRedirectedStorageTB = round2(
    (userCount * redirectedFolderSizeGB) / 1024
  )
  const totalStorageTB = round2(totalProfileStorageTB + totalRedirectedStorageTB)

  // #69: internal mirror compounding — data is mirrored inside the SOFS guest cluster
  const mirrorFactor = internalMirrorMultiplier(inputs.internalMirror)
  const internalFootprintTB = round2(totalStorageTB * mirrorFactor)

  const sofsVCpusTotal = sofsGuestVmCount * sofsVCpusPerVm
  const sofsMemoryTotalGB = sofsGuestVmCount * sofsMemoryPerVmGB

  // #41: IOPS estimates (FSLogix steady-state and login storm)
  // Source: FSLogix sizing guidance — ~10 IOPS/user steady-state, ~50 IOPS/user peak
  const steadyStateIopsPerUser = 10
  const loginStormIopsPerUser = 50
  const sizingUsers = concurrentUsers > 0 ? concurrentUsers : userCount
  const totalSteadyStateIops = sizingUsers * steadyStateIopsPerUser
  const totalLoginStormIops = sizingUsers * loginStormIopsPerUser

  // #43: auto-sizing — calculate drive size needed to hit storage target
  // Uses the internal mirror footprint (not just logical) for accurate sizing
  let autoSizeDriveSizeTB = 0
  if (autoSizeDrivesPerNode > 0 && autoSizeNodes > 0) {
    const totalDrives = autoSizeDrivesPerNode * autoSizeNodes
    autoSizeDriveSizeTB = round2(internalFootprintTB / totalDrives)
  }

  return {
    totalProfileStorageTB,
    totalRedirectedStorageTB,
    totalStorageTB,
    sofsVCpusTotal,
    sofsMemoryTotalGB,
    internalMirrorFactor: mirrorFactor,
    internalFootprintTB,
    steadyStateIopsPerUser,
    loginStormIopsPerUser,
    totalSteadyStateIops,
    totalLoginStormIops,
    autoSizeDriveSizeTB,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
