import { describe, it, expect } from 'vitest'
import { computeAvd } from '../avd'
import { computeSofs } from '../sofs'
import { computeCompute } from '../compute'
import { runHealthCheck } from '../healthcheck'
import { computeVolumeSummary } from '../volumes'
import { DEFAULT_ADVANCED_SETTINGS } from '../types'
import type { HardwareInputs, VolumeSpec } from '../types'

// ─── AVD Tests ────────────────────────────────────────────────────────────────

describe('AVD engine', () => {
  const BASE_AVD = {
    concurrentUsers: 0,
    growthBufferPct: 0,
    dataDiskPerHostGB: 0,
    profileStorageLocation: 's2d' as const,
  }

  it('light workload multi-session: 100 users → 7 hosts', () => {
    const result = computeAvd({
      ...BASE_AVD,
      totalUsers: 100,
      workloadType: 'light',
      multiSession: true,
      profileSizeGB: 40,
      officeContainerEnabled: false,
      officeContainerSizeGB: 0,
    })
    expect(result.sessionHostCount).toBe(7)   // ceil(100/16) = 7
    expect(result.usersPerHost).toBe(16)
    expect(result.vCpusPerHost).toBe(2)
    expect(result.memoryPerHostGB).toBe(8)
    expect(result.totalVCpus).toBe(14)
    expect(result.totalMemoryGB).toBe(56)
  })

  it('medium workload multi-session: 500 users → 63 hosts', () => {
    const result = computeAvd({
      ...BASE_AVD,
      totalUsers: 500,
      workloadType: 'medium',
      multiSession: true,
      profileSizeGB: 60,
      officeContainerEnabled: true,
      officeContainerSizeGB: 30,
    })
    expect(result.sessionHostCount).toBe(63)  // ceil(500/8) = 63
    expect(result.totalProfileStorageTB).toBeCloseTo(500 * 60 / 1024, 2)
    expect(result.totalOfficeContainerStorageTB).toBeCloseTo(500 * 30 / 1024, 2)
  })

  it('heavy workload single-session VDI: each user gets own VM', () => {
    const result = computeAvd({
      ...BASE_AVD,
      totalUsers: 50,
      workloadType: 'heavy',
      multiSession: false,
      profileSizeGB: 60,
      officeContainerEnabled: false,
      officeContainerSizeGB: 0,
    })
    expect(result.usersPerHost).toBe(1)
    expect(result.sessionHostCount).toBe(50)
  })
})

// ─── SOFS Tests ───────────────────────────────────────────────────────────────

describe('SOFS engine', () => {
  it('500 users, 40 GB profiles, 20 GB redirected folders', () => {
    const result = computeSofs({
      userCount: 500,
      concurrentUsers: 0,
      profileSizeGB: 40,
      redirectedFolderSizeGB: 20,
      containerType: 'split',
      sofsGuestVmCount: 2,
      sofsVCpusPerVm: 4,
      sofsMemoryPerVmGB: 16,
      autoSizeDrivesPerNode: 0,
      autoSizeNodes: 2,
    })
    expect(result.totalProfileStorageTB).toBeCloseTo(500 * 40 / 1024, 2)
    expect(result.totalRedirectedStorageTB).toBeCloseTo(500 * 20 / 1024, 2)
    expect(result.sofsVCpusTotal).toBe(8)
    expect(result.sofsMemoryTotalGB).toBe(32)
  })
})

// ─── Compute Tests ────────────────────────────────────────────────────────────

describe('Compute engine', () => {
  it('4-node, 32 cores, 256 GB RAM — no hyperthreading', () => {
    const hw: HardwareInputs = {
      nodeCount: 4, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84,
      cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none',
      capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256,
      hyperthreadingEnabled: false, volumeProvisioning: 'fixed',
    }
    const result = computeCompute(hw, DEFAULT_ADVANCED_SETTINGS)
    expect(result.physicalCores).toBe(128)       // 32 × 4
    expect(result.logicalCores).toBe(128)        // no HT → same as physical
    expect(result.physicalMemoryGB).toBe(1024)   // 256 × 4
    expect(result.systemReservedVCpus).toBe(16)  // 4 × 4
    // usableVCpus = (128 logical × 4 oversubscription) - 16 reserved = 496
    expect(result.usableVCpus).toBe(496)
    expect(result.usableMemoryGB).toBe(992)      // 1024 - (8 × 4)
  })

  it('4-node, 32 cores, 256 GB RAM — hyperthreading enabled doubles logical cores', () => {
    const hw: HardwareInputs = {
      nodeCount: 4, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84,
      cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none',
      capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256,
      hyperthreadingEnabled: true, volumeProvisioning: 'fixed',
    }
    const result = computeCompute(hw, DEFAULT_ADVANCED_SETTINGS)
    expect(result.physicalCores).toBe(128)       // 32 × 4
    expect(result.logicalCores).toBe(256)        // HT: 64 × 4
    // usableVCpus = (256 × 4) - 16 = 1008
    expect(result.usableVCpus).toBe(1008)
  })
})

// ─── Health Check Tests ───────────────────────────────────────────────────────

