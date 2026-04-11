import type { AdvancedSettingsOverrides, SofsInputs, SofsResult } from './types'

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
  // #64: override SOFS profile demand when set
  const totalProfileStorageTB =
    overrides?.sofsProfileDemandTb && overrides.sofsProfileDemandTb > 0
      ? overrides.sofsProfileDemandTb
      : round2((inputs.userCount * inputs.profileSizeGB) / 1024)
  const totalRedirectedStorageTB = round2(
    (inputs.userCount * inputs.redirectedFolderSizeGB) / 1024
  )
  const totalStorageTB = round2(totalProfileStorageTB + totalRedirectedStorageTB)

  const sofsVCpusTotal = inputs.sofsGuestVmCount * inputs.sofsVCpusPerVm
  const sofsMemoryTotalGB = inputs.sofsGuestVmCount * inputs.sofsMemoryPerVmGB

  // #41: IOPS estimates (FSLogix steady-state and login storm)
  // Source: FSLogix sizing guidance — ~10 IOPS/user steady-state, ~50 IOPS/user peak
  const steadyStateIopsPerUser = 10
  const loginStormIopsPerUser = 50
  const sizingUsers = inputs.concurrentUsers > 0 ? inputs.concurrentUsers : inputs.userCount
  const totalSteadyStateIops = sizingUsers * steadyStateIopsPerUser
  const totalLoginStormIops = sizingUsers * loginStormIopsPerUser

  // #43: auto-sizing — calculate drive size needed to hit storage target
  let autoSizeDriveSizeTB = 0
  if (inputs.autoSizeDrivesPerNode > 0 && inputs.autoSizeNodes > 0) {
    const totalDrives = inputs.autoSizeDrivesPerNode * inputs.autoSizeNodes
    // Add ~20% overhead factor for resiliency + system use on SOFS cluster
    const rawNeeded = totalStorageTB * 3  // assume three-way-mirror on SOFS
    autoSizeDriveSizeTB = round2(rawNeeded / totalDrives)
  }

  return {
    totalProfileStorageTB,
    totalRedirectedStorageTB,
    totalStorageTB,
    sofsVCpusTotal,
    sofsMemoryTotalGB,
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
