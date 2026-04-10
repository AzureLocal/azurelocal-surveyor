import type { SofsInputs, SofsResult } from './types'

/**
 * Compute SOFS guest cluster sizing.
 *
 * SOFS (Scale-Out File Server) is a guest VM cluster inside Azure Local,
 * typically used to host FSLogix profile shares at scale beyond what a
 * single VM can serve. It requires HA — minimum 2 guest VMs.
 *
 * Data flow mirrors the "SOFS Planner" sheet (25 formulas).
 */
export function computeSofs(inputs: SofsInputs): SofsResult {
  const totalProfileStorageTB = round2((inputs.userCount * inputs.profileSizeGB) / 1024)
  const totalRedirectedStorageTB = round2(
    (inputs.userCount * inputs.redirectedFolderSizeGB) / 1024
  )
  const totalStorageTB = round2(totalProfileStorageTB + totalRedirectedStorageTB)

  const sofsVCpusTotal = inputs.sofsGuestVmCount * inputs.sofsVCpusPerVm
  const sofsMemoryTotalGB = inputs.sofsGuestVmCount * inputs.sofsMemoryPerVmGB

  return {
    totalProfileStorageTB,
    totalRedirectedStorageTB,
    totalStorageTB,
    sofsVCpusTotal,
    sofsMemoryTotalGB,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
