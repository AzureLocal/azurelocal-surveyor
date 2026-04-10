import type {
  VolumeSpec,
  VolumeDetail,
  VolumeSummaryResult,
  CapacityResult,
} from './types'
import { getResiliencyFactor } from './capacity'

/**
 * Convert a planned size in TB to the value that WAC / PowerShell (New-Volume -Size) expects.
 *
 * CRITICAL DISTINCTION (preserved from the Excel workbook):
 *   - "Calculator TB" is what the planner uses for capacity math.
 *   - "WAC / PowerShell value" must be rounded DOWN to the nearest whole GB
 *     that WAC will accept. WAC rounds internally, so over-specifying causes
 *     errors. This is the most error-prone step in real S2D deployments.
 *
 * The formula: floor the TB value to the nearest GB → that is the GB value
 * you type into WAC or pass to New-Volume -Size (in bytes = GB × 1024^3).
 */
export function toWacSize(plannedSizeTB: number): { wacSizeTB: number; wacSizeGB: number } {
  const rawGB = plannedSizeTB * 1024
  const wacSizeGB = Math.floor(rawGB)
  const wacSizeTB = round2(wacSizeGB / 1024)
  return { wacSizeTB, wacSizeGB }
}

/**
 * Enrich a VolumeSpec with calculated and WAC sizes.
 * The calculatorSizeTB is the plannedSizeTB passed through; WAC sizes are derived from it.
 */
export function enrichVolume(spec: VolumeSpec): VolumeDetail {
  const { wacSizeTB, wacSizeGB } = toWacSize(spec.plannedSizeTB)
  return {
    ...spec,
    calculatorSizeTB: round2(spec.plannedSizeTB),
    wacSizeTB,
    wacSizeGB,
  }
}

/**
 * Compute the full volume summary — total planned TB, remaining usable, utilization.
 * Uses the effectiveUsableTB from the capacity result as the ceiling.
 */
export function computeVolumeSummary(
  volumes: VolumeSpec[],
  capacity: CapacityResult
): VolumeSummaryResult {
  const enriched = volumes.map(enrichVolume)

  // Account for resiliency overhead per volume: each volume consumes
  // plannedSizeTB / resiliencyFactor from the pool
  const totalPoolConsumptionTB = enriched.reduce((sum, v) => {
    const factor = getResiliencyFactor(v.resiliency, capacity.nodeCount)
    return sum + v.calculatorSizeTB / factor
  }, 0)

  const totalPlannedTB = round2(enriched.reduce((s, v) => s + v.calculatorSizeTB, 0))
  const totalWacTB = round2(enriched.reduce((s, v) => s + v.wacSizeTB, 0))
  const remainingUsableTB = round2(capacity.effectiveUsableTB - totalPoolConsumptionTB)
  const utilizationPct =
    capacity.effectiveUsableTB > 0
      ? Math.round((totalPoolConsumptionTB / capacity.effectiveUsableTB) * 100 * 10) / 10
      : 0

  return {
    volumes: enriched,
    totalPlannedTB,
    totalWacTB,
    remainingUsableTB,
    utilizationPct,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
