import type { OemPreset } from '../types'

// HPE ProLiant Azure Local nodes
const HPE_PROLIANT_PRESETS: OemPreset[] = [
  {
    id: 'hpe-dl380-azurelocal',
    vendor: 'HPE',
    model: 'ProLiant DL380 Gen11 (Azure Local)',
    coresPerNode: 32,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 4,
    capacityDriveSizeTB: 7.68,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'HPE-validated Azure Local node; all-NVMe',
  },
  {
    id: 'hpe-edgeline-el8000',
    vendor: 'HPE',
    model: 'Edgeline EL8000',
    coresPerNode: 16,
    memoryPerNodeGB: 128,
    capacityDrivesPerNode: 4,
    capacityDriveSizeTB: 1.92,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'Edge / ruggedized form factor',
  },
]

export default HPE_PROLIANT_PRESETS
