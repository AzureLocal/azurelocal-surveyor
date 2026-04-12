import type { OemPreset } from '../types'

/**
 * HPE ProLiant Azure Local hardware presets.
 *
 * Models listed are in the Microsoft Azure Local Solutions Catalog.
 * https://azurelocalsolutions.azure.microsoft.com/#/catalog
 *
 * HPE DL380 Gen11 was elevated to Premier Solution at Microsoft Ignite 2025.
 * HPE DL145 Gen11 is an Integrated System for edge deployments (May 2025).
 *
 * Specs are representative mid-range configurations — confirm with HPE
 * or the catalog before quoting.
 */
const HPE_PROLIANT_PRESETS: OemPreset[] = [
  // ── Premier Solutions ────────────────────────────────────────────────────
  {
    id: 'hpe-dl380-gen11',
    vendor: 'HPE',
    model: 'ProLiant DL380 Gen11',
    catalogType: 'premier',
    generation: 'Gen11',
    coresPerNode: 32,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 8,
    capacityDriveSizeTB: 7.68,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: '2U all-NVMe. Premier Solution for Azure Local (elevated at Ignite 2025).',
  },
  // ── Integrated Systems ───────────────────────────────────────────────────
  {
    id: 'hpe-dl380-gen11-hybrid',
    vendor: 'HPE',
    model: 'ProLiant DL380 Gen11 (hybrid)',
    catalogType: 'integrated',
    generation: 'Gen11',
    coresPerNode: 32,
    memoryPerNodeGB: 256,
    capacityDrivesPerNode: 8,
    capacityDriveSizeTB: 14,
    capacityMediaType: 'hdd',
    cacheDrivesPerNode: 2,
    cacheDriveSizeTB: 1.6,
    cacheMediaType: 'nvme',
    notes: '2U NVMe cache + HDD capacity. Integrated System for Azure Local.',
  },
  {
    id: 'hpe-dl145-gen11',
    vendor: 'HPE',
    model: 'ProLiant DL145 Gen11',
    catalogType: 'integrated',
    generation: 'Gen11',
    coresPerNode: 24,
    memoryPerNodeGB: 128,
    capacityDrivesPerNode: 4,
    capacityDriveSizeTB: 3.84,
    capacityMediaType: 'nvme',
    cacheDrivesPerNode: 0,
    cacheDriveSizeTB: 0,
    cacheMediaType: 'none',
    notes: 'Edge-optimized 1U AMD EPYC. Integrated System for Azure Local edge deployments (May 2025).',
  },
]

export default HPE_PROLIANT_PRESETS
