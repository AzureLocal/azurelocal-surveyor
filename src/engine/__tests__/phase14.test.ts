/**
 * Phase 14: Verification & Testing
 *
 * New automated tests covering:
 * - AKS multi-cluster compute
 * - VM storage groups volume generation
 * - Quick Start Reference calculations (rounding, 1 GiB margin, volume count cap)
 * - Per-volume resiliency mixed pool footprint
 * - Arc → AKS integration (Arc PVC folds into AKS-ArcServices-PVC)
 * - Custom workloads (internalMirrorFactor, OS disk volume, disabled exclusion)
 * - Health check: mixed fixed + thin (fixed must fit; thin over-provisioning is INFO only)
 */
import { describe, it, expect } from 'vitest'
import { computeAks } from '../aks'
import { computeAllCustomWorkloads } from '../custom-workloads'
import { computeQuickStart } from '../volumes'
import { computeVolumeSummary } from '../volumes'
import { generateWorkloadVolumes } from '../workload-volumes'
import { computeAvd } from '../avd'
import { computeCompute } from '../compute'
import { runHealthCheck } from '../healthcheck'
import { DEFAULT_ADVANCED_SETTINGS } from '../types'
import type { AksInputs, CapacityResult, HardwareInputs, VolumeSpec } from '../types'

// ─── Shared Fixtures ─────────────────────────────────────────────────────────

const EMPTY_AKS_RESULT = {
  totalNodes: 0, totalControlPlaneVCpus: 0, totalWorkerVCpus: 0, totalVCpus: 0,
  totalControlPlaneMemoryGB: 0, totalWorkerMemoryGB: 0, totalMemoryGB: 0,
  osDiskTB: 0, totalStorageTB: 0,
}

const EMPTY_AVD_RESULT = computeAvd({
  pools: [],
  userTypeMixEnabled: false,
  userTypeMix: { taskPct: 0, taskProfileGB: 15, knowledgePct: 0, knowledgeProfileGB: 40, powerPct: 0, powerProfileGB: 80 },
  growthBufferPct: 0,
})

const EMPTY_SOFS_INPUTS = {
  userCount: 0, concurrentUsers: 0, profileSizeGB: 0, redirectedFolderSizeGB: 0,
  containerType: 'split' as const, sofsGuestVmCount: 2, sofsVCpusPerVm: 4, sofsMemoryPerVmGB: 16,
  internalMirror: 'three-way' as const, autoSizeDrivesPerNode: 0, autoSizeNodes: 2,
  volumeLayout: 'shared' as const, sofsOsDiskPerVmGB: 127,
}

const EMPTY_SOFS_RESULT = {
  totalProfileStorageTB: 0, totalRedirectedStorageTB: 0, totalStorageTB: 0,
  sofsVCpusTotal: 0, sofsMemoryTotalGB: 0, internalMirrorFactor: 3, internalFootprintTB: 0,
  steadyStateIopsPerUser: 10, loginStormIopsPerUser: 50, totalSteadyStateIops: 0,
  totalLoginStormIops: 0, autoSizeDriveSizeTB: 0,
}

const EMPTY_MABS_INPUTS = {
  protectedDataTB: 0, dailyChangeRatePct: 10, onPremRetentionDays: 14, scratchCachePct: 15,
  mabsVCpus: 8, mabsMemoryGB: 32, mabsOsDiskGB: 200, internalMirror: 'two-way' as const,
}

const EMPTY_MABS_RESULT = {
  scratchVolumeTB: 0, backupDataVolumeTB: 0, totalStorageTB: 0, internalMirrorFactor: 2,
  internalFootprintTB: 0, mabsVCpus: 0, mabsMemoryGB: 0, mabsOsDiskTB: 0,
}

