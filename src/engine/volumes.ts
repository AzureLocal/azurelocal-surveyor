import type {
  VolumeSpec,
  VolumeDetail,
  VolumeSummaryResult,
  CapacityResult,
  ResiliencyType,
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
 * Uses availableForVolumesTB (raw pool after reserve + infra) as the ceiling so
 * that utilization reflects pool consumption across mixed resiliency types.
 */
export function computeVolumeSummary(
  volumes: VolumeSpec[],
  capacity: CapacityResult
): VolumeSummaryResult {
  const enriched = volumes.map(enrichVolume)

  // Pool footprint per volume: plannedSizeTB / resiliencyFactor
  const totalPoolFootprintTB = round2(enriched.reduce((sum, v) => {
    const factor = getResiliencyFactor(v.resiliency, capacity.nodeCount)
    return sum + v.calculatorSizeTB / factor
  }, 0))

  const totalPlannedTB = round2(enriched.reduce((s, v) => s + v.calculatorSizeTB, 0))
  const totalWacTB = round2(enriched.reduce((s, v) => s + v.wacSizeTB, 0))
  // Remaining = raw pool minus pool footprints
  const remainingUsableTB = round2(capacity.availableForVolumesTB - totalPoolFootprintTB)
  const utilizationPct =
    capacity.availableForVolumesTB > 0
      ? Math.round((totalPoolFootprintTB / capacity.availableForVolumesTB) * 100 * 10) / 10
      : 0

  return {
    volumes: enriched,
    totalPlannedTB,
    totalWacTB,
    totalPoolFootprintTB,
    remainingUsableTB,
    utilizationPct,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Generic Hardware-Based Suggestions (#76) ───────────────────────────────
// When no workloads are enabled or the user selects "generic" mode, suggest
// balanced equal-split volumes based purely on hardware inputs.

export interface GenericSuggestion {
  id: string
  name: string
  resiliency: ResiliencyType
  provisioning: 'fixed' | 'thin'
  plannedSizeTB: number
  description: string
}

export function generateGenericVolumes(capacity: CapacityResult, targetUtilization = 0.7): GenericSuggestion[] {
  const { nodeCount, effectiveUsableTB, resiliencyType } = capacity
  if (effectiveUsableTB <= 0) return []

  const volumeCount = Math.min(nodeCount, 16)
  const targetUsableTB = effectiveUsableTB * targetUtilization
  // Floor at 2 decimal places — rounding up causes pool footprint to exceed available pool
  const perVolumeTB = Math.floor((targetUsableTB / volumeCount) * 100) / 100
  if (perVolumeTB <= 0) return []

  // Cap at 64 TB per volume (S2D limit)
  const sizeTB = Math.min(perVolumeTB, 64)
  const pctLabel = `${Math.round(targetUtilization * 100)}%`

  const suggestions: GenericSuggestion[] = []
  for (let i = 1; i <= volumeCount; i++) {
    suggestions.push({
      id: `generic-vol-${i}`,
      name: `Volume${i}`,
      resiliency: resiliencyType,
      provisioning: 'fixed',
      plannedSizeTB: sizeTB,
      description: `Equal-split at ${pctLabel}: ${effectiveUsableTB.toFixed(2)} TB × ${pctLabel} ÷ ${volumeCount} volumes = ${sizeTB} TB each (${capacity.resiliencyFactor > 0 ? RESILIENCY_LABELS[resiliencyType] : 'Unknown'})`,
    })
  }
  return suggestions
}

// ─── Quick-Start Volumes (#75) ──────────────────────────────────────────────
// Hardware-based equal-split reference — "given your hardware, here's the
// simplest balanced layout with N equal volumes."

export interface QuickStartRow {
  volumeCount: number
  resiliency: ResiliencyType
  resiliencyLabel: string
  calculatorSizeTB: number    // effectiveUsable / volumeCount for this resiliency
  wacSizeTiB: number          // TiB value for WAC/PowerShell (floored, 1 GiB margin)
  wacSizeGiB: number          // GiB value for New-Volume -Size (1 GiB safety margin)
  poolFootprintTB: number     // wacSizeTiB × volumeCount / resiliencyFactor
  usableTotalTB: number       // wacSizeTiB × volumeCount
  utilizationPct: number
  targetUtilization: number   // which threshold band this row belongs to (0.7/0.8/0.9/1.0)
}

export interface QuickStartResult {
  rows: QuickStartRow[]
  availableForVolumesTB: number
  effectiveUsableTB: number
  nodeCount: number
  resiliencyLabel: string
  psScript: string
  activePsUtilization: number // which threshold band the PS script is based on
}

const RESILIENCY_LABELS: Record<ResiliencyType, string> = {
  'two-way-mirror':   'Two-Way Mirror',
  'three-way-mirror': 'Three-Way Mirror',
  'dual-parity':      'Dual Parity',
  'nested-two-way':   'Nested Two-Way Mirror',
}

const PS_RESILIENCY: Record<ResiliencyType, { setting: string; redundancy?: number }> = {
  'two-way-mirror':   { setting: 'Mirror', redundancy: 1 },
  'three-way-mirror': { setting: 'Mirror', redundancy: 2 },
  'dual-parity':      { setting: 'Parity' },
  'nested-two-way':   { setting: 'Mirror', redundancy: 2 },
}

export function computeQuickStart(capacity: CapacityResult, activePsUtilization = 0.7): QuickStartResult {
  const { nodeCount, availableForVolumesTB } = capacity

  // Microsoft best practice: 1 volume per node (up to 16)
  const volumeCount = Math.min(nodeCount, 16)
  const rows: QuickStartRow[] = []
  const TB_TO_TiB = 1e12 / Math.pow(1024, 4)  // ≈ 0.909099

  // Always show two reference resiliency types per threshold band
  const REFERENCE_RESILIENCIES: ResiliencyType[] = ['three-way-mirror', 'two-way-mirror']
  // Four threshold bands
  const THRESHOLDS = [0.7, 0.8, 0.9, 1.0]

  if (availableForVolumesTB > 0 && volumeCount > 0) {
    for (const threshold of THRESHOLDS) {
      const poolBudgetTB = availableForVolumesTB * threshold
      for (const resiliency of REFERENCE_RESILIENCIES) {
        const factor = resiliency === 'two-way-mirror' ? 0.5 : 1 / 3
        const effectiveUsable = poolBudgetTB * factor
        const calcSizeTB = Math.floor((effectiveUsable / volumeCount) * 100) / 100

        // Convert to GiB with 1 GiB safety margin (WAC rounds internally)
        const rawGiB = calcSizeTB * TB_TO_TiB * 1024
        const wacSizeGiB = Math.max(0, Math.floor(rawGiB) - 1)  // 1 GiB safety margin
        const wacSizeTiB = round2(wacSizeGiB / 1024)

        const poolFootprintTB = round2((wacSizeTiB / factor) * volumeCount / TB_TO_TiB)
        const usableTotalTB = round2(wacSizeTiB * volumeCount / TB_TO_TiB)
        const utilizationPct = availableForVolumesTB > 0
          ? round2((poolFootprintTB / availableForVolumesTB) * 100)
          : 0

        rows.push({
          volumeCount,
          resiliency,
          resiliencyLabel: RESILIENCY_LABELS[resiliency],
          calculatorSizeTB: calcSizeTB,
          wacSizeTiB,
          wacSizeGiB,
          poolFootprintTB,
          usableTotalTB,
          utilizationPct,
          targetUtilization: threshold,
        })
      }
    }
  }

  // PowerShell script uses the Three-Way Mirror row for the active PS utilization band
  const primaryRow = rows.find(r => r.targetUtilization === activePsUtilization && r.resiliency === 'three-way-mirror')
    ?? rows.find(r => r.resiliency === 'three-way-mirror')
  let psScript = ''
  if (primaryRow) {
    const ps = PS_RESILIENCY[primaryRow.resiliency]
    const redundancyParam = ps.redundancy != null ? ` -PhysicalDiskRedundancy ${ps.redundancy}` : ''
    psScript = [
      `# Create ${primaryRow.volumeCount} equal volumes of ${primaryRow.wacSizeGiB} GiB each (${primaryRow.resiliencyLabel})`,
      `1..${primaryRow.volumeCount} | ForEach { New-Volume -FriendlyName "Vol$_" -Size ${primaryRow.wacSizeGiB}GB -StoragePoolFriendlyName S2D* -FileSystem CSVFS_ReFS -ResiliencySettingName ${ps.setting}${redundancyParam} }`,
    ].join('\n')
  }

  const resiliencyLabel = RESILIENCY_LABELS[capacity.resiliencyType]
  const effectiveUsableTB = capacity.effectiveUsableTB
  return { rows, availableForVolumesTB, effectiveUsableTB, nodeCount, resiliencyLabel, psScript, activePsUtilization }
}
