import { describe, expect, it } from 'vitest'
import { migratePersistedState } from './store'

/**
 * Phase 14: Store migration tests — verify migratePersistedState() correctly
 * transforms prior-version state shapes into the current v9 schema.
 */
describe('migratePersistedState — v8 → v9', () => {
  it('wraps flat AKS fields into a single clusters array entry', () => {
    const v8State = {
      aks: {
        enabled: true,
        controlPlaneNodesPerCluster: 3,
        workerNodesPerCluster: 5,
        vCpusPerWorker: 8,
        memoryPerWorkerGB: 32,
        osDiskPerNodeGB: 200,
        persistentVolumesTB: 2,
        dataServicesTB: 1,
        resiliency: 'three-way-mirror',
      },
    }

    const result = migratePersistedState(v8State, 8) as Record<string, unknown>
    const aks = result.aks as Record<string, unknown>

    expect(Array.isArray(aks.clusters)).toBe(true)
    const clusters = aks.clusters as Record<string, unknown>[]
    expect(clusters).toHaveLength(1)
    expect(clusters[0].id).toBe('cluster-1')
    expect(clusters[0].name).toBe('Cluster 1')
    expect(clusters[0].controlPlaneNodesPerCluster).toBe(3)
    expect(clusters[0].workerNodesPerCluster).toBe(5)
    expect(clusters[0].vCpusPerWorker).toBe(8)
    expect(clusters[0].memoryPerWorkerGB).toBe(32)
    expect(clusters[0].osDiskPerNodeGB).toBe(200)
    expect(clusters[0].persistentVolumesTB).toBe(2)
    // Flat fields should be removed
    expect(aks.controlPlaneNodesPerCluster).toBeUndefined()
    expect(aks.workerNodesPerCluster).toBeUndefined()
    expect(aks.dataServicesTB).toBeUndefined()
    expect(aks.resiliency).toBeUndefined()
  })

  it('wraps flat VMs fields into a single groups array entry', () => {
    const v8State = {
      virtualMachines: {
        enabled: true,
        vCpuOvercommitRatio: 2,
        vmCount: 10,
        vCpusPerVm: 4,
        memoryPerVmGB: 16,
        storagePerVmGB: 500,
        resiliency: 'two-way-mirror',
      },
    }

    const result = migratePersistedState(v8State, 8) as Record<string, unknown>
    const vm = result.virtualMachines as Record<string, unknown>

    expect(Array.isArray(vm.groups)).toBe(true)
    const groups = vm.groups as Record<string, unknown>[]
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe('group-1')
    expect(groups[0].name).toBe('Default')
    expect(groups[0].vmCount).toBe(10)
    expect(groups[0].vCpusPerVm).toBe(4)
    expect(groups[0].memoryPerVmGB).toBe(16)
    expect(groups[0].storagePerVmGB).toBe(500)
    // Flat fields removed
    expect(vm.vmCount).toBeUndefined()
    expect(vm.vCpusPerVm).toBeUndefined()
    expect(vm.resiliency).toBeUndefined()
  })

  it("converts AVD profileStorageLocation 's2d' → 'sofs'", () => {
    const v8State = {
      avd: {
        pools: [
          { id: 'p1', name: 'Pool A', profileStorageLocation: 's2d', totalUsers: 100 },
          { id: 'p2', name: 'Pool B', profileStorageLocation: 'external', totalUsers: 50 },
        ],
      },
    }

    const result = migratePersistedState(v8State, 8) as Record<string, unknown>
    const avd = result.avd as Record<string, unknown>
    const pools = avd.pools as Record<string, unknown>[]

    expect(pools[0].profileStorageLocation).toBe('sofs')
    expect(pools[1].profileStorageLocation).toBe('external') // unchanged
  })

  it('adds provisioning: fixed to existing volumes that lack it', () => {
    const v8State = {
      volumes: [
        { id: 'v1', name: 'UserData', resiliency: 'three-way-mirror', plannedSizeTB: 5 },
        { id: 'v2', name: 'OsDisk', resiliency: 'two-way-mirror', provisioning: 'thin', plannedSizeTB: 2 },
      ],
    }

    const result = migratePersistedState(v8State, 8) as Record<string, unknown>
    const volumes = result.volumes as Record<string, unknown>[]

    expect(volumes[0].provisioning).toBe('fixed')     // added
    expect(volumes[1].provisioning).toBe('thin')       // pre-existing value preserved
  })

  it('adds SOFS v2.0 defaults: volumeLayout and sofsOsDiskPerVmGB', () => {
    const v8State = {
      sofs: {
        userCount: 200,
        profileSizeGB: 40,
        sofsGuestVmCount: 2,
      },
    }

    const result = migratePersistedState(v8State, 8) as Record<string, unknown>
    const sofs = result.sofs as Record<string, unknown>

    expect(sofs.volumeLayout).toBe('shared')
    expect(sofs.sofsOsDiskPerVmGB).toBe(127)
  })

  it('does not overwrite existing SOFS volumeLayout or sofsOsDiskPerVmGB', () => {
    const v8State = {
      sofs: {
        volumeLayout: 'per-vm',
        sofsOsDiskPerVmGB: 64,
      },
    }

    const result = migratePersistedState(v8State, 8) as Record<string, unknown>
    const sofs = result.sofs as Record<string, unknown>

    expect(sofs.volumeLayout).toBe('per-vm')
    expect(sofs.sofsOsDiskPerVmGB).toBe(64)
  })

  it('removes scratchResiliency and backupResiliency from MABS', () => {
    const v8State = {
      mabs: {
        protectedDataTB: 20,
        internalMirror: 'three-way',
        scratchResiliency: 'two-way-mirror',
        backupResiliency: 'dual-parity',
      },
    }

    const result = migratePersistedState(v8State, 8) as Record<string, unknown>
    const mabs = result.mabs as Record<string, unknown>

    expect(mabs.protectedDataTB).toBe(20)
    expect(mabs.internalMirror).toBe('three-way')
    expect(mabs.scratchResiliency).toBeUndefined()
    expect(mabs.backupResiliency).toBeUndefined()
  })

  it('removes resiliency from custom workloads', () => {
    const v8State = {
      customWorkloads: [
        { id: 'cw1', name: 'My App', vmCount: 3, resiliency: 'three-way-mirror', storageTB: 1 },
        { id: 'cw2', name: 'Dev VMs', vmCount: 2, resiliency: 'two-way-mirror', storageTB: 0.5 },
      ],
    }

    const result = migratePersistedState(v8State, 8) as Record<string, unknown>
    const workloads = result.customWorkloads as Record<string, unknown>[]

    expect(workloads[0].resiliency).toBeUndefined()
    expect(workloads[1].resiliency).toBeUndefined()
    expect(workloads[0].name).toBe('My App')
    expect(workloads[0].vmCount).toBe(3)
  })

  it('removes volumeProvisioning from hardware', () => {
    const v8State = {
      hardware: {
        nodeCount: 4,
        coresPerNode: 32,
        volumeProvisioning: 'thin', // old field
      },
    }

    const result = migratePersistedState(v8State, 8) as Record<string, unknown>
    const hw = result.hardware as Record<string, unknown>

    expect(hw.volumeProvisioning).toBeUndefined()
    expect(hw.nodeCount).toBe(4)
  })
})