/** Minimal generateWorkloadVolumes input with everything disabled. Spread-override to enable specific workloads. */
function makeVolumeInputs(overrides: Partial<Parameters<typeof generateWorkloadVolumes>[0]> = {}) {
  return {
    advanced: DEFAULT_ADVANCED_SETTINGS,
    avdEnabled: false,
    avdResult: EMPTY_AVD_RESULT,
    aksEnabled: false,
    aksResult: EMPTY_AKS_RESULT,
    aksInputs: { enabled: false, clusters: [] },
    virtualMachines: { enabled: false, vCpuOvercommitRatio: 1, groups: [] },
    sofsEnabled: false,
    sofsInputs: EMPTY_SOFS_INPUTS,
    sofsResult: EMPTY_SOFS_RESULT,
    mabsEnabled: false,
    mabsInputs: EMPTY_MABS_INPUTS,
    mabsResult: EMPTY_MABS_RESULT,
    servicePresets: [],
    customWorkloads: [],
    ...overrides,
  }
}

const hw4: HardwareInputs = {
  nodeCount: 4,
  capacityDrivesPerNode: 6,
  capacityDriveSizeTB: 3.84,
  cacheDrivesPerNode: 0,
  cacheDriveSizeTB: 0,
  cacheMediaType: 'none',
  capacityMediaType: 'nvme',
  coresPerNode: 32,
  memoryPerNodeGB: 256,
  hyperthreadingEnabled: true,
}

// ─── AKS Multi-Cluster (computeAks) ──────────────────────────────────────────

describe('computeAks — multi-cluster', () => {
  it('0 clusters returns all zeros', () => {
    const result = computeAks({ enabled: false, clusters: [] })
    expect(result.totalNodes).toBe(0)
    expect(result.totalVCpus).toBe(0)
    expect(result.totalMemoryGB).toBe(0)
    expect(result.totalStorageTB).toBe(0)
  })

  it('1 cluster — control plane always 4 vCPU and 16 GB per node', () => {
    const result = computeAks({
      enabled: true,
      clusters: [{
        id: 'c1', name: 'Prod',
        controlPlaneNodesPerCluster: 3,
        workerNodesPerCluster: 0,
        vCpusPerWorker: 4,
        memoryPerWorkerGB: 16,
        osDiskPerNodeGB: 200,
        persistentVolumesTB: 0,
      }],
    })
    // 3 CP nodes × 4 vCPU = 12; 3 CP nodes × 16 GB = 48 GB
    expect(result.totalControlPlaneVCpus).toBe(12)
    expect(result.totalControlPlaneMemoryGB).toBe(48)
    expect(result.totalWorkerVCpus).toBe(0)
    expect(result.totalWorkerMemoryGB).toBe(0)
    expect(result.totalVCpus).toBe(12)
    expect(result.totalMemoryGB).toBe(48)
    expect(result.totalNodes).toBe(3)
  })

  it('1 cluster — worker resources are user-specified', () => {
    const result = computeAks({
      enabled: true,
      clusters: [{
        id: 'c1', name: 'Dev',
        controlPlaneNodesPerCluster: 1,
        workerNodesPerCluster: 4,
        vCpusPerWorker: 8,
        memoryPerWorkerGB: 32,
        osDiskPerNodeGB: 150,
        persistentVolumesTB: 2,
      }],
    })
    // CP: 1 × 4 = 4 vCPU, 1 × 16 = 16 GB
    // Workers: 4 × 8 = 32 vCPU, 4 × 32 = 128 GB
    expect(result.totalControlPlaneVCpus).toBe(4)
    expect(result.totalWorkerVCpus).toBe(32)
    expect(result.totalControlPlaneMemoryGB).toBe(16)
    expect(result.totalWorkerMemoryGB).toBe(128)
    expect(result.totalVCpus).toBe(36)
    expect(result.totalMemoryGB).toBe(144)
    expect(result.totalNodes).toBe(5)
    // OS disk: 5 nodes × 150 GB = 750 GB = 0.73 TB
    expect(result.osDiskTB).toBeCloseTo(0.73, 1)
    expect(result.totalStorageTB).toBeCloseTo(0.73 + 2, 1)
  })

  it('3 clusters — aggregates compute and storage from all clusters', () => {
    const result = computeAks({
      enabled: true,
      clusters: [
        {
          id: 'c1', name: 'Prod',
          controlPlaneNodesPerCluster: 1, workerNodesPerCluster: 5,
          vCpusPerWorker: 4, memoryPerWorkerGB: 16, osDiskPerNodeGB: 200, persistentVolumesTB: 5,
        },
        {
          id: 'c2', name: 'Dev',
          controlPlaneNodesPerCluster: 1, workerNodesPerCluster: 3,
          vCpusPerWorker: 4, memoryPerWorkerGB: 16, osDiskPerNodeGB: 200, persistentVolumesTB: 1,
        },
        {
          id: 'c3', name: 'Test',
          controlPlaneNodesPerCluster: 1, workerNodesPerCluster: 2,
          vCpusPerWorker: 4, memoryPerWorkerGB: 16, osDiskPerNodeGB: 200, persistentVolumesTB: 0.5,
        },
      ],
    })
    // Total CP: 3 × 1 = 3 nodes, 3 × 4 = 12 vCPU, 3 × 16 = 48 GB
    // Total workers: (5+3+2) = 10 nodes, 10 × 4 = 40 vCPU, 10 × 16 = 160 GB
    expect(result.totalControlPlaneVCpus).toBe(12)
    expect(result.totalWorkerVCpus).toBe(40)
    expect(result.totalVCpus).toBe(52)
    expect(result.totalControlPlaneMemoryGB).toBe(48)
    expect(result.totalWorkerMemoryGB).toBe(160)
    expect(result.totalMemoryGB).toBe(208)
    expect(result.totalNodes).toBe(13)
    // PVC: 5 + 1 + 0.5 = 6.5 TB
    // OS: 13 nodes × 200 GB = 2600 GB = 2.54 TB
    expect(result.osDiskTB).toBeCloseTo(2.54, 1)
    expect(result.totalStorageTB).toBeCloseTo(2.54 + 6.5, 1)
  })
})

