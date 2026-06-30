/**
 * Capacity planning thresholds — shared between engine and UI.
 *
 * AB#4639 — 70% planning line.
 * Canonical definition (docs/capacity-model.md stage 7):
 *   seventy_pct_line = 0.70 × availableForVolumesTB  (footprint basis)
 * Alert fires when planned volume footprint exceeds this threshold.
 * This matches Cartographer exactly (same constant, same comparand).
 */
export const POOL_SEVENTY_PCT = 0.70

/**
 * Returns the 70% planning line in TB (footprint basis).
 * Compare against planned volume pool footprint to decide whether to surface the amber alert.
 */
export function seventyPctLineTB(availableForVolumesTB: number): number {
  return availableForVolumesTB * POOL_SEVENTY_PCT
}