describe('migratePersistedState — v7 → v9 (skips over v7/v8 AVD pool migration)', () => {
  it('wraps flat AVD fields into a pools array when migrating from older version', () => {
    const v7State = {
      avd: {
        totalUsers: 250,
        workloadType: 'medium',
        multiSession: true,
        profileSizeGB: 40,
        profileStorageLocation: 'external',
        officeContainerEnabled: false,
        officeContainerSizeGB: 0,
        dataDiskPerHostGB: 0,
      },
    }

    const result = migratePersistedState(v7State, 7) as Record<string, unknown>
    const avd = result.avd as Record<string, unknown>

    expect(Array.isArray(avd.pools)).toBe(true)
    const pools = avd.pools as Record<string, unknown>[]
    expect(pools).toHaveLength(1)
    expect(pools[0].totalUsers).toBe(250)
    expect(pools[0].profileSizeGB).toBe(40)
    expect(pools[0].profileStorageLocation).toBe('external')
  })
})

describe('migratePersistedState — handles unknown/empty input', () => {
  it('returns sane defaults when passed null', () => {
    const result = migratePersistedState(null, 8) as Record<string, unknown>
    // normalizePersistedState is called at the end — should produce valid defaults
    expect(typeof result).toBe('object')
    expect(result).not.toBeNull()
  })

  it('returns sane defaults when passed an empty object', () => {
    const result = migratePersistedState({}, 9) as Record<string, unknown>
    expect(typeof result).toBe('object')
    expect(result).not.toBeNull()
  })
})