// ─── VM Storage Groups — Volume Generation ───────────────────────────────────

describe('VM storage groups — volume generation', () => {
  it('1 group generates one VM-{name} volume', () => {
    const suggestions = generateWorkloadVolumes(makeVolumeInputs({
      virtualMachines: {
        enabled: true,
        vCpuOvercommitRatio: 1,
        groups: [{
          id: 'g1', name: 'Web Tier',
          vmCount: 10, vCpusPerVm: 4, memoryPerVmGB: 16, storagePerVmGB: 200,
        }],
      },
    }))
    const vmVols = suggestions.filter((s) => s.source === 'Virtual Machines')
    expect(vmVols).toHaveLength(1)
    // safeName strips spaces: "Web Tier" → "WebTier"
    expect(vmVols[0].name).toBe('VM-WebTier')
    // 10 × 200 GB = 2000 GB = 1.95 TB
    expect(vmVols[0].plannedSizeTB).toBeCloseTo(1.95, 1)
    expect(vmVols[0].provisioning).toBe('fixed')
  })

  it('3 groups generate 3 separate volumes (1 per group)', () => {
    const suggestions = generateWorkloadVolumes(makeVolumeInputs({
      virtualMachines: {
        enabled: true,
        vCpuOvercommitRatio: 1,
        groups: [
          { id: 'g1', name: 'Frontend', vmCount: 5, vCpusPerVm: 2, memoryPerVmGB: 8, storagePerVmGB: 100 },
          { id: 'g2', name: 'Backend', vmCount: 8, vCpusPerVm: 4, memoryPerVmGB: 16, storagePerVmGB: 200 },
          { id: 'g3', name: 'Database', vmCount: 3, vCpusPerVm: 8, memoryPerVmGB: 32, storagePerVmGB: 500 },
        ],
      },
    }))
    const vmVols = suggestions.filter((s) => s.source === 'Virtual Machines')
    expect(vmVols).toHaveLength(3)
    expect(vmVols.some((v) => v.name === 'VM-Frontend')).toBe(true)
    expect(vmVols.some((v) => v.name === 'VM-Backend')).toBe(true)
    expect(vmVols.some((v) => v.name === 'VM-Database')).toBe(true)
    // Frontend: 5 × 100 GB = 500 GB = 0.49 TB
    expect(vmVols.find((v) => v.name === 'VM-Frontend')?.plannedSizeTB).toBeCloseTo(0.49, 1)
    // Database: 3 × 500 GB = 1500 GB = 1.46 TB
    expect(vmVols.find((v) => v.name === 'VM-Database')?.plannedSizeTB).toBeCloseTo(1.46, 1)
  })

  it('group with storagePerVmGB of 0 produces no volume', () => {
    const suggestions = generateWorkloadVolumes(makeVolumeInputs({
      virtualMachines: {
        enabled: true,
        vCpuOvercommitRatio: 1,
        groups: [
          { id: 'g1', name: 'NoStorage', vmCount: 5, vCpusPerVm: 2, memoryPerVmGB: 8, storagePerVmGB: 0 },
          { id: 'g2', name: 'WithStorage', vmCount: 5, vCpusPerVm: 2, memoryPerVmGB: 8, storagePerVmGB: 100 },
        ],
      },
    }))
    const vmVols = suggestions.filter((s) => s.source === 'Virtual Machines')
    // 0-storage group filtered out; only 1 volume for WithStorage
    expect(vmVols).toHaveLength(1)
    expect(vmVols[0].name).toBe('VM-WithStorage')
  })
})

