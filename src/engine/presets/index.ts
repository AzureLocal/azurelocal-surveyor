import DELL_AX from './dell-ax'
import LENOVO_MX from './lenovo-mx'
import HPE_PROLIANT from './hpe-proliant'
import DATAON from './dataon'
import type { OemPreset } from '../types'

export const ALL_PRESETS: OemPreset[] = [
  ...DELL_AX,
  ...LENOVO_MX,
  ...HPE_PROLIANT,
  ...DATAON,
]

export function findPreset(id: string): OemPreset | undefined {
  return ALL_PRESETS.find((p) => p.id === id)
}

export { DELL_AX, LENOVO_MX, HPE_PROLIANT, DATAON }
