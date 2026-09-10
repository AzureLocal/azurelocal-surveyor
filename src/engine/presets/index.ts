import DELL_AX from './dell-ax'
import LENOVO_MX from './lenovo-mx'
import HPE_PROLIANT from './hpe-proliant'
import DATAON from './dataon'
import type { HardwareInputs, OemPreset } from '../types'

/** Only copy sizing fields; preserve the user's cluster size and other settings. */
export function hardwareFromPreset(preset: OemPreset): Partial<HardwareInputs> {
  return {
    coresPerNode: preset.coresPerNode,
    memoryPerNodeGB: preset.memoryPerNodeGB,
    capacityDrivesPerNode: preset.capacityDrivesPerNode,
    capacityDriveSizeTB: preset.capacityDriveSizeTB,
    capacityMediaType: preset.capacityMediaType,
    cacheDrivesPerNode: preset.cacheDrivesPerNode,
    cacheDriveSizeTB: preset.cacheDriveSizeTB,
    cacheMediaType: preset.cacheMediaType,
  }
}

export const ALL_PRESETS: OemPreset[] = [
  ...DELL_AX,
  ...HPE_PROLIANT,
  ...LENOVO_MX,
  ...DATAON,
]

/** Unique vendor names in display order. */
export const PRESET_VENDORS = [...new Set(ALL_PRESETS.map((p) => p.vendor))]

/** Presets grouped by vendor for dropdown <optgroup>. */
export function presetsByVendor(): Map<string, OemPreset[]> {
  const map = new Map<string, OemPreset[]>()
  for (const p of ALL_PRESETS) {
    const list = map.get(p.vendor) ?? []
    list.push(p)
    map.set(p.vendor, list)
  }
  return map
}

export function findPreset(id: string): OemPreset | undefined {
  return ALL_PRESETS.find((p) => p.id === id)
}

export { DELL_AX, LENOVO_MX, HPE_PROLIANT, DATAON }
