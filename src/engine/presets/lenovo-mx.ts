import type { OemPreset } from '../types'

/**
 * Lenovo ThinkAgile MX-series Azure Local hardware presets.
 *
 * V3 models are Integrated Systems in the Microsoft Azure Local Solutions Catalog.
 * V4 models are Premier Solutions, jointly engineered with Microsoft.
 * https://azurelocalsolutions.azure.microsoft.com/#/catalog
 *
 * Specs are representative mid-range configurations — confirm with Lenovo
 * or the catalog before quoting.
 */
const LENOVO_MX_PRESETS: OemPreset[] = [
  // ── V4 Premier Solutions ─────────────────────────────────────────────────
  {
    id: 'lenovo-mx630-v4',
    vendor: 'Lenovo',
    model: 'ThinkAgile MX630 V4',
    catalogType: 'premier',
    generation: 'V4',
    coresPerNode: 48,
    memoryPerNodeGB: 512,
    capacityDrivesPerNode: 4,
    capacityDriveSizeTB: 7.68,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: '1U all-NVMe. Premier Solution for Azure Local, jointly engineered with Microsoft.',
  },
  {
    id: 'lenovo-mx650-v4',
    vendor: 'Lenovo',
    model: 'ThinkAgile MX650 V4',
    catalogType: 'premier',
    generation: 'V4',
    coresPerNode: 64,
    memoryPerNodeGB: 1024,
    capacityDrivesPerNode: 8,
    capacityDriveSizeTB: 7.68,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: '2U high-density all-NVMe. Premier Solution for Azure Local, jointly engineered with Microsoft.',
  },
  // ── V3 Integrated Systems ────────────────────────────────────────────────
  {
    id: 'lenovo-mx630-v3',
    vendor: 'Lenovo',
    model: 'ThinkAgile MX630 V3',
    catalogType: 'integrated',
    generation: 'V3',
    coresPerNode: 32,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 4,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: '1U all-NVMe. Integrated System for Azure Local.',
  },
  {
    id: 'lenovo-mx650-v3',
    vendor: 'Lenovo',
    model: 'ThinkAgile MX650 V3',
    catalogType: 'integrated',
    generation: 'V3',
    coresPerNode: 48,
    memoryPerNodeGB: 512,
    capacityDrivesPerNode: 8,
    capacityDriveSizeTB: 7.68,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: '2U high-density all-NVMe. Integrated System for Azure Local.',
  },
  {
    id: 'lenovo-mx650-v3-hybrid',
    vendor: 'Lenovo',
    model: 'ThinkAgile MX650 V3 (hybrid)',
    catalogType: 'integrated',
    generation: 'V3',
    coresPerNode: 48,
    memoryPerNodeGB: 512,
    capacityDrivesPerNode: 12,
    capacityDriveSizeTB: 14,
    capacityMediaType: 'hdd',
    cacheDrivesPerNode: 2,
    cacheDriveSizeTB: 1.6,
    cacheMediaType: 'nvme',
    notes: '2U NVMe cache + HDD capacity. Integrated System for Azure Local.',
  },
]

export default LENOVO_MX_PRESETS
