import type {
  HardwareInputs,
  AdvancedSettings,
  CapacityResult,
  ResiliencyType,
} from './types'

/**
 * Returns the storage efficiency multiplier for a given resiliency type.
 *
 * Dual Parity efficiency is node-count dependent (matches Excel workbook):
 *   4–6 nodes  → 50%
 *   7–8 nodes  → 66.7%
 *   9–15 nodes → 75%   (all-flash tiers)
 *   16 nodes   → 80%   (all-flash tiers)
 */
export function getResiliencyFactor(resiliency: ResiliencyType, nodeCount: number): number {
  switch (resiliency) {
    case 'two-way-mirror':
      return 0.5
    case 'three-way-mirror':
      return 1 / 3
    case 'dual-parity':
      if (nodeCount <= 6)  return 0.5
      if (nodeCount <= 8)  return 2 / 3
      if (nodeCount <= 15) return 0.75
      return 0.8
    case 'nested-two-way':
      return 0.25
    default:
      return 1 / 3  // fallback to three-way-mirror if resiliency is invalid/stale
  }
}

/**
 * Returns the minimum node count required for a resiliency type.
 */
export function minNodesForResiliency(resiliency: ResiliencyType): number {
  switch (resiliency) {
    case 'two-way-mirror':    return 2
    case 'three-way-mirror':  return 3
    case 'dual-parity':       return 4
    case 'nested-two-way':    return 2
    default:                  return 3  // fallback to three-way-mirror
  }
}

/**
 * Core capacity calculation — mirrors the Excel formula chain exactly.
 *
 *   1. usablePerDriveTB  = driveSizeTB × efficiencyFactor  (applied PER DRIVE, not pool)
 *   2. totalUsableTB     = usablePerDrive × drivesPerNode × nodeCount
 *   3. reserveDrives     = min(nodeCount, 4)               (S2D formula — not user-configurable)
 *   4. reserveTB         = reserveDrives × usablePerDriveTB
 *   5. infraVolumeTB     = infraVolumeSizeTB / resiliencyFactor  (pool footprint of system CSV)
 *   6. availableForVolumesTB = totalUsable − reserve − infraVolume
 *   7. effectiveUsableTB = availableForVolumesTB × resiliencyFactor  (planning number)
 *   8. TiB equivalent    = TB × (1 000 000 000 000 / 1 099 511 627 776) ≈ × 0.909099
 */
/** Sanitize a number — replace NaN/Infinity/negative with a safe fallback. */
function safe(n: number, fallback = 0): number {
  return isFinite(n) && !isNaN(n) ? n : fallback
}

export function computeCapacity(
  inputs: HardwareInputs,
  settings: AdvancedSettings
): CapacityResult {
  const nodeCount            = Math.max(1, safe(inputs.nodeCount, 1))
  const capacityDrivesPerNode = Math.max(0, safe(inputs.capacityDrivesPerNode, 0))
  const capacityDriveSizeTB  = Math.max(0, safe(inputs.capacityDriveSizeTB, 0))
  const { capacityEfficiencyFactor, infraVolumeSizeTB, defaultResiliency } = settings

  // Step 1: per-drive usable (filesystem overhead applied here, not at pool level)
  // #64: use manual override when set (non-zero)
  const usablePerDriveTB =
    settings.overrides?.driveUsableTb && settings.overrides.driveUsableTb > 0
      ? settings.overrides.driveUsableTb
      : capacityDriveSizeTB * capacityEfficiencyFactor

  // Step 2: total usable raw → all drives across all nodes after per-drive overhead
  const rawPoolTB = capacityDriveSizeTB * capacityDrivesPerNode * nodeCount
  const totalUsableTB = usablePerDriveTB * capacityDrivesPerNode * nodeCount

  // Step 3–4: reserve — S2D keeps min(nodeCount, 4) drives for rebuild
  const reserveDrives = Math.min(nodeCount, 4)
  const reserveTB = reserveDrives * usablePerDriveTB

  // Step 5: resiliency factor (dual-parity is node-count dependent)
  const resiliencyFactor = getResiliencyFactor(defaultResiliency, nodeCount)

  // Infra volume pool footprint: logical size ÷ resiliency factor
  // (system CSV always created with the cluster's default resiliency)
  const infraVolumeTB = infraVolumeSizeTB / resiliencyFactor

  // Step 6: pool space available for user volumes
  const availableForVolumesTB = Math.max(0, totalUsableTB - reserveTB - infraVolumeTB)

  // Step 7: planning number — how much data fits with the selected resiliency
  const effectiveUsableTB = availableForVolumesTB * resiliencyFactor

  // Step 8: TiB conversion (1 TB = 10^12 bytes; 1 TiB = 2^40 bytes)
  const TB_TO_TiB = 1e12 / Math.pow(1024, 4)  // ≈ 0.909099
  const availableForVolumesTiB = availableForVolumesTB * TB_TO_TiB

  return {
    nodeCount,
    rawPoolTB: round4(rawPoolTB),
    usablePerDriveTB: round4(usablePerDriveTB),
    totalUsableTB: round4(totalUsableTB),
    reserveDrives,
    reserveTB: round4(reserveTB),
    infraVolumeTB: round4(infraVolumeTB),
    availableForVolumesTB: round4(availableForVolumesTB),
    availableForVolumesTiB: round4(availableForVolumesTiB),
    resiliencyType: defaultResiliency,
    resiliencyFactor,
    effectiveUsableTB: round4(effectiveUsableTB),
  }
}

/** Round to 4 decimal places for internal precision; display rounds as needed. */
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/** Round to 2 decimal places (display precision). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
