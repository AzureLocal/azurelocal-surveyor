import { describe, it, expect } from 'vitest'
import { computeAvd } from '../avd'
import { computeSofs } from '../sofs'
import { computeCompute } from '../compute'
import { runHealthCheck, runComputeHealthCheck } from '../healthcheck'
import { computeVolumeSummary } from '../volumes'
import { generateWorkloadVolumes } from '../workload-volumes'
import { DEFAULT_ADVANCED_SETTINGS } from '../types'
import type { AvdHostPool, ComputeResult, HardwareInputs, VolumeSpec } from '../types'

// ─── AVD Tests ────────────────────────────────────────────────────────────────

describe('AVD engine', () => {
  const BASE_POOL: AvdHostPool = {
    id: 'pool-1',
    name: 'Host Pool 1',
    totalUsers: 100,
    concurrentUsers: 0,
    workloadType: 'medium',
    multiSession: true,
    fslogixEnabled: true,
    profileSizeGB: 40,
    officeContainerEnabled: false,
    officeContainerSizeGB: 0,
    dataDiskPerHostGB: 0,
    profileStorageLocation: 'sofs' as const,
  }

  const BASE_AVD = {
    pools: [BASE_POOL],
    growthBufferPct: 0,
    userTypeMixEnabled: false,
    userTypeMix: { taskPct: 30, taskProfileGB: 15, knowledgePct: 50, knowledgeProfileGB: 40, powerPct: 20, powerProfileGB: 80 },
  }

  function makeAvd(pool: Partial<AvdHostPool>) {
    return {
      ...BASE_AVD,
      pools: [{ ...BASE_POOL, ...pool }],
    }
  }

  it('light workload multi-session: 100 users → 7 hosts', () => {
    const result = computeAvd(makeAvd({
      totalUsers: 100,
      workloadType: 'light',
      multiSession: true,
      profileSizeGB: 40,
      officeContainerEnabled: false,
      officeContainerSizeGB: 0,
    }))
    expect(result.sessionHostCount).toBe(7)   // ceil(100/16) = 7
    expect(result.usersPerHost).toBe(16)
    expect(result.vCpusPerHost).toBe(2)
    expect(result.memoryPerHostGB).toBe(8)
    expect(result.totalVCpus).toBe(14)
    expect(result.totalMemoryGB).toBe(56)
  })

  it('medium workload multi-session: 500 users → 63 hosts', () => {
    const result = computeAvd(makeAvd({
      totalUsers: 500,
      workloadType: 'medium',
      multiSession: true,
      profileSizeGB: 60,
      officeContainerEnabled: true,
      officeContainerSizeGB: 30,
    }))
    expect(result.sessionHostCount).toBe(63)  // ceil(500/8) = 63
    expect(result.totalProfileStorageTB).toBeCloseTo(500 * 60 / 1024, 2)
    expect(result.totalOfficeContainerStorageTB).toBeCloseTo(500 * 30 / 1024, 2)
  })

  it('heavy workload single-session VDI: each user gets own VM', () => {
    const result = computeAvd(makeAvd({
      totalUsers: 50,
      workloadType: 'heavy',
      multiSession: false,
      profileSizeGB: 60,
      officeContainerEnabled: false,
      officeContainerSizeGB: 0,
    }))
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
      internalMirror: 'three-way',
      autoSizeDrivesPerNode: 0,
      autoSizeNodes: 2,
      volumeLayout: 'shared',
      sofsOsDiskPerVmGB: 127,
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
      hyperthreadingEnabled: false,
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
      hyperthreadingEnabled: true,
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
    hyperthreadingEnabled: true,
  }

  it('dual-parity on 2-node cluster → error', () => {
    const hw2: HardwareInputs = { ...hw4, nodeCount: 2 }
    const vols: VolumeSpec[] = [
      { id: '1', name: 'Vol1', resiliency: 'dual-parity', provisioning: 'fixed', plannedSizeTB: 5 },
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
      { id: '1', name: 'Vol1', resiliency: 'three-way-mirror', provisioning: 'fixed', plannedSizeTB: 100 },
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
    expect(result.issues.find(i => i.code === 'HC_OVER_CAPACITY')?.details?.[0].status).toBe('fail')
    expect(result.volumeDetails[0].checks.length).toBeGreaterThan(0)
    expect(result.volumeDetails[0].checks.some((check) => check.label === 'Per-volume size limit')).toBe(true)
  })

  it('healthy config passes with no errors', () => {
    const vols: VolumeSpec[] = [
      { id: '1', name: 'ClusterSharedVol', resiliency: 'three-way-mirror', provisioning: 'fixed', plannedSizeTB: 10 },
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
    expect(result.volumeDetails[0].checks.every((check) => check.status === 'pass')).toBe(true)
  })

  it('12H: thin volume over logical capacity → HC_THIN_OVER_PROVISIONED info, not error', () => {
    // effectiveUsableTB = 23.30, but we plan 30 TB logically with thin provisioning
    const capacity = {
      nodeCount: 4, rawPoolTB: 92.16, usablePerDriveTB: 3.5328, totalUsableTB: 84.7872,
      reserveDrives: 4, reserveTB: 14.1312, infraVolumeTB: 0.75,
      availableForVolumesTB: 69.906, availableForVolumesTiB: 63.546,
      resiliencyType: 'three-way-mirror' as const, resiliencyFactor: 1/3, effectiveUsableTB: 23.30,
    }
    const vols: VolumeSpec[] = [
      { id: '1', name: 'ThinVol', resiliency: 'three-way-mirror', provisioning: 'thin', plannedSizeTB: 30 },
    ]
    const compute = computeCompute(hw4, DEFAULT_ADVANCED_SETTINGS)
    const result = runHealthCheck({
      hardware: hw4, settings: DEFAULT_ADVANCED_SETTINGS,
      volumes: vols, capacity, compute,
      workloadSummary: { totalVCpus: 0, totalMemoryGB: 0, totalStorageTB: 0 },
    })
    // Should NOT fire HC_OVER_CAPACITY (thin volumes are allowed to over-provision logically)
    expect(result.issues.some(i => i.code === 'HC_OVER_CAPACITY')).toBe(false)
    // Should fire HC_THIN_OVER_PROVISIONED as info
    const thinIssue = result.issues.find(i => i.code === 'HC_THIN_OVER_PROVISIONED')
    expect(thinIssue).toBeDefined()
    expect(thinIssue?.severity).toBe('info')
  })

  it('12H: fixed volume pool footprint exceeds available pool → HC_OVER_CAPACITY error', () => {
    // availableForVolumesTB = 23.30; 3WM footprint of 20 TB = 20/0.333 = 60 TB → exceeds pool
    const capacity = {
      nodeCount: 4, rawPoolTB: 92.16, usablePerDriveTB: 3.5328, totalUsableTB: 84.7872,
      reserveDrives: 4, reserveTB: 14.1312, infraVolumeTB: 0.75,
      availableForVolumesTB: 23.30, availableForVolumesTiB: 21.18,
      resiliencyType: 'three-way-mirror' as const, resiliencyFactor: 1/3, effectiveUsableTB: 7.77,
    }
    const vols: VolumeSpec[] = [
      { id: '1', name: 'FixedVol', resiliency: 'three-way-mirror', provisioning: 'fixed', plannedSizeTB: 20 },
    ]
    const compute = computeCompute(hw4, DEFAULT_ADVANCED_SETTINGS)
    const result = runHealthCheck({
      hardware: hw4, settings: DEFAULT_ADVANCED_SETTINGS,
      volumes: vols, capacity, compute,
      workloadSummary: { totalVCpus: 0, totalMemoryGB: 0, totalStorageTB: 0 },
    })
    expect(result.passed).toBe(false)
    expect(result.issues.some(i => i.code === 'HC_OVER_CAPACITY')).toBe(true)
    expect(result.issues.find(i => i.code === 'HC_OVER_CAPACITY')?.severity).toBe('error')
  })

  it('12H: no HC_VCPU or HC_MEMORY codes emitted (moved to Phase 13)', () => {
    const vols: VolumeSpec[] = [
      { id: '1', name: 'Vol', resiliency: 'three-way-mirror', provisioning: 'fixed', plannedSizeTB: 1 },
    ]
    const capacity = {
      nodeCount: 4, rawPoolTB: 92.16, usablePerDriveTB: 3.5328, totalUsableTB: 84.7872,
      reserveDrives: 4, reserveTB: 14.1312, infraVolumeTB: 0.75,
      availableForVolumesTB: 69.906, availableForVolumesTiB: 63.546,
      resiliencyType: 'three-way-mirror' as const, resiliencyFactor: 1/3, effectiveUsableTB: 23.30,
    }
    const compute = computeCompute(hw4, DEFAULT_ADVANCED_SETTINGS)
    // Deliberately oversubscribe both vCPU and memory — should not appear in volume health check
    const result = runHealthCheck({
      hardware: hw4, settings: DEFAULT_ADVANCED_SETTINGS,
      volumes: vols, capacity, compute,
      workloadSummary: { totalVCpus: 99999, totalMemoryGB: 99999, totalStorageTB: 1 },
    })
    const codes = result.issues.map(i => i.code)
    expect(codes.some(c => c.startsWith('HC_VCPU'))).toBe(false)
    expect(codes.some(c => c.startsWith('HC_MEMORY'))).toBe(false)
  })
})

describe('Workload volume suggestions', () => {
  it('MABS generates Scratch (fixed), BackupData (thin), and OsDisk volumes', () => {
    const suggestions = generateWorkloadVolumes({
      advanced: DEFAULT_ADVANCED_SETTINGS,
      avdEnabled: false,
      avdResult: computeAvd({
        pools: [{
          id: 'pool-1',
          name: 'Host Pool 1',
          totalUsers: 1,
          concurrentUsers: 0,
          workloadType: 'light',
          multiSession: true,
          fslogixEnabled: true,
          profileSizeGB: 10,
          officeContainerEnabled: false,
          officeContainerSizeGB: 0,
          dataDiskPerHostGB: 0,
          profileStorageLocation: 'sofs',
        }],
        userTypeMixEnabled: false,
        userTypeMix: { taskPct: 30, taskProfileGB: 15, knowledgePct: 50, knowledgeProfileGB: 40, powerPct: 20, powerProfileGB: 80 },
        growthBufferPct: 0,
      }),
      aksEnabled: false,
      aksResult: { totalNodes: 0, totalControlPlaneVCpus: 0, totalWorkerVCpus: 0, totalVCpus: 0, totalControlPlaneMemoryGB: 0, totalWorkerMemoryGB: 0, totalMemoryGB: 0, osDiskTB: 0, totalStorageTB: 0 },
      aksInputs: { enabled: false, clusters: [] },
      virtualMachines: { enabled: false, vCpuOvercommitRatio: 1, groups: [] },
      sofsEnabled: false,
      sofsInputs: { userCount: 0, concurrentUsers: 0, profileSizeGB: 0, redirectedFolderSizeGB: 0, containerType: 'split', sofsGuestVmCount: 2, sofsVCpusPerVm: 4, sofsMemoryPerVmGB: 16, internalMirror: 'three-way', autoSizeDrivesPerNode: 4, autoSizeNodes: 2, volumeLayout: 'shared', sofsOsDiskPerVmGB: 127 },
      sofsResult: { totalProfileStorageTB: 0, totalRedirectedStorageTB: 0, totalStorageTB: 0, sofsVCpusTotal: 0, sofsMemoryTotalGB: 0, internalMirrorFactor: 3, internalFootprintTB: 0, steadyStateIopsPerUser: 10, loginStormIopsPerUser: 50, totalSteadyStateIops: 0, totalLoginStormIops: 0, autoSizeDriveSizeTB: 0 },
      mabsEnabled: true,
      mabsInputs: {
        protectedDataTB: 10,
        dailyChangeRatePct: 10,
        onPremRetentionDays: 14,
        scratchCachePct: 15,
        mabsVCpus: 8,
        mabsMemoryGB: 32,
        mabsOsDiskGB: 200,
        internalMirror: 'two-way',
      },
      mabsResult: {
        scratchVolumeTB: 1.5,
        backupDataVolumeTB: 24,
        totalStorageTB: 25.5,
        internalMirrorFactor: 2,
        internalFootprintTB: 51,
        mabsVCpus: 8,
        mabsMemoryGB: 32,
        mabsOsDiskTB: 0.2,
      },
      servicePresets: [],
      customWorkloads: [],
    })

    // Resiliency now defaults to advanced.defaultResiliency (three-way-mirror) for all MABS volumes
    expect(suggestions.find((s) => s.name === 'MABS-Scratch')?.resiliency).toBe('three-way-mirror')
    expect(suggestions.find((s) => s.name === 'MABS-BackupData')?.resiliency).toBe('three-way-mirror')
    // BackupData provisioning defaults to thin; Scratch to fixed
    expect(suggestions.find((s) => s.name === 'MABS-Scratch')?.provisioning).toBe('fixed')
    expect(suggestions.find((s) => s.name === 'MABS-BackupData')?.provisioning).toBe('thin')
    expect(suggestions.find((s) => s.name === 'MABS-OsDisk')).toBeDefined()
  })

  it('SOFS shared mode generates 1 combined SOFS volume', () => {
    const suggestions = generateWorkloadVolumes({
      advanced: DEFAULT_ADVANCED_SETTINGS,
      avdEnabled: false,
      avdResult: computeAvd({ pools: [], userTypeMixEnabled: false, userTypeMix: { taskPct: 0, taskProfileGB: 15, knowledgePct: 0, knowledgeProfileGB: 40, powerPct: 0, powerProfileGB: 80 }, growthBufferPct: 0 }),
      aksEnabled: false,
      aksResult: { totalNodes: 0, totalControlPlaneVCpus: 0, totalWorkerVCpus: 0, totalVCpus: 0, totalControlPlaneMemoryGB: 0, totalWorkerMemoryGB: 0, totalMemoryGB: 0, osDiskTB: 0, totalStorageTB: 0 },
      aksInputs: { enabled: false, clusters: [] },
      virtualMachines: { enabled: false, vCpuOvercommitRatio: 1, groups: [] },
      sofsEnabled: true,
      sofsInputs: { userCount: 100, concurrentUsers: 0, profileSizeGB: 40, redirectedFolderSizeGB: 0, containerType: 'split', sofsGuestVmCount: 2, sofsVCpusPerVm: 4, sofsMemoryPerVmGB: 16, internalMirror: 'three-way', autoSizeDrivesPerNode: 0, autoSizeNodes: 0, volumeLayout: 'shared', sofsOsDiskPerVmGB: 127 },
      sofsResult: { totalProfileStorageTB: 3.91, totalRedirectedStorageTB: 0, totalStorageTB: 3.91, sofsVCpusTotal: 8, sofsMemoryTotalGB: 32, internalMirrorFactor: 3, internalFootprintTB: 11.72, steadyStateIopsPerUser: 10, loginStormIopsPerUser: 50, totalSteadyStateIops: 1000, totalLoginStormIops: 5000, autoSizeDriveSizeTB: 0 },
      mabsEnabled: false,
      mabsInputs: { protectedDataTB: 0, dailyChangeRatePct: 10, onPremRetentionDays: 14, scratchCachePct: 15, mabsVCpus: 8, mabsMemoryGB: 32, mabsOsDiskGB: 200, internalMirror: 'two-way' },
      mabsResult: { scratchVolumeTB: 0, backupDataVolumeTB: 0, totalStorageTB: 0, internalMirrorFactor: 2, internalFootprintTB: 0, mabsVCpus: 0, mabsMemoryGB: 0, mabsOsDiskTB: 0 },
      servicePresets: [],
      customWorkloads: [],
    })
    const sofsVols = suggestions.filter((s) => s.source === 'SOFS')
    expect(sofsVols).toHaveLength(1)
    const sharedVol = sofsVols.find((s) => s.name === 'SOFS-Shared')
    expect(sharedVol).toBeDefined()
    expect(sharedVol?.resiliency).toBe('three-way-mirror')
    // Combined = 11.72 TB data + 0.25 TB OS = 11.97 TB
    expect(Math.abs((sharedVol?.plannedSizeTB ?? 0) - 11.97)).toBeLessThan(0.02)
  })

  it('SOFS per-VM mode with 2 VMs generates 2 combined volumes', () => {
    const suggestions = generateWorkloadVolumes({
      advanced: DEFAULT_ADVANCED_SETTINGS,
      avdEnabled: false,
      avdResult: computeAvd({ pools: [], userTypeMixEnabled: false, userTypeMix: { taskPct: 0, taskProfileGB: 15, knowledgePct: 0, knowledgeProfileGB: 40, powerPct: 0, powerProfileGB: 80 }, growthBufferPct: 0 }),
      aksEnabled: false,
      aksResult: { totalNodes: 0, totalControlPlaneVCpus: 0, totalWorkerVCpus: 0, totalVCpus: 0, totalControlPlaneMemoryGB: 0, totalWorkerMemoryGB: 0, totalMemoryGB: 0, osDiskTB: 0, totalStorageTB: 0 },
      aksInputs: { enabled: false, clusters: [] },
      virtualMachines: { enabled: false, vCpuOvercommitRatio: 1, groups: [] },
      sofsEnabled: true,
      sofsInputs: { userCount: 100, concurrentUsers: 0, profileSizeGB: 40, redirectedFolderSizeGB: 0, containerType: 'split', sofsGuestVmCount: 2, sofsVCpusPerVm: 4, sofsMemoryPerVmGB: 16, internalMirror: 'three-way', autoSizeDrivesPerNode: 0, autoSizeNodes: 0, volumeLayout: 'per-vm', sofsOsDiskPerVmGB: 127 },
      sofsResult: { totalProfileStorageTB: 3.91, totalRedirectedStorageTB: 0, totalStorageTB: 3.91, sofsVCpusTotal: 8, sofsMemoryTotalGB: 32, internalMirrorFactor: 3, internalFootprintTB: 11.72, steadyStateIopsPerUser: 10, loginStormIopsPerUser: 50, totalSteadyStateIops: 1000, totalLoginStormIops: 5000, autoSizeDriveSizeTB: 0 },
      mabsEnabled: false,
      mabsInputs: { protectedDataTB: 0, dailyChangeRatePct: 10, onPremRetentionDays: 14, scratchCachePct: 15, mabsVCpus: 8, mabsMemoryGB: 32, mabsOsDiskGB: 200, internalMirror: 'two-way' },
      mabsResult: { scratchVolumeTB: 0, backupDataVolumeTB: 0, totalStorageTB: 0, internalMirrorFactor: 2, internalFootprintTB: 0, mabsVCpus: 0, mabsMemoryGB: 0, mabsOsDiskTB: 0 },
      servicePresets: [],
      customWorkloads: [],
    })
    const sofsVols = suggestions.filter((s) => s.source === 'SOFS')
    expect(sofsVols).toHaveLength(2)
    expect(sofsVols.some((s) => s.name === 'SOFS-VM1')).toBe(true)
    expect(sofsVols.some((s) => s.name === 'SOFS-VM2')).toBe(true)
    const totalCombined = sofsVols.reduce((sum, s) => sum + s.plannedSizeTB, 0)
    // Combined = 11.72 TB data + 0.25 TB OS = 11.97 TB
    expect(Math.abs(totalCombined - 11.97)).toBeLessThan(0.05)
    expect(sofsVols.every((s) => s.resiliency === 'three-way-mirror')).toBe(true)
  })

  it('12D addendum: AVD generates per-pool OS + DataDisk volumes, shared Profiles/OfficeContainers', () => {
    const BASE_MABS_RESULT = { scratchVolumeTB: 0, backupDataVolumeTB: 0, totalStorageTB: 0, internalMirrorFactor: 2, internalFootprintTB: 0, mabsVCpus: 0, mabsMemoryGB: 0, mabsOsDiskTB: 0 }
    const BASE_MABS_INPUTS = { protectedDataTB: 0, dailyChangeRatePct: 10, onPremRetentionDays: 14, scratchCachePct: 15, mabsVCpus: 8, mabsMemoryGB: 32, mabsOsDiskGB: 200, internalMirror: 'two-way' as const }

    const avdResult = computeAvd({
      pools: [
        {
          id: 'pool-light',
          name: 'Light Workers',
          totalUsers: 100,
          concurrentUsers: 0,
          workloadType: 'light',
          multiSession: true,
          fslogixEnabled: true,
          profileSizeGB: 30,
          officeContainerEnabled: true,
          officeContainerSizeGB: 10,
          dataDiskPerHostGB: 0,
          profileStorageLocation: 'external',
        },
        {
          id: 'pool-power',
          name: 'Power Users',
          totalUsers: 50,
          concurrentUsers: 0,
          workloadType: 'power',
          multiSession: false,
          fslogixEnabled: true,
          profileSizeGB: 60,
          officeContainerEnabled: false,
          officeContainerSizeGB: 0,
          dataDiskPerHostGB: 100,
          profileStorageLocation: 'external',
        },
      ],
      userTypeMixEnabled: false,
      userTypeMix: { taskPct: 0, taskProfileGB: 15, knowledgePct: 0, knowledgeProfileGB: 40, powerPct: 0, powerProfileGB: 80 },
      growthBufferPct: 0,
    })

    const suggestions = generateWorkloadVolumes({
      advanced: DEFAULT_ADVANCED_SETTINGS,
      avdEnabled: true,
      avdResult,
      aksEnabled: false,
      aksResult: { totalNodes: 0, totalControlPlaneVCpus: 0, totalWorkerVCpus: 0, totalVCpus: 0, totalControlPlaneMemoryGB: 0, totalWorkerMemoryGB: 0, totalMemoryGB: 0, osDiskTB: 0, totalStorageTB: 0 },
      aksInputs: { enabled: false, clusters: [] },
      virtualMachines: { enabled: false, vCpuOvercommitRatio: 1, groups: [] },
      sofsEnabled: false,
      sofsInputs: { userCount: 0, concurrentUsers: 0, profileSizeGB: 0, redirectedFolderSizeGB: 0, containerType: 'split', sofsGuestVmCount: 2, sofsVCpusPerVm: 4, sofsMemoryPerVmGB: 16, internalMirror: 'three-way', autoSizeDrivesPerNode: 0, autoSizeNodes: 2, volumeLayout: 'shared', sofsOsDiskPerVmGB: 127 },
      sofsResult: { totalProfileStorageTB: 0, totalRedirectedStorageTB: 0, totalStorageTB: 0, sofsVCpusTotal: 0, sofsMemoryTotalGB: 0, internalMirrorFactor: 3, internalFootprintTB: 0, steadyStateIopsPerUser: 10, loginStormIopsPerUser: 50, totalSteadyStateIops: 0, totalLoginStormIops: 0, autoSizeDriveSizeTB: 0 },
      mabsEnabled: false,
      mabsInputs: BASE_MABS_INPUTS,
      mabsResult: BASE_MABS_RESULT,
      servicePresets: [],
      customWorkloads: [],
    })

    const avdVols = suggestions.filter((s) => s.source === 'AVD')

    // Two per-pool OS volumes (one per pool)
    expect(avdVols.some(s => s.name === 'AVD-LightWorkers-OS')).toBe(true)
    expect(avdVols.some(s => s.name === 'AVD-PowerUsers-OS')).toBe(true)
    // Old flat name should NOT appear
    expect(avdVols.some(s => s.name === 'AVD-SessionHosts-OS')).toBe(false)
    // Power pool has dataDiskPerHostGB > 0 → per-pool DataDisks volume
    expect(avdVols.some(s => s.name === 'AVD-PowerUsers-DataDisks')).toBe(true)
    // Light pool has dataDiskPerHostGB = 0 → no DataDisks volume for it
    expect(avdVols.some(s => s.name === 'AVD-LightWorkers-DataDisks')).toBe(false)
    // Profiles and OfficeContainers stay as aggregates
    expect(avdVols.some(s => s.name === 'AVD-Profiles')).toBe(true)
    expect(avdVols.some(s => s.name === 'AVD-OfficeContainers')).toBe(true)
    // OS volumes use three-way-mirror
    expect(avdVols.filter(s => s.name.endsWith('-OS')).every(s => s.resiliency === 'three-way-mirror')).toBe(true)
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
      { id: '1', name: 'Test', resiliency: 'three-way-mirror', provisioning: 'fixed', plannedSizeTB: 5 },
    ]
    const summary = computeVolumeSummary(vols, capacity)
    expect(summary.volumes[0].wacSizeGB).toBe(5120)
    expect(summary.volumes[0].wacSizeTB).toBe(5)
  })

  it('2.5 TB planned → 2560 GB WAC', () => {
    const vols: VolumeSpec[] = [
      { id: '1', name: 'Test', resiliency: 'three-way-mirror', provisioning: 'fixed', plannedSizeTB: 2.5 },
    ]
    const summary = computeVolumeSummary(vols, capacity)
    expect(summary.volumes[0].wacSizeGB).toBe(2560)
  })
})

// ─── Compute Health Check Tests (Phase 13D) ───────────────────────────────────

describe('runComputeHealthCheck', () => {
  const BASE_COMPUTE: ComputeResult = {
    nodeCount: 4,
    physicalCores: 128,
    logicalCores: 256,
    logicalCoresPerNode: 64,
    hyperthreadingEnabled: true,
    systemReservedVCpus: 12,
    usableVCpus: 100,
    usableVCpusN1: 75,
    usableMemoryGBN1: 750,
    physicalMemoryGB: 1024,
    systemReservedMemoryGB: 24,
    usableMemoryGB: 1000,
    numaDomainsEstimate: 8,
  }

  it('returns no issues when no workloads are planned', () => {
    const issues = runComputeHealthCheck({ compute: BASE_COMPUTE, totalVCpus: 0, totalMemoryGB: 0 })
    expect(issues).toHaveLength(0)
  })

  it('returns no issues when utilization is below 80%', () => {
    const issues = runComputeHealthCheck({ compute: BASE_COMPUTE, totalVCpus: 70, totalMemoryGB: 700 })
    expect(issues).toHaveLength(0)
  })

  it('HC_VCPU_HIGH when vCPU utilization is above 80% but under 100%', () => {
    const issues = runComputeHealthCheck({ compute: BASE_COMPUTE, totalVCpus: 85, totalMemoryGB: 500 })
    const codes = issues.map(i => i.code)
    expect(codes).toContain('HC_VCPU_HIGH')
    expect(codes).not.toContain('HC_VCPU_OVER_SUBSCRIBED')
    const issue = issues.find(i => i.code === 'HC_VCPU_HIGH')!
    expect(issue.severity).toBe('warning')
  })

  it('HC_VCPU_OVER_SUBSCRIBED when vCPU demand exceeds cluster capacity', () => {
    const issues = runComputeHealthCheck({ compute: BASE_COMPUTE, totalVCpus: 110, totalMemoryGB: 500 })
    const codes = issues.map(i => i.code)
    expect(codes).toContain('HC_VCPU_OVER_SUBSCRIBED')
    expect(codes).not.toContain('HC_VCPU_HIGH')
    const issue = issues.find(i => i.code === 'HC_VCPU_OVER_SUBSCRIBED')!
    expect(issue.severity).toBe('error')
  })

  it('HC_MEMORY_HIGH when memory utilization is above 80% but under 100%', () => {
    const issues = runComputeHealthCheck({ compute: BASE_COMPUTE, totalVCpus: 50, totalMemoryGB: 850 })
    const codes = issues.map(i => i.code)
    expect(codes).toContain('HC_MEMORY_HIGH')
    expect(codes).not.toContain('HC_MEMORY_EXCEEDED')
    const issue = issues.find(i => i.code === 'HC_MEMORY_HIGH')!
    expect(issue.severity).toBe('warning')
  })

  it('HC_MEMORY_EXCEEDED when memory demand exceeds cluster capacity', () => {
    const issues = runComputeHealthCheck({ compute: BASE_COMPUTE, totalVCpus: 50, totalMemoryGB: 1100 })
    const codes = issues.map(i => i.code)
    expect(codes).toContain('HC_MEMORY_EXCEEDED')
    expect(codes).not.toContain('HC_MEMORY_HIGH')
    const issue = issues.find(i => i.code === 'HC_MEMORY_EXCEEDED')!
    expect(issue.severity).toBe('error')
  })

  it('emits both CPU and memory issues simultaneously when both exceed capacity', () => {
    const issues = runComputeHealthCheck({ compute: BASE_COMPUTE, totalVCpus: 120, totalMemoryGB: 1200 })
    const codes = issues.map(i => i.code)
    expect(codes).toContain('HC_VCPU_OVER_SUBSCRIBED')
    expect(codes).toContain('HC_MEMORY_EXCEEDED')
  })
})