// ─── Quick Start Reference (computeQuickStart) ───────────────────────────────

describe('computeQuickStart — reference rows', () => {
  /** Capacity fixture with a round 60 TB available for predictable math. */
  const CAPACITY_60TB: CapacityResult = {
    nodeCount: 4,
    rawPoolTB: 92.16,
    usablePerDriveTB: 3.5328,
    totalUsableTB: 84.7872,
    reserveDrives: 4,
    reserveTB: 14.1312,
    infraVolumeTB: 0.75,
    availableForVolumesTB: 60,
    availableForVolumesTiB: 54.55,
    resiliencyType: 'three-way-mirror',
    resiliencyFactor: 1 / 3,
    effectiveUsableTB: 20,
  }

  it('always generates exactly 2 rows: three-way then two-way', () => {
    const result = computeQuickStart(CAPACITY_60TB)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].resiliency).toBe('three-way-mirror')
    expect(result.rows[1].resiliency).toBe('two-way-mirror')
  })

  it('three-way-mirror row: calculatorSizeTB = availableForVolumesTB / 3 / volumeCount', () => {
    const result = computeQuickStart(CAPACITY_60TB)
    const row3x = result.rows[0]
    // 4 nodes → 4 volumes; 60 TB / 3 / 4 = 5 TB
    expect(row3x.volumeCount).toBe(4)
    expect(row3x.calculatorSizeTB).toBe(5)
  })

  it('two-way-mirror row: calculatorSizeTB = availableForVolumesTB × 0.5 / volumeCount', () => {
    const result = computeQuickStart(CAPACITY_60TB)
    const row2x = result.rows[1]
    // 60 TB × 0.5 / 4 = 7.5 TB
    expect(row2x.volumeCount).toBe(4)
    expect(row2x.calculatorSizeTB).toBe(7.5)
  })

  it('wacSizeGiB applies 1 GiB safety margin: floor(rawGiB) - 1', () => {
    const result = computeQuickStart(CAPACITY_60TB)
    const row3x = result.rows[0]
    // calcSizeTB=5 → rawGiB = 5 × (1e12/1024^3) = 5 × 931.3226 = 4656.61 → floor = 4656 → -1 = 4655
    expect(row3x.wacSizeGiB).toBe(4655)
    const row2x = result.rows[1]
    // calcSizeTB=7.5 → rawGiB = 7.5 × 931.3226 = 6984.92 → floor = 6984 → -1 = 6983
    expect(row2x.wacSizeGiB).toBe(6983)
  })

  it('volumeCount is capped at 16 for large clusters', () => {
    const largeCap: CapacityResult = {
      ...CAPACITY_60TB,
      nodeCount: 20,  // exceeds cap
    }
    const result = computeQuickStart(largeCap)
    expect(result.rows[0].volumeCount).toBe(16)
    expect(result.rows[1].volumeCount).toBe(16)
  })

  it('returns empty rows when availableForVolumesTB is 0', () => {
    const zeroCap: CapacityResult = {
      ...CAPACITY_60TB,
      availableForVolumesTB: 0,
    }
    const result = computeQuickStart(zeroCap)
    expect(result.rows).toHaveLength(0)
  })

  it('psScript references Three-Way Mirror primary row', () => {
    const result = computeQuickStart(CAPACITY_60TB)
    expect(result.psScript).toContain('New-Volume')
    expect(result.psScript).toContain('-PhysicalDiskRedundancy 2')
    expect(result.psScript).toContain(`${result.rows[0].wacSizeGiB}GB`)
  })
})

