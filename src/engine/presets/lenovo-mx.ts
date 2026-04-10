import type { OemPreset } from '../types'

// Lenovo ThinkAgile MX-series Azure Local nodes
const LENOVO_MX_PRESETS: OemPreset[] = [
  {
    id: 'lenovo-mx3530-h',
    vendor: 'Lenovo',
    model: 'ThinkAgile MX3530-H',
    coresPerNode: 24,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 6,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'All-NVMe 1U node',
  },
  {
    id: 'lenovo-mx3530-f',
    vendor: 'Lenovo',
    model: 'ThinkAgile MX3530-F',
    coresPerNode: 32,
    memoryPerNodeGB: 384,
    capacityDrivesPerNode: 8,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'All-NVMe high-density 2U',
  },
]

export default LENOVO_MX_PRESETS
