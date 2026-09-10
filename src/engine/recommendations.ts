import type { HardwareInputs } from './types'
import { ALL_PRESETS, hardwareFromPreset } from './presets'
import { assessHardwareFit, type FitInputs } from './fit'
import { getResiliencyFactor, minNodesForResiliency } from './capacity'

export interface HardwareConstraints {
  minNodes: number
  maxNodes: number
  headroomPct: number
  vendor: string
}

/** Compare the reviewed example BOMs without inventing certified component options. */
export function recommendHardware(state: FitInputs, constraints: HardwareConstraints) {
  const min = Math.ceil(Math.max(2, constraints.minNodes))
  const max = Math.floor(Math.min(16, constraints.maxNodes))
  if (![min, max, constraints.headroomPct].every(Number.isFinite) || constraints.minNodes < 2 || constraints.maxNodes > 16 || min > max || constraints.headroomPct < 0 || constraints.headroomPct > 100) {
    return { options: [], error: 'Enter a node range within 2–16 and additional headroom between 0% and 100%.' }
  }
  const growth = 1 + constraints.headroomPct / 100
  const options = ALL_PRESETS.filter(p => !constraints.vendor || p.vendor === constraints.vendor).flatMap(preset => {
    const hardware: HardwareInputs = { ...state.hardware, ...hardwareFromPreset(preset) }
    const fit = assessHardwareFit({ ...state, hardware })
    if (!fit.hasDemand) return []
    const candidate = fit.candidates.find(c => c.nodeCount >= min && c.nodeCount <= max && c.fits
      && c.cpu >= fit.demand.totalVCpus * growth && c.memory >= fit.demand.totalMemoryGB * growth
      && c.poolTB >= c.requiredFootprintTB * growth)
    return candidate ? [{ preset, hardware: { ...hardware, nodeCount: candidate.nodeCount }, candidate, demand: fit.demand,
      totalCores: hardware.coresPerNode * candidate.nodeCount,
      totalMemoryGB: hardware.memoryPerNodeGB * candidate.nodeCount,
      rawStorageTB: hardware.capacityDrivesPerNode * hardware.capacityDriveSizeTB * candidate.nodeCount }] : []
  })
  options.sort((a, b) => a.hardware.nodeCount - b.hardware.nodeCount || a.totalCores - b.totalCores || a.totalMemoryGB - b.totalMemoryGB || a.rawStorageTB - b.rawStorageTB || a.preset.id.localeCompare(b.preset.id))
  return { options, error: null }
}

export function estimateAdditionalVms(state: FitInputs, profile: { vCpu: number; memoryGiB: number; diskGiB: number }) {
  if (Object.values(profile).some(n => !Number.isFinite(n) || n <= 0)) return null
  const fit = assessHardwareFit(state)
  if (fit.current.errors.length || !fit.current.fits) return 0
  if (state.hardware.nodeCount < minNodesForResiliency(state.advanced.defaultResiliency)) return 0
  if (profile.memoryGiB > state.hardware.memoryPerNodeGB - state.advanced.systemReservedMemoryGB) return 0
  const diskFootprint = profile.diskGiB * 2 ** 30 / 1e12 / getResiliencyFactor(state.advanced.defaultResiliency, state.hardware.nodeCount)
  const remaining = [
    (fit.current.cpu - fit.demand.totalVCpus) / profile.vCpu,
    (fit.current.memory - fit.demand.totalMemoryGB) / profile.memoryGiB,
    (fit.current.poolTB - fit.current.requiredFootprintTB) / diskFootprint,
  ]
  return Math.max(0, Math.floor(Math.min(...remaining)))
}
