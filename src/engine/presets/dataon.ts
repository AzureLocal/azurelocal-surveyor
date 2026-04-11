import type { OemPreset } from '../types'

/**
 * DataON Azure Local hardware presets.
 *
 * DataON's current Azure Local lineup uses the AZS (standard) and AZL (large)
 * series. Listed models are Integrated Systems in the Microsoft Azure Local
 * Solutions Catalog.
 * https://azurelocalsolutions.azure.microsoft.com/#/catalog
 *
 * Specs are representative mid-range configurations — confirm with DataON
 * or the catalog before quoting.
 */
const DATAON_PRESETS: OemPreset[] = [
  {
    id: 'dataon-azs-7224',
    vendor: 'DataON',
    model: 'AZS-7224',
    catalogType: 'integrated',
    coresPerNode: 32,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 12,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: '2U all-NVMe, 24-bay chassis. Integrated System for Azure Local.',
  },
  {
    id: 'dataon-azs-7248',
    vendor: 'DataON',
    model: 'AZS-7248',
    catalogType: 'integrated',
    coresPerNode: 48,
    memoryPerNodeGB: 512,
    capacityDrivesPerNode: 24,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: '2U all-NVMe, 48-bay high-density chassis. Integrated System.',
  },
  {
    id: 'dataon-azs-7224-hybrid',
    vendor: 'DataON',
    model: 'AZS-7224 (hybrid)',
    catalogType: 'integrated',
    coresPerNode: 32,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 12,
    capacityDriveSizeTB: 14,
    capacityMediaType: 'hdd',
    cacheDrivesPerNode: 2,
    cacheDriveSizeTB: 1.6,
    cacheMediaType: 'nvme',
    notes: 'NVMe cache + HDD capacity, 24-bay chassis. Integrated System.',
  },
]

export default DATAON_PRESETS
