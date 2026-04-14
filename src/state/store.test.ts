import { describe, expect, it } from 'vitest'
import {
  applyAvdUpdatesWithLinkedSofs,
  applySofsUpdatesWithLinkedAvd,
  normalizePersistedState,
} from './store'

describe('normalizePersistedState', () => {
  it('fills in missing nested fields from older persisted snapshots', () => {
    const normalized = normalizePersistedState({
      advanced: {
        defaultResiliency: 'two-way-mirror',
      },
      avd: {
        totalUsers: 250,
        profileStorageLocation: 'sofs',
      },
      sofs: {
        userCount: 250,
      },
      volumeMode: 'workload',
    })

    expect(normalized.advanced.overrides).toEqual({})
    expect(normalized.aks.enabled).toBe(false)
    expect(normalized.virtualMachines.enabled).toBe(false)
    expect(normalized.avd.pools).toHaveLength(1)
    expect(normalized.avd.pools[0].totalUsers).toBe(250)
    expect(normalized.avd.pools[0].profileStorageLocation).toBe('sofs')
    expect(normalized.avd.userTypeMix).toEqual({
      taskPct: 30,
      taskProfileGB: 15,
      knowledgePct: 50,
      knowledgeProfileGB: 40,
      powerPct: 20,
      powerProfileGB: 80,
    })
    expect(normalized.sofs.autoSizeDrivesPerNode).toBe(4)
    expect(normalized.volumeMode).toBe('workload')
  })

  it('falls back to safe defaults for invalid persisted values', () => {
    const normalized = normalizePersistedState({
      volumeMode: 'invalid-mode',
      volumes: 'not-an-array',
      workloads: null,
      avdEnabled: 'yes',
      mabsEnabled: 1,
    })

    expect(normalized.volumeMode).toBe('generic')
    expect(normalized.volumes).toEqual([])
    expect(normalized.workloads).toEqual([])
    expect(normalized.avdEnabled).toBe(false)
    expect(normalized.mabsEnabled).toBe(false)
  })

  it('maps legacy MABS resiliency into the new split volume fields', () => {
    const normalized = normalizePersistedState({
      mabs: {
        resiliency: 'three-way-mirror',
      },
    })

    expect(normalized.mabs.scratchResiliency).toBe('three-way-mirror')
    expect(normalized.mabs.backupResiliency).toBe('three-way-mirror')
  })

  it('syncs AVD profile size into SOFS when SOFS is enabled', () => {
    const normalized = normalizePersistedState({
      avdEnabled: true,
      avd: {
        profileStorageLocation: 'sofs',
      },
      sofsEnabled: true,
    })

    const next = applyAvdUpdatesWithLinkedSofs(
      {
        avd: normalized.avd,
        avdEnabled: normalized.avdEnabled,
        sofs: normalized.sofs,
        sofsEnabled: normalized.sofsEnabled,
      },
      { pools: normalized.avd.pools.map((pool) => ({ ...pool, profileSizeGB: 55 })) }
    )

    expect(next.avd.pools[0].profileSizeGB).toBe(55)
    expect(next.sofs.profileSizeGB).toBe(55)
  })

  it('syncs SOFS profile size back into AVD when AVD targets SOFS', () => {
    const normalized = normalizePersistedState({
      avdEnabled: true,
      avd: {
        profileStorageLocation: 'sofs',
      },
      sofsEnabled: true,
    })

    const next = applySofsUpdatesWithLinkedAvd(
      {
        avd: normalized.avd,
        avdEnabled: normalized.avdEnabled,
        sofs: normalized.sofs,
        sofsEnabled: normalized.sofsEnabled,
      },
      { profileSizeGB: 72 }
    )

    expect(next.sofs.profileSizeGB).toBe(72)
    expect(next.avd.pools[0].profileSizeGB).toBe(72)
  })
})