// ─── Per-Volume Resiliency — Mixed Pool Footprint ────────────────────────────

describe('computeVolumeSummary — mixed resiliency pool footprint', () => {
  const capacity: CapacityResult = {
    nodeCount: 4,
    rawPoolTB: 92.16,
    usablePerDriveTB: 3.5328,
    totalUsableTB: 84.7872,
    reserveDrives: 4,
    reserveTB: 14.1312,
    infraVolumeTB: 0.75,
    availableForVolumesTB: 60,
    availableForVolumesTiB: 54.55,
    resiliencyType: 'three-way-mirror',
    resiliencyFactor: 1 / 3,
    effectiveUsableTB: 20,
  }

  it('uses per-volume resiliency factor, not global resiliency', () => {
    const vols: VolumeSpec[] = [
      // Three-way-mirror: pool footprint = 10 / (1/3) = 30 TB
      { id: '1', name: 'UserData', resiliency: 'three-way-mirror', provisioning: 'fixed', plannedSizeTB: 10 },
      // Two-way-mirror: pool footprint = 10 / 0.5 = 20 TB
      { id: '2', name: 'OSDisks', resiliency: 'two-way-mirror', provisioning: 'fixed', plannedSizeTB: 10 },
    ]
    const summary = computeVolumeSummary(vols, capacity)
    // Total pool footprint = 30 + 20 = 50 TB (not 60 TB which would result from global 3WM)
    expect(summary.totalPoolFootprintTB).toBe(50)
    expect(summary.totalPlannedTB).toBe(20)
  })

  it('all three-way-mirror volumes use factor 1/3', () => {
    const vols: VolumeSpec[] = [
      { id: '1', name: 'Vol1', resiliency: 'three-way-mirror', provisioning: 'fixed', plannedSizeTB: 6 },
      { id: '2', name: 'Vol2', resiliency: 'three-way-mirror', provisioning: 'fixed', plannedSizeTB: 6 },
    ]
    const summary = computeVolumeSummary(vols, capacity)
    // Pool footprint = 6/(1/3) + 6/(1/3) = 18 + 18 = 36 TB
    expect(summary.totalPoolFootprintTB).toBe(36)
    expect(summary.utilizationPct).toBeCloseTo(60, 0)  // 36/60 = 60%
  })
})

// ─── Arc → AKS Integration ───────────────────────────────────────────────────

describe('Arc service presets → AKS volume integration', () => {
  it('Arc preset with requiresAks=true folds into AKS-ArcServices-PVC when AKS is enabled', () => {
    const aksInputs: AksInputs = {
      enabled: true,
      clusters: [{
        id: 'c1', name: 'Prod',
        controlPlaneNodesPerCluster: 1, workerNodesPerCluster: 3,
        vCpusPerWorker: 4, memoryPerWorkerGB: 16, osDiskPerNodeGB: 200, persistentVolumesTB: 0,
      }],
    }
    const aksResult = computeAks(aksInputs)

    const suggestions = generateWorkloadVolumes(makeVolumeInputs({
      aksEnabled: true,
      aksResult,
      aksInputs,
      servicePresets: [{
        id: 'sp1',
        catalogId: 'arc-sql-mi-gp',   // requiresAks: true, defaultStorageTBPerInstance: 0.5
        enabled: true,
        instanceCount: 2,
      }],
    }))

    // Arc SQL MI (requiresAks) storage should fold into AKS-ArcServices-PVC
    const arcPvc = suggestions.find((s) => s.name === 'AKS-ArcServices-PVC')
    expect(arcPvc).toBeDefined()
    // 2 instances × 0.5 TB = 1 TB
    expect(arcPvc?.plannedSizeTB).toBe(1)
    expect(arcPvc?.source).toBe('AKS')

    // No standalone Svc-* volume for AKS-dependent preset
    expect(suggestions.some((s) => s.source === 'Service Presets')).toBe(false)
  })

  it('AKS-dependent Arc preset generates standalone Svc volume when AKS is disabled', () => {
    const suggestions = generateWorkloadVolumes(makeVolumeInputs({
      aksEnabled: false,     // AKS is OFF
      servicePresets: [{
        id: 'sp1',
        catalogId: 'arc-sql-mi-gp',  // requiresAks: true
        enabled: true,
        instanceCount: 1,
      }],
    }))

    // When AKS is disabled, the Arc preset is treated as a standalone service volume
    const svcVol = suggestions.find((s) => s.source === 'Service Presets')
    expect(svcVol).toBeDefined()
    // AKS-ArcServices-PVC should NOT appear (AKS is disabled)
    expect(suggestions.some((s) => s.name === 'AKS-ArcServices-PVC')).toBe(false)
  })
})

