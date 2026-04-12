import type { OemPreset } from '../types'

/**
 * Dell Technologies AX-series Azure Local hardware presets.
 *
 * Models listed here are Azure Local Premier Solutions — validated and
 * published in the Microsoft Azure Local Solutions Catalog.
 * https://azurelocalsolutions.azure.microsoft.com/#/catalog
 *
 * Specs represent common mid-range configurations; actual BOM options
 * vary widely. Always confirm with Dell or the catalog before quoting.
 */
const DELL_AX_PRESETS: OemPreset[] = [
  {
    id: 'dell-ax-670',
    vendor: 'Dell Technologies',
    model: 'AX-670',
    catalogType: 'premier',
    generation: '16G',
    coresPerNode: 32,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 6,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'Based on PowerEdge R660/R760. All-NVMe, Premier Solution.',
  },
  {
    id: 'dell-ax-770',
    vendor: 'Dell Technologies',
    model: 'AX-770',
    catalogType: 'premier',
    generation: '16G',
    coresPerNode: 64,
    memoryPerNodeGB: 1024,
    capacityDrivesPerNode: 8,
    capacityDriveSizeTB: 7.68,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'Based on PowerEdge R760. GPU-ready 4U, Premier Solution.',
  },
]

export default DELL_AX_PRESETS
