/**
 * PowerShell command exporter.
 *
 * Generates New-Volume / Set-StoragePool commands that can be pasted
 * directly into WAC PowerShell or a remote PS session.
 *
 * This is one of Surveyor's killer features vs. a plain spreadsheet.
 */

import type { VolumeDetail } from '../engine/types'
import type { SurveyorState } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { computeVolumeSummary, computeQuickStart } from '../engine/volumes'

export function generatePowerShell(state: Pick<SurveyorState, 'hardware' | 'advanced' | 'volumes'>): string {
  const capacity = computeCapacity(state.hardware, state.advanced)
  const summary = computeVolumeSummary(state.volumes, capacity)
  const quickStart = computeQuickStart(capacity)
  const lines: string[] = []

  lines.push('# Azure Local Surveyor — Generated PowerShell Commands')
  lines.push('# Generated: ' + new Date().toISOString())
  lines.push('# WARNING: Review all values before executing in production.')
  lines.push('#')
  lines.push('# Prerequisites: Run these commands on an Azure Local cluster node')
  lines.push('# or via WAC PowerShell with appropriate permissions.')
  lines.push('')
  lines.push('# ── Storage Pool ────────────────────────────────────────────────')
  lines.push(`$poolName = 'S2D on <ClusterName>'`)

  // ── Quick-Start script (from #75) ──
  if (quickStart.psScript) {
    lines.push('')
    lines.push('# ── Quick-Start: Equal Volumes (1 per node) ─────────────────────')
    lines.push(`# ${quickStart.rows[0] ? `${quickStart.rows[0].volumeCount} equal volumes — ${quickStart.rows[0].resiliencyLabel}` : 'Equal-split volumes'}`)
    lines.push(`# Usable: ${quickStart.effectiveUsableTB} TB | Pool: ${quickStart.availableForVolumesTB} TB | ${quickStart.resiliencyLabel}`)
    lines.push('#')
    lines.push('# Uncomment the block below to create the quick-start layout:')
    lines.push('')
    for (const line of quickStart.psScript.split('\n')) {
      lines.push(`# ${line}`)
    }
  }

  // ── Custom volumes ──
  if (summary.volumes.length > 0) {
    lines.push('')
    lines.push('# ── Create Volumes ──────────────────────────────────────────────')

    for (const vol of summary.volumes) {
      lines.push('')
      lines.push(`# Volume: ${vol.name}`)
      lines.push(`# Planned size: ${vol.calculatorSizeTB} TB (calculator)`)
      lines.push(`# WAC size:     ${vol.wacSizeGB} GB — use this value in WAC or New-Volume -Size`)
      lines.push(generateNewVolumeCmd(vol))
    }
  }

  lines.push('')
  lines.push('# ── Verify ──────────────────────────────────────────────────────')
  lines.push('Get-Volume | Where-Object FileSystem -eq ReFS | Select-Object FriendlyName, Size, SizeRemaining | Format-Table -AutoSize')

  return lines.join('\n')
}

function generateNewVolumeCmd(vol: VolumeDetail): string {
  const resiliencyMap: Record<string, string> = {
    'two-way-mirror':   'Mirror',
    'three-way-mirror': 'Mirror',
    'dual-parity':      'Parity',
    'nested-two-way':   'Mirror',
  }
  const storageLayout = resiliencyMap[vol.resiliency] ?? 'Mirror'
  const physicalDiskRedundancy = (vol.resiliency === 'three-way-mirror' || vol.resiliency === 'nested-two-way') ? 2 : 1
  const sizeBytes = BigInt(vol.wacSizeGB) * BigInt(1024) * BigInt(1024) * BigInt(1024)

  return [
    `New-Volume \``,
    `    -StoragePoolFriendlyName $poolName \``,
    `    -FriendlyName '${vol.name}' \``,
    `    -FileSystem ReFS \``,
    `    -StorageLayout ${storageLayout} \``,
    `    -PhysicalDiskRedundancy ${physicalDiskRedundancy} \``,
    `    -Size ${sizeBytes}   # ${vol.wacSizeGB} GB`,
  ].join('\n')
}
