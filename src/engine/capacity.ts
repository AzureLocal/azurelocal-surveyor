import type {
  HardwareInputs,
  AdvancedSettings,
  CapacityResult,
  ResiliencyType,
  ExpansionHeadroomResult,
  ExpansionHeadroomRow,
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
 * See docs/capacity-model.md — Locked S2D facts.
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
 * Returns the safest valid resiliency type for a given node count.
 * Preference order: honour the requested type if valid; else fall back
 * to two-way-mirror (always valid for ≥2 nodes).
 *
 * Per docs/capacity-model.md: for 2-node, nested-two-way is the
 * production recommendation, but two-way-mirror is also valid.
 */
export function clampResiliency(
  requested: ResiliencyType,
  nodeCount: number
): { resiliency: ResiliencyType; clamped: boolean } {
  if (nodeCount >= minNodesForResiliency(requested)) {
    return { resiliency: requested, clamped: false }
  }
  // For 2-node: two-way-mirror is simplest valid fallback
  // nested-two-way is ≥2 as well, but two-way is the safer default
  const fallback: ResiliencyType = 'two-way-mirror'
  return { resiliency: fallback, clamped: true }
}

/**
 * Returns a list of resiliency types that are valid for the given node count.
 */
export function validResiliencyOptions(nodeCount: number): ResiliencyType[] {
  const all: ResiliencyType[] = ['two-way-mirror', 'nested-two-way', 'three-way-mirror', 'dual-parity']
  return all.filter((r) => nodeCount >= minNodesForResiliency(r))
}

/**
 * TB ↔ TiB conversion constant.
 * 1 TB = 10^12 bytes; 1 TiB = 2^40 bytes.
 * TB_TO_TiB ≈ 0.909099
 */
export const TB_TO_TiB = 1e12 / Math.pow(1024, 4)

/**
 * Pool metadata overhead factor (~1%).
 * S2D reserves a small amount of pool space for internal metadata.
 * Canonical pipeline stage 2 (docs/capacity-model.md): raw × 0.99.
 * Use live StoragePool.Size when available (Cartographer); else this estimate.
 */
export const POOL_METADATA_FACTOR = 0.99

/**
 * Core capacity calculation — implements the canonical pipeline from docs/capacity-model.md.
 *
 * Pipeline (all internal values are decimal TB for backward compatibility;
 * bytes-first internal representation is a Wave 2 item per AB#4640):
 *
 *   Stage 1 — Raw:        driveSizeTB × drivesPerNode × nodeCount
 *   Stage 2 — Pool meta:  raw × POOL_METADATA_FACTOR (~1% overhead)
 *   Stage 3 — Reserve:    min(nodeCount, 4) × largestRawDriveSizeTB   (AB#4643)
 *   Stage 4 — Infra vol:  infraVolumeSizeTB / resiliencyFactor
 *   Stage 5 — Available:  poolAfterMeta − reserve − infraVolume        (no WAF maintenance deduction — compute only)
 *   Stage 6 — Usable:     available × resiliencyFactor                (planning number)
 *   TiB conversion done ONCE at display: TB × TB_TO_TiB               (AB#4641)
 *
 * NOTE: The `capacityEfficiencyFactor` (0.92) field has been removed from AdvancedSettings
 * as of 2.4.1. It was a blended constant that double-counted the TB→TiB unit conversion
 * (documented in docs/capacity-model.md Q1 / AB#4641) and was never applied to the pool.
 * Per-drive override is still available via overrides.driveUsableTb.
 *
 * RESILIENCY GATING: If the selected resiliency requires more nodes than the
 * cluster has, it is clamped to the safest valid option and `resiliencyClamped`
 * is set to true on the result so the UI can surface a warning. (AB#4636)
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
  const { infraVolumeSizeTB } = settings

  // AB#4636 — Resiliency gating: clamp to a valid resiliency for this node count.
  // minNodesForResiliency is now called here (was previously unused).
  const { resiliency: effectiveResiliency, clamped: resiliencyClamped } =
    clampResiliency(settings.defaultResiliency, nodeCount)

  // Stage 1 — Raw pool (true drive bytes, no blended efficiency factor).
  // AB#4641: raw capacity is the true drive byte count; the old 0.92 blended
  // factor is decomposed — the TB→TiB unit conversion happens ONCE at display.
  const rawPoolTB = capacityDriveSizeTB * capacityDrivesPerNode * nodeCount

  // Stage 2 — Pool metadata overhead (~1%).
  // See docs/capacity-model.md stage 2: raw × 0.99.
  const poolAfterMetaTB = rawPoolTB * POOL_METADATA_FACTOR

  // Stage 3 — Reserve: min(nodeCount, 4) × largest raw drive size.
  // AB#4643: basis is largest raw drive bytes, NOT efficiency-adjusted.
  // For symmetric clusters (all drives same size) this is simply driveSizeTB.
  const reserveDrives = Math.min(nodeCount, 4)
  const largestRawDriveSizeTB = capacityDriveSizeTB  // symmetric assumption; Wave 2 for asymmetric
  const reserveTB = reserveDrives * largestRawDriveSizeTB

  // Stage 4 — Resiliency factor and infra volume pool footprint.
  const resiliencyFactor = getResiliencyFactor(effectiveResiliency, nodeCount)
  // Infra volume pool footprint: logical size ÷ resiliency factor
  // (system CSV always created with the cluster's default resiliency)
  const infraVolumeTB = infraVolumeSizeTB / resiliencyFactor

  // Stage 5 — Available for user volumes (pool footprint space).
  // NOTE: The WAF N+1/N+2 maintenance reserve is a COMPUTE resiliency concept (CPU + memory
  // headroom so nodes can be drained for updates or survive a node loss). It does NOT reduce
  // storage capacity. The only MS-documented storage reserves are the per-drive rebuild reserve
  // (Stage 3) and keeping volume footprints within the available pool (HC_OVER_CAPACITY).
  const availableForVolumesTB = Math.max(0, poolAfterMetaTB - reserveTB - infraVolumeTB)

  // Stage 6 — Planning number: usable data capacity with selected resiliency.
  const effectiveUsableTB = availableForVolumesTB * resiliencyFactor

  // TiB conversion — done ONCE here, not mixed into pool calculations (AB#4641).
  const availableForVolumesTiB = availableForVolumesTB * TB_TO_TiB

  // usablePerDriveTB retained in the result for UI display continuity.
  // Under the canonical model this is simply the raw drive size (no 0.92 haircut).
  // The override path is preserved: if driveUsableTb is set, it shows the override value.
  const usablePerDriveTB =
    settings.overrides?.driveUsableTb && settings.overrides.driveUsableTb > 0
      ? settings.overrides.driveUsableTb
      : capacityDriveSizeTB  // raw size — no blended efficiency factor

  // totalUsableTB: pool after metadata overhead (Stage 2 result, labeled clearly in UI).
  // This replaces the old "usablePerDrive × drives × nodes" which baked in the 0.92 factor.
  const totalUsableTB = poolAfterMetaTB

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
    resiliencyType: effectiveResiliency,
    resiliencyFactor,
    effectiveUsableTB: round4(effectiveUsableTB),
    resiliencyClamped,
    resiliencyRequested: settings.defaultResiliency,
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

/**
 * TiB conversion constant: 1 TB = 10^12 bytes; 1 TiB = 2^40 = 1099511627776 bytes.
 * TB ÷ (2^40 / 10^12) = TB × (10^12 / 2^40).
 * Equivalently: TiB = TB / 1.099511627776.
 * (Same constant as TB_TO_TiB but stated as a divisor for clarity in the spec.)
 */
const TiB_DIVISOR = Math.pow(1024, 4) / 1e12  // = 1.099511627776

/**
 * Returns the number of data copies for a resiliency type.
 *   two-way-mirror   → 2
 *   three-way-mirror → 3
 *   dual-parity      → 2 (dual-parity stores 2 full data copies across the parity set)
 *   nested-two-way   → 4 (two mirrors nested = 4 physical copies)
 * For new-volume sizing we use this as the divisor to go from footprint → usable.
 */
export function resiliencyDataCopies(resiliency: ResiliencyType): number {
  switch (resiliency) {
    case 'two-way-mirror':   return 2
    case 'three-way-mirror': return 3
    case 'dual-parity':      return 2
    case 'nested-two-way':   return 4
    default:                 return 3  // safe fallback
  }
}

/**
 * Compute expansion headroom — how much room remains to grow existing volumes
 * or create new ones at each planning threshold (70 / 80 / 90 / 100% fill).
 *
 * Canonical math (shared with Cartographer — must remain identical):
 *   A      = availableForVolumesTB      (pool footprint space, excl. reserve + infra)
 *   U      = totalPoolFootprintTB       (current planned workload-volume pool footprint)
 *   copies = data copies for the prevailing new-volume resiliency
 *            (two-way=2, three-way=3, nested-two-way=4; derived from resiliencyType or defaultResiliency)
 *
 *   currentUtilizationPct = U / A × 100
 *   For each X in [0.70, 0.80, 0.90, 1.00]:
 *     footprintBudgetTB    = X × A
 *     remainingFootprintTB = max(0, X × A − U)
 *     remainingNewUsableTB = remainingFootprintTB / copies
 *     pastLine             = U > X × A
 *
 * TiB = TB / 1.099511627776 (TB_TO_TiB inverse).
 * All raw values are unrounded; the caller rounds for display.
 *
 * @param availableForVolumesTB - CapacityResult.availableForVolumesTB
 * @param totalPoolFootprintTB  - VolumeSummaryResult.totalPoolFootprintTB (or 0 if no volumes)
 * @param resiliencyForNewVolumes - ResiliencyType to use when estimating new-volume usable space.
 *                                  Typically the cluster default (CapacityResult.resiliencyType).
 */
export function computeExpansionHeadroom(
  availableForVolumesTB: number,
  totalPoolFootprintTB: number,
  resiliencyForNewVolumes: ResiliencyType,
): ExpansionHeadroomResult {
  const A = availableForVolumesTB
  const U = totalPoolFootprintTB
  const copies = resiliencyDataCopies(resiliencyForNewVolumes)
  const currentUtilizationPct = A > 0 ? (U / A) * 100 : 0

  const TARGETS = [0.70, 0.80, 0.90, 1.00]
  const rows: ExpansionHeadroomRow[] = TARGETS.map((x) => {
    const footprintBudgetTB    = x * A
    const remainingFootprintTB = Math.max(0, footprintBudgetTB - U)
    const remainingNewUsableTB = copies > 0 ? remainingFootprintTB / copies : 0
    const pastLine             = U > footprintBudgetTB
    const remainingNewUsableTiB = remainingNewUsableTB / TiB_DIVISOR

    // sizeToEnterTiB: the value a user types into New-Volume -Size or WAC.
    // PowerShell and WAC read size suffixes as binary (1 TB = 1 TiB), so this
    // equals the TiB value, rounded DOWN to 2 decimal places so the new volume
    // always fits. Set to 0 when past the fill line.
    const sizeToEnterTiB = pastLine
      ? 0
      : Math.floor(remainingNewUsableTiB * 100) / 100

    return {
      targetFraction:        x,
      footprintBudgetTB,
      footprintBudgetTiB:     footprintBudgetTB / TiB_DIVISOR,
      remainingFootprintTB,
      remainingFootprintTiB:  remainingFootprintTB / TiB_DIVISOR,
      remainingNewUsableTB,
      remainingNewUsableTiB,
      pastLine,
      sizeToEnterTiB,
    }
  })

  return {
    availableForVolumesTB,
    totalPoolFootprintTB,
    copies,
    resiliencyLabel: resiliencyForNewVolumes,
    currentUtilizationPct,
    rows,
  }
}
