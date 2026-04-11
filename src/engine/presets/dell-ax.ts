import type { OemPreset } from '../types'

/**
 * Dell AX-series Azure Local validated hardware presets.
 *
 * NOTE: AX-660, AX-4510, AX-4520 specs need to be confirmed by the user —
 * those models are not in the current Microsoft Azure Local solutions catalog.
 * AX-670 and AX-770 are the current Premier Solution models (as of 2025).
 *
 * Specs here are based on published Dell datasheets and the Azure Local
 * solutions catalog. Verify with Dell before using in production sizing.
 */
const DELL_AX_PRESETS: OemPreset[] = [
  {
    id: 'dell-ax-670',
    vendor: 'Dell Technologies',
    model: 'AX-670',
    coresPerNode: 32,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 6,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'All-NVMe, 2-socket, Azure Local Premier Solution',
  },
  {
    id: 'dell-ax-770',
    vendor: 'Dell Technologies',
    model: 'AX-770',
    coresPerNode: 40,
    memoryPerNodeGB: 512,
    capacityDrivesPerNode: 8,
    capacityDriveSizeTB: 7.68,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'All-NVMe high-density, Azure Local Premier Solution',
  },
  {
    id: 'dell-ax-660',
    vendor: 'Dell Technologies',
    model: 'AX-660',
    coresPerNode: 24,
    memoryPerNodeGB: 128,
    capacityDrivesPerNode: 4,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'Entry-level all-NVMe. Verify specs with Dell — reference sizing only.',
  },
  {
    id: 'dell-ax-4510',
    vendor: 'Dell Technologies',
    model: 'AX-4510',
    coresPerNode: 32,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 6,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'Mid-range all-NVMe. Verify specs with Dell — reference sizing only.',
  },
  {
    id: 'dell-ax-4520',
    vendor: 'Dell Technologies',
    model: 'AX-4520',
    coresPerNode: 40,
    memoryPerNodeGB: 384,
    capacityDrivesPerNode: 8,
    capacityDriveSizeTB: 7.68,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'High-density all-NVMe. Verify specs with Dell — reference sizing only.',
  },
]

export default DELL_AX_PRESETS