// ─── Custom Workloads ─────────────────────────────────────────────────────────

describe('computeAllCustomWorkloads', () => {
  it('internalMirrorFactor is applied to storage total', () => {
    const result = computeAllCustomWorkloads([{
      id: 'cw1', name: 'App', description: '', enabled: true,
      vmCount: 5, vCpusPerVm: 4, memoryPerVmGB: 16, osDiskPerVmGB: 100,
      storageTB: 2,
      internalMirrorFactor: 3,  // three-way internal mirror
      bandwidthMbps: 0,
    }])
    // Storage footprint = 2 × 3 = 6 TB
    // OS disk = 5 × 100 GB = 0.49 TB
    expect(result.totalStorageTB).toBeCloseTo(0.49 + 6, 1)
    expect(result.totalVCpus).toBe(20)    // 5 × 4
    expect(result.totalMemoryGB).toBe(80) // 5 × 16
  })

  it('disabled workload is excluded from totals', () => {
    const result = computeAllCustomWorkloads([
      {
        id: 'cw1', name: 'Active', description: '', enabled: true,
        vmCount: 3, vCpusPerVm: 4, memoryPerVmGB: 16, osDiskPerVmGB: 0,
        storageTB: 1, internalMirrorFactor: 1, bandwidthMbps: 0,
      },
      {
        id: 'cw2', name: 'Inactive', description: '', enabled: false,
        vmCount: 10, vCpusPerVm: 8, memoryPerVmGB: 32, osDiskPerVmGB: 200,
        storageTB: 5, internalMirrorFactor: 2, bandwidthMbps: 0,
      },
    ])
    expect(result.totalVCpus).toBe(12)   // only Active (3×4)
    expect(result.totalMemoryGB).toBe(48) // only Active (3×16)
    expect(result.totalStorageTB).toBe(1) // only Active (1×1)
  })
})

