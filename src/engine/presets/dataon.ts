import type { OemPreset } from '../types'

// Vendor-backed model metadata; numeric values are editable planning examples,
// not a certified or orderable bill of materials. See docs/reference/oem-presets.md.
const DATAON_PRESETS: OemPreset[] = [
  {
    id: 'dataon-azl-8208i',
    vendor: 'DataON',
    model: 'AZL-8208i',
    catalogType: 'premier',
    generation: 'Intel Xeon 6',
    coresPerNode: 64,
    memoryPerNodeGB: 512,
    capacityDrivesPerNode: 8,
    capacityDriveSizeTB: 7.68,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: '2U; eight NVMe bays. DataON markets this as Premier Solution+.',
    sourceUrl: 'https://dataon.io/product/dataon-azl-8208i-premier-solution-for-azure-local/',
    sourceTitle: 'DataON product specifications',
    reviewedAt: '2026-09-10',
  },
  {
    id: 'dataon-azs-7224',
    vendor: 'DataON',
    model: 'AZS-7224',
    catalogType: 'integrated',
    generation: 'Intel Xeon 5th Gen',
    coresPerNode: 32,
    memoryPerNodeGB: 512,
    capacityDrivesPerNode: 12,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: '2U; 24 NVMe bays. Example RAM corrected to the vendor\'s published 512 GB minimum.',
    sourceUrl: 'https://dataon.io/product/dataon-azs-7224-integrated-system-for-azure-stack-hci/',
    sourceTitle: 'DataON product specifications',
    reviewedAt: '2026-09-10',
  },
]

export default DATAON_PRESETS
