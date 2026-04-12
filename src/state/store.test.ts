import { describe, expect, it } from 'vitest'
import { normalizePersistedState } from './store'

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
    expect(normalized.avd.userTypeMix).toEqual({
      taskPct: 30,
      taskProfileGB: 15,
      knowledgePct: 50,
      knowledgeProfileGB: 40,
      powerPct: 20,
      powerProfileGB: 80,
    })
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
})