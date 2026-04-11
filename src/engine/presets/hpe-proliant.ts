import type { OemPreset } from '../types'

/**
 * HPE ProLiant Azure Local hardware presets.
 *
 * Models listed are validated in the Microsoft Azure Local Solutions Catalog.
 * https://azurelocalsolutions.azure.microsoft.com/#/catalog
 *
 * HPE offers both Integrated Systems (certified full-stack) and Validated
 * Nodes (customer-assembled). Specs below are representative mid-range
 * configurations — confirm with HPE or the catalog before quoting.
 */
const HPE_PROLIANT_PRESETS: OemPreset[] = [
  {
    id: 'hpe-dl360-gen11',
    vendor: 'HPE',
    model: 'ProLiant DL360 Gen11',
    catalogType: 'validated-node',
    generation: 'Gen11',
    coresPerNode: 32,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 4,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: '1U all-NVMe. Validated Node for Azure Local.',
  },
  {
    id: 'hpe-dl380-gen11',
    vendor: 'HPE',
    model: 'ProLiant DL380 Gen11',
    catalogType: 'validated-node',
    generation: 'Gen11',
    coresPerNode: 32,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 8,
    capacityDriveSizeTB: 7.68,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: '2U all-NVMe high-density. Validated Node for Azure Local.',
  },
  {
    id: 'hpe-dl380-gen11-hybrid',
    vendor: 'HPE',
    model: 'ProLiant DL380 Gen11 (hybrid)',
    catalogType: 'validated-node',
    generation: 'Gen11',
    coresPerNode: 32,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 8,
    capacityDriveSizeTB: 14,
    capacityMediaType: 'hdd',
    cacheDrivesPerNode: 2,
    cacheDriveSizeTB: 1.6,
    cacheMediaType: 'nvme',
    notes: '2U NVMe cache + HDD capacity. Validated Node for Azure Local.',
  },
]

export default HPE_PROLIANT_PRESETS
