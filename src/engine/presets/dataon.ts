import type { OemPreset } from '../types'

// DataON Azure Local nodes
const DATAON_PRESETS: OemPreset[] = [
  {
    id: 'dataon-s2d-5212',
    vendor: 'DataON',
    model: 'S2D-5212',
    coresPerNode: 24,
    memoryPerNodeGB: 192,
    capacityDrivesPerNode: 12,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'High-capacity all-NVMe 2U12 chassis',
  },
  {
    id: 'dataon-s2d-4112',
    vendor: 'DataON',
    model: 'S2D-4112',
    coresPerNode: 20,
    memoryPerNodeGB: 128,
    capacityDrivesPerNode: 8,
    capacityDriveSizeTB: 14,
    capacityMediaType: 'hdd',
    cacheDrivesPerNode: 2,
    cacheDriveSizeTB: 1.6,
    cacheMediaType: 'nvme',
    notes: 'NVMe cache + HDD capacity — high-density archive',
  },
]

export default DATAON_PRESETS