describe('Custom workload — volume generation', () => {
  it('OS disk volume generated when osDiskPerVmGB > 0', () => {
    const suggestions = generateWorkloadVolumes(makeVolumeInputs({
      customWorkloads: [{
        id: 'cw1', name: 'My App', description: '', enabled: true,
        vmCount: 4, vCpusPerVm: 2, memoryPerVmGB: 8, osDiskPerVmGB: 127,
        storageTB: 1, internalMirrorFactor: 1, bandwidthMbps: 0,
      }],
    }))
    const cwVols = suggestions.filter((s) => s.source === 'Custom Workloads')
    const osVol = cwVols.find((v) => v.name === 'MyApp-OsDisk')
    expect(osVol).toBeDefined()
    expect(osVol?.resiliency).toBe('three-way-mirror')
    // 4 × 127 GB = 508 GB = 0.50 TB
    expect(osVol?.plannedSizeTB).toBeCloseTo(0.5, 1)
  })

  it('no OS disk volume when osDiskPerVmGB === 0', () => {
    const suggestions = generateWorkloadVolumes(makeVolumeInputs({
      customWorkloads: [{
        id: 'cw1', name: 'StatelessApp', description: '', enabled: true,
        vmCount: 5, vCpusPerVm: 4, memoryPerVmGB: 8, osDiskPerVmGB: 0,
        storageTB: 2, internalMirrorFactor: 1, bandwidthMbps: 0,
      }],
    }))
    const cwVols = suggestions.filter((s) => s.source === 'Custom Workloads')
    expect(cwVols.some((v) => v.name.endsWith('-OsDisk'))).toBe(false)
    // Data volume still generated
    expect(cwVols.some((v) => v.name === 'StatelessApp-Data')).toBe(true)
  })

  it('internalMirrorFactor applied to data volume size', () => {
    const suggestions = generateWorkloadVolumes(makeVolumeInputs({
      customWorkloads: [{
        id: 'cw1', name: 'MirroredApp', description: '', enabled: true,
        vmCount: 1, vCpusPerVm: 4, memoryPerVmGB: 16, osDiskPerVmGB: 0,
        storageTB: 4,
        internalMirrorFactor: 2,  // two-way internal mirror
        bandwidthMbps: 0,
      }],
    }))
    const dataVol = suggestions.find((s) => s.name === 'MirroredApp-Data')
    expect(dataVol).toBeDefined()
    // 4 TB × 2 = 8 TB
    expect(dataVol?.plannedSizeTB).toBe(8)
  })

  it('disabled custom workload generates no volumes', () => {
    const suggestions = generateWorkloadVolumes(makeVolumeInputs({
      customWorkloads: [{
        id: 'cw1', name: 'Disabled', description: '', enabled: false,
        vmCount: 5, vCpusPerVm: 4, memoryPerVmGB: 16, osDiskPerVmGB: 200,
        storageTB: 10, internalMirrorFactor: 3, bandwidthMbps: 0,
      }],
    }))
    expect(suggestions.filter((s) => s.source === 'Custom Workloads')).toHaveLength(0)
  })
})

// ─── Health Check — Mixed Fixed + Thin ───────────────────────────────────────

describe('runHealthCheck — mixed fixed + thin provisioning', () => {
  const capacity: CapacityResult = {
    nodeCount: 4,
    rawPoolTB: 92.16,
    usablePerDriveTB: 3.5328,
    totalUsableTB: 84.7872,
    reserveDrives: 4,
    reserveTB: 14.1312,
    infraVolumeTB: 0.75,
    availableForVolumesTB: 20,
    availableForVolumesTiB: 18.18,
    resiliencyType: 'three-way-mirror',
    resiliencyFactor: 1 / 3,
    effectiveUsableTB: 6.67,
  }

  it('fixed vol fits + thin over-provisioned → passed=true with info (not error)', () => {
    // Fixed 3WM 6 TB: footprint = 6/(1/3) = 18 TB ≤ 20 TB availableForVolumesTB → fits
    // Thin 3WM 20 TB: logical = 20 TB > effectiveUsableTB (6.67 TB) → HC_THIN_OVER_PROVISIONED info
    const vols: VolumeSpec[] = [
      { id: '1', name: 'FixedData', resiliency: 'three-way-mirror', provisioning: 'fixed', plannedSizeTB: 6 },
      { id: '2', name: 'ThinLogs', resiliency: 'three-way-mirror', provisioning: 'thin', plannedSizeTB: 20 },
    ]
    const compute = computeCompute(hw4, DEFAULT_ADVANCED_SETTINGS)
    const result = runHealthCheck({
      hardware: hw4, settings: DEFAULT_ADVANCED_SETTINGS,
      volumes: vols, capacity, compute,
      workloadSummary: { totalVCpus: 0, totalMemoryGB: 0, totalStorageTB: 0 },
    })
    // Fixed volumes DO fit → no HC_OVER_CAPACITY
    expect(result.issues.some((i) => i.code === 'HC_OVER_CAPACITY')).toBe(false)
    // Thin over-provisioned → HC_THIN_OVER_PROVISIONED info
    const thinIssue = result.issues.find((i) => i.code === 'HC_THIN_OVER_PROVISIONED')
    expect(thinIssue).toBeDefined()
    expect(thinIssue?.severity).toBe('info')
    // Health check overall: no errors → passed=true
    expect(result.passed).toBe(true)
  })

  it('fixed vol does NOT fit → HC_OVER_CAPACITY error regardless of thin volumes', () => {
    // Fixed 3WM 8 TB: footprint = 8/(1/3) = 24 TB > 20 TB availableForVolumesTB → error
    // Thin 3WM 1 TB: logical = 1 TB ≤ effectiveUsableTB → no thin issue
    const vols: VolumeSpec[] = [
      { id: '1', name: 'HugeFixed', resiliency: 'three-way-mirror', provisioning: 'fixed', plannedSizeTB: 8 },
      { id: '2', name: 'SmallThin', resiliency: 'three-way-mirror', provisioning: 'thin', plannedSizeTB: 1 },
    ]
    const compute = computeCompute(hw4, DEFAULT_ADVANCED_SETTINGS)
    const result = runHealthCheck({
      hardware: hw4, settings: DEFAULT_ADVANCED_SETTINGS,
      volumes: vols, capacity, compute,
      workloadSummary: { totalVCpus: 0, totalMemoryGB: 0, totalStorageTB: 0 },
    })
    expect(result.issues.some((i) => i.code === 'HC_OVER_CAPACITY')).toBe(true)
    expect(result.issues.find((i) => i.code === 'HC_OVER_CAPACITY')?.severity).toBe('error')
    expect(result.passed).toBe(false)
  })
})

