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

// ─── Generic Hardware-Based Suggestions (#76) ───────────────────────────────
// When no workloads are enabled or the user selects "generic" mode, suggest
// balanced equal-split volumes based purely on hardware inputs.

export interface GenericSuggestion {
  id: string
  name: string
  resiliency: ResiliencyType
  plannedSizeTB: number
  description: string
}

export function generateGenericVolumes(capacity: CapacityResult): GenericSuggestion[] {
  const { nodeCount, effectiveUsableTB, resiliencyType } = capacity
  if (effectiveUsableTB <= 0) return []

  const volumeCount = Math.min(nodeCount, 16)
  const perVolumeTB = round2(effectiveUsableTB / volumeCount)
  if (perVolumeTB <= 0) return []

  // Cap at 64 TB per volume (S2D limit)
  const sizeTB = Math.min(perVolumeTB, 64)

  const suggestions: GenericSuggestion[] = []
  for (let i = 1; i <= volumeCount; i++) {
    suggestions.push({
      id: `generic-vol-${i}`,
      name: `Volume${i}`,
      resiliency: resiliencyType,
      plannedSizeTB: sizeTB,
      description: `Equal-split: ${effectiveUsableTB.toFixed(2)} TB ÷ ${volumeCount} volumes = ${sizeTB} TB each (${capacity.resiliencyFactor > 0 ? RESILIENCY_LABELS[resiliencyType] : 'Unknown'})`,
    })
  }
  return suggestions
}

// ─── Quick-Start Volumes (#75) ──────────────────────────────────────────────
// Hardware-based equal-split reference — "given your hardware, here's the
// simplest balanced layout with N equal volumes."

export interface QuickStartRow {
  scenario: string            // e.g. "3 volumes (1 per node)"
  volumeCount: number
  resiliency: ResiliencyType
  resiliencyLabel: string
  calculatorSizeTB: number    // effectiveUsableTB / volumeCount
  wacSizeTiB: number          // TiB value for WAC/PowerShell (floored)
  wacSizeGiB: number          // GiB value for New-Volume -Size
  poolFootprintTB: number     // wacSizeTiB × volumeCount / resiliencyFactor
  usableTotalTB: number       // wacSizeTiB × volumeCount
  fits: boolean
  utilizationPct: number
}

export interface QuickStartResult {
  rows: QuickStartRow[]
  availableForVolumesTB: number
  effectiveUsableTB: number
  nodeCount: number
  resiliencyLabel: string
  psScript: string
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

export function computeQuickStart(capacity: CapacityResult): QuickStartResult {
  const { nodeCount, effectiveUsableTB, availableForVolumesTB, resiliencyType, resiliencyFactor } = capacity
  const resiliencyLabel = RESILIENCY_LABELS[resiliencyType]

  // Microsoft best practice: 1 volume per node (up to 4 nodes)
  const volumeCount = Math.min(nodeCount, 16)
  const rows: QuickStartRow[] = []

  if (effectiveUsableTB > 0 && volumeCount > 0) {
    const calcSizeTB = round2(effectiveUsableTB / volumeCount)

    // TiB conversion: WAC interprets -Size "XTB" as TiB (binary)
    // 1 TB = 0.909495 TiB (1e12 / 2^40)
    const TB_TO_TiB = 1e12 / Math.pow(1024, 4)
    const wacSizeTiB = Math.floor(calcSizeTB * TB_TO_TiB * 100) / 100  // floor to 2 decimals
    const wacSizeGiB = Math.floor(wacSizeTiB * 1024)

    // Pool footprint: each volume's TiB / resiliencyFactor × volumeCount
    const poolFootprintTB = round2((wacSizeTiB / resiliencyFactor) * volumeCount / TB_TO_TiB)
    const usableTotalTB = round2(wacSizeTiB * volumeCount / TB_TO_TiB)
    const fits = poolFootprintTB <= availableForVolumesTB
    const utilizationPct = availableForVolumesTB > 0
      ? round2((poolFootprintTB / availableForVolumesTB) * 100)
      : 0

    rows.push({
      scenario: `${volumeCount} volume${volumeCount > 1 ? 's' : ''} (1 per node)`,
      volumeCount,
      resiliency: resiliencyType,
      resiliencyLabel,
      calculatorSizeTB: calcSizeTB,
      wacSizeTiB,
      wacSizeGiB,
      poolFootprintTB,
      usableTotalTB,
      fits,
      utilizationPct,
    })
  }

  // Generate PowerShell script
  const row = rows[0]
  let psScript = ''
  if (row) {
    const ps = PS_RESILIENCY[resiliencyType]
    const redundancyParam = ps.redundancy != null ? ` -PhysicalDiskRedundancy ${ps.redundancy}` : ''
    psScript = [
      `# Create ${row.volumeCount} equal volumes of ${row.wacSizeTiB} TiB each (${resiliencyLabel})`,
      `1..${row.volumeCount} | ForEach { New-Volume -FriendlyName "Vol$_" -Size ${row.wacSizeGiB}GB -StoragePoolFriendlyName S2D* -FileSystem CSVFS_ReFS -ResiliencySettingName ${ps.setting}${redundancyParam} }`,
    ].join('\n')
  }

  return { rows, availableForVolumesTB, effectiveUsableTB, nodeCount, resiliencyLabel, psScript }
}
