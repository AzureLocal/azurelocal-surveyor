import type { OemPreset } from '../types'

// Dell AX-series Azure Local nodes
// Source: Dell Technologies Azure Local validated hardware list (public specs)
const DELL_AX_PRESETS: OemPreset[] = [
  {
    id: 'dell-ax-650',
    vendor: 'Dell Technologies',
    model: 'AX-650',
    coresPerNode: 32,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 6,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'All-NVMe configuration',
  },
  {
    id: 'dell-ax-750',
    vendor: 'Dell Technologies',
    model: 'AX-750',
    coresPerNode: 40,
    memoryPerNodeGB: 512,
    capacityDrivesPerNode: 8,
    capacityDriveSizeTB: 7.68,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'All-NVMe high-density configuration',
  },
  {
    id: 'dell-ax-760',
    vendor: 'Dell Technologies',
    model: 'AX-760',
    coresPerNode: 48,
    memoryPerNodeGB: 512,
    capacityDrivesPerNode: 10,
    capacityDriveSizeTB: 7.68,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'High-core-count all-NVMe; common AVD platform',
  },
]

export default DELL_AX_PRESETS
