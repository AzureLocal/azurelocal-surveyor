import type {
  HardwareInputs,
  AdvancedSettings,
  CapacityResult,
  ResiliencyType,
} from './types'

/**
 * Returns the storage efficiency multiplier for a given resiliency type.
 *
 * 2-way mirror  → 0.5   (one copy retained out of two)
 * 3-way mirror  → 0.333 (one copy retained out of three)
 * MAP (4+ nodes) → 0.667 (20% mirror + 80% parity, net ~2/3 usable)
 *
 * These match the values used in the S2D_Capacity_Calculator.xlsx.
 */
export function getResiliencyFactor(resiliency: ResiliencyType): number {
  switch (resiliency) {
    case '2-way-mirror':
      return 0.5
    case '3-way-mirror':
      return 1 / 3
    case 'mirror-accelerated-parity':
      return 2 / 3
  }
}

/**
 * Core capacity calculation.
 *
 * Data flow (mirrors the Excel DAG):
 *   Hardware Inputs → rawPoolTB → poolReserveTB → netPoolTB
 *   → resiliencyFactor → usableAfterResiliencyTB
 *   → capacityEfficiencyFactor → effectiveUsableTB
 *
 * effectiveUsableTB is the number to plan workloads against.
 */
export function computeCapacity(
  inputs: HardwareInputs,
  settings: AdvancedSettings
): CapacityResult {
  const { nodeCount, capacityDrivesPerNode, capacityDriveSizeTB } = inputs
  const { poolReserveDrives, capacityEfficiencyFactor, defaultResiliency } = settings

  // Step 1: raw pool — total physical capacity across all nodes
  const rawPoolTB = capacityDriveSizeTB * capacityDrivesPerNode * nodeCount

  // Step 2: pool reserve — one drive's worth set aside for rebuild operations
  const poolReserveTB = capacityDriveSizeTB * poolReserveDrives

  // Step 3: net pool after reserve
  const netPoolTB = Math.max(0, rawPoolTB - poolReserveTB)

  // Step 4: resiliency factor
  const resiliencyFactor = getResiliencyFactor(defaultResiliency)

  // Step 5: usable after resiliency overhead
  const usableAfterResiliencyTB = netPoolTB * resiliencyFactor

  // Step 6: effective usable — apply the 92% efficiency factor (filesystem + ReFS metadata)
  const effectiveUsableTB = usableAfterResiliencyTB * capacityEfficiencyFactor

  return {
    rawPoolTB: round2(rawPoolTB),
    poolReserveTB: round2(poolReserveTB),
    netPoolTB: round2(netPoolTB),
    resiliencyType: defaultResiliency,
    resiliencyFactor,
    usableAfterResiliencyTB: round2(usableAfterResiliencyTB),
    effectiveUsableTB: round2(effectiveUsableTB),
  }
}

/** Round to 2 decimal places (matches Excel's display precision). */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
