import type { MabsInputs, MabsInternalMirror, MabsResult } from './types'

/** Returns the multiplier for MABS internal Storage Spaces mirror type. */
function internalMirrorMultiplier(mirror: MabsInternalMirror): number {
  switch (mirror) {
    case 'three-way': return 3
    case 'two-way':   return 2
    case 'simple':    return 1
    default:          return 2  // fallback to two-way
  }
}

/** Sanitize a number — replace NaN/Infinity/negative with a safe fallback. */
function safe(n: number, fallback = 0): number {
  return isFinite(n) && !isNaN(n) ? n : fallback
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Compute MABS (Microsoft Azure Backup Server) sizing.
 *
 * MABS runs as a single Windows Server VM on the Azure Local cluster.
 * Storage architecture:
 *   1. Scratch/cache volume — staging area where backup jobs land first (~15% of protected)
 *   2. Backup data volume — full backup + incremental changes × retention days
 *   3. Both volumes are carved out on Azure Local CSVs, attached to the MABS VM
 *   4. Inside the VM, MABS uses Storage Spaces (classic, not S2D) to pool the disks
 *   5. Long-term retention offloads to Azure Recovery Services Vault
 *
 * On-prem storage formula:
 *   scratch_TB   = protectedDataTB × (scratchCachePct / 100)
 *   backup_TB    = protectedDataTB + (protectedDataTB × dailyChangeRate × retentionDays)
 *   total        = scratch_TB + backup_TB
 */
export function computeMabs(inputs: MabsInputs): MabsResult {
  const protectedDataTB    = Math.max(0, safe(inputs.protectedDataTB, 0))
  const dailyChangeRatePct = Math.max(0, safe(inputs.dailyChangeRatePct, 10))
  const onPremRetentionDays = Math.max(1, safe(inputs.onPremRetentionDays, 14))
  const scratchCachePct    = Math.max(0, safe(inputs.scratchCachePct, 15))
  const mabsVCpus          = Math.max(1, safe(inputs.mabsVCpus, 8))
  const mabsMemoryGB       = Math.max(1, safe(inputs.mabsMemoryGB, 32))
  const mabsOsDiskGB       = Math.max(100, safe(inputs.mabsOsDiskGB, 200))

  // Scratch/cache volume — staging area for in-progress backup jobs
  const scratchVolumeTB = round2(protectedDataTB * (scratchCachePct / 100))

  // Backup data volume — initial full backup + rolling incremental changes
  // Formula: full copy + (daily change × retention window)
  const dailyChangeRate = dailyChangeRatePct / 100
  const backupDataVolumeTB = round2(
    protectedDataTB + (protectedDataTB * dailyChangeRate * onPremRetentionDays)
  )

  const totalStorageTB = round2(scratchVolumeTB + backupDataVolumeTB)
  const mabsOsDiskTB = round2(mabsOsDiskGB / 1024)

  // #70: internal Storage Spaces mirror compounding
  const mirrorFactor = internalMirrorMultiplier(inputs.internalMirror)
  const internalFootprintTB = round2(totalStorageTB * mirrorFactor)

  return {
    scratchVolumeTB,
    backupDataVolumeTB,
    totalStorageTB,
    internalMirrorFactor: mirrorFactor,
    internalFootprintTB,
    mabsVCpus,
    mabsMemoryGB,
    mabsOsDiskTB,
  }
}