// ─── SOFS per-VM Mode (3 VMs) ────────────────────────────────────────────────

describe('SOFS per-VM mode with 3 VMs', () => {
  it('generates 3 data volumes + 3 OS disk volumes (6 total)', () => {
    const suggestions = generateWorkloadVolumes(makeVolumeInputs({
      sofsEnabled: true,
      sofsInputs: {
        ...EMPTY_SOFS_INPUTS,
        userCount: 150,
        profileSizeGB: 40,
        sofsGuestVmCount: 3,
        internalMirror: 'three-way',
        volumeLayout: 'per-vm',
        sofsOsDiskPerVmGB: 127,
      },
      sofsResult: {
        ...EMPTY_SOFS_RESULT,
        totalProfileStorageTB: 5.86,
        totalStorageTB: 5.86,
        internalMirrorFactor: 3,
        internalFootprintTB: 17.58,
        sofsVCpusTotal: 12,
        sofsMemoryTotalGB: 48,
      },
    }))

    const sofsVols = suggestions.filter((s) => s.source === 'SOFS')
    expect(sofsVols).toHaveLength(6)  // 3 data + 3 OS disk

    // Each VM gets a data volume
    expect(sofsVols.some((v) => v.name === 'SOFS-VM1-Data')).toBe(true)
    expect(sofsVols.some((v) => v.name === 'SOFS-VM2-Data')).toBe(true)
    expect(sofsVols.some((v) => v.name === 'SOFS-VM3-Data')).toBe(true)
    // Each VM gets an OS disk volume
    expect(sofsVols.some((v) => v.name === 'SOFS-VM1-OsDisk')).toBe(true)
    expect(sofsVols.some((v) => v.name === 'SOFS-VM2-OsDisk')).toBe(true)
    expect(sofsVols.some((v) => v.name === 'SOFS-VM3-OsDisk')).toBe(true)

    // Total data volumes sum = internalFootprintTB = 17.58 TB
    const dataTotal = sofsVols
      .filter((v) => v.name.endsWith('-Data'))
      .reduce((sum, v) => sum + v.plannedSizeTB, 0)
    expect(Math.abs(dataTotal - 17.58)).toBeLessThan(0.1)

    // OS disk: each VM = 127 GB = 0.12 TB
    const osVols = sofsVols.filter((v) => v.name.endsWith('-OsDisk'))
    expect(osVols.every((v) => v.resiliency === 'three-way-mirror')).toBe(true)
    expect(Math.abs(osVols[0].plannedSizeTB - 0.12)).toBeLessThan(0.02)
  })
})