describe('Health check engine', () => {
  const hw4: HardwareInputs = {
    nodeCount: 4, capacityDrivesPerNode: 6, capacityDriveSizeTB: 3.84,
    cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none',
    capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 256,
    hyperthreadingEnabled: true, volumeProvisioning: 'fixed',
  }

  it('dual-parity on 2-node cluster → error', () => {
    const hw2: HardwareInputs = { ...hw4, nodeCount: 2 }
    const vols: VolumeSpec[] = [
      { id: '1', name: 'Vol1', resiliency: 'dual-parity', plannedSizeTB: 5 },
    ]
    const capacity = {
      nodeCount: 2, rawPoolTB: 46.08, usablePerDriveTB: 3.5328, totalUsableTB: 42.3936,
      reserveDrives: 2, reserveTB: 7.0656, infraVolumeTB: 0.5,
      availableForVolumesTB: 34.828, availableForVolumesTiB: 31.665,
      resiliencyType: 'two-way-mirror' as const, resiliencyFactor: 0.5, effectiveUsableTB: 17.41,
    }
    const compute = computeCompute(hw2, DEFAULT_ADVANCED_SETTINGS)
    const result = runHealthCheck({
      hardware: hw2, settings: DEFAULT_ADVANCED_SETTINGS,
      volumes: vols, capacity, compute,
      workloadSummary: { totalVCpus: 0, totalMemoryGB: 0, totalStorageTB: 0 },
    })
    expect(result.passed).toBe(false)
    expect(result.issues.some(i => i.code === 'HC_DUAL_PARITY_REQUIRES_4_NODES')).toBe(true)
  })

  it('over-capacity volumes → error', () => {
    const vols: VolumeSpec[] = [
      { id: '1', name: 'Vol1', resiliency: 'three-way-mirror', plannedSizeTB: 100 },
    ]
    const capacity = {
      nodeCount: 4, rawPoolTB: 92.16, usablePerDriveTB: 3.5328, totalUsableTB: 84.7872,
      reserveDrives: 4, reserveTB: 14.1312, infraVolumeTB: 0.75,
      availableForVolumesTB: 69.906, availableForVolumesTiB: 63.546,
      resiliencyType: 'three-way-mirror' as const, resiliencyFactor: 1/3, effectiveUsableTB: 23.30,
    }
    const compute = computeCompute(hw4, DEFAULT_ADVANCED_SETTINGS)
    const result = runHealthCheck({
      hardware: hw4, settings: DEFAULT_ADVANCED_SETTINGS,
      volumes: vols, capacity, compute,
      workloadSummary: { totalVCpus: 0, totalMemoryGB: 0, totalStorageTB: 0 },
    })
    expect(result.passed).toBe(false)
    expect(result.issues.some(i => i.code === 'HC_OVER_CAPACITY')).toBe(true)
  })

  it('healthy config passes with no errors', () => {
    const vols: VolumeSpec[] = [
      { id: '1', name: 'ClusterSharedVol', resiliency: 'three-way-mirror', plannedSizeTB: 10 },
    ]
    const capacity = {
      nodeCount: 4, rawPoolTB: 92.16, usablePerDriveTB: 3.5328, totalUsableTB: 84.7872,
      reserveDrives: 4, reserveTB: 14.1312, infraVolumeTB: 0.75,
      availableForVolumesTB: 69.906, availableForVolumesTiB: 63.546,
      resiliencyType: 'three-way-mirror' as const, resiliencyFactor: 1/3, effectiveUsableTB: 23.30,
    }
    const compute = computeCompute(hw4, DEFAULT_ADVANCED_SETTINGS)
    const result = runHealthCheck({
      hardware: hw4, settings: DEFAULT_ADVANCED_SETTINGS,
      volumes: vols, capacity, compute,
      workloadSummary: { totalVCpus: 100, totalMemoryGB: 400, totalStorageTB: 10 },
    })
    expect(result.passed).toBe(true)
  })
})

// ─── Volume WAC size tests ────────────────────────────────────────────────────

describe('Volume WAC size calculation', () => {
  const capacity = {
    nodeCount: 4, rawPoolTB: 92.16, usablePerDriveTB: 3.5328, totalUsableTB: 84.7872,
    reserveDrives: 4, reserveTB: 14.1312, infraVolumeTB: 0.75,
    availableForVolumesTB: 69.906, availableForVolumesTiB: 63.546,
    resiliencyType: 'three-way-mirror' as const, resiliencyFactor: 1/3, effectiveUsableTB: 23.30,
  }

  it('5 TB planned → 5120 GB WAC, 5.00 TB WAC', () => {
    const vols: VolumeSpec[] = [
      { id: '1', name: 'Test', resiliency: 'three-way-mirror', plannedSizeTB: 5 },
    ]
    const summary = computeVolumeSummary(vols, capacity)
    expect(summary.volumes[0].wacSizeGB).toBe(5120)
    expect(summary.volumes[0].wacSizeTB).toBe(5)
  })

  it('2.5 TB planned → 2560 GB WAC', () => {
    const vols: VolumeSpec[] = [
      { id: '1', name: 'Test', resiliency: 'three-way-mirror', plannedSizeTB: 2.5 },
    ]
    const summary = computeVolumeSummary(vols, capacity)
    expect(summary.volumes[0].wacSizeGB).toBe(2560)
  })
})
