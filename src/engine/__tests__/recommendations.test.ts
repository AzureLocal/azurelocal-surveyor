import { describe, expect, it } from 'vitest'
import { normalizePersistedState } from '../../state/store'
import { assessHardwareFit } from '../fit'
import { recommendHardware, estimateAdditionalVms } from '../recommendations'
import type { InventoryVm } from '../inventory'

const vm: InventoryVm = { id: 'vm', name: 'VM', tier: 'general', include: true, vCpu: 8, memoryGiB: 32, consumedGiB: 100, provisionedGiB: 200, powerState: 'on', sourceCluster: '', sourceHost: '', guestOs: '', reviewed: true }
const state = () => normalizePersistedState({ inventory: [{ ...vm }] })
const constraints = { minNodes: 2, maxNodes: 16, headroomPct: 20, vendor: '' }

describe('Hardware buying options', () => {
  it('returns only configurations meeting CPU, memory, storage and requested headroom', () => {
    const result = recommendHardware(state(), constraints)
    expect(result.error).toBeNull()
    expect(result.options.length).toBeGreaterThan(0)
    for (const option of result.options) {
      expect(option.candidate.fits).toBe(true)
      expect(option.candidate.cpu).toBeGreaterThanOrEqual(option.demand.totalVCpus * 1.2)
      expect(option.candidate.memory).toBeGreaterThanOrEqual(option.demand.totalMemoryGB * 1.2)
      expect(option.candidate.poolTB).toBeGreaterThanOrEqual(option.candidate.requiredFootprintTB * 1.2)
      expect(assessHardwareFit({ ...state(), hardware: option.hardware }).current.fits).toBe(true)
    }
  })
  it('honors vendor and node constraints and produces no invented fallback', () => {
    const first = recommendHardware(state(), constraints).options[0]
    const result = recommendHardware(state(), { ...constraints, vendor: first.preset.vendor, minNodes: 6, maxNodes: 6 })
    expect(result.options.length).toBeGreaterThan(0)
    expect(result.options.every(o => o.preset.vendor === first.preset.vendor && o.hardware.nodeCount === 6)).toBe(true)
    expect(recommendHardware(state(), { ...constraints, vendor: 'unknown' }).options).toEqual([])
    expect(recommendHardware(normalizePersistedState({}), constraints).options).toEqual([])
  })
  it('rejects invalid ranges and headroom', () => {
    for (const override of [{ minNodes: 1 }, { maxNodes: 17 }, { minNodes: 8, maxNodes: 4 }, { headroomPct: -1 }, { headroomPct: NaN }]) {
      expect(recommendHardware(state(), { ...constraints, ...override }).error).toBeTruthy()
    }
  })
  it('does not suggest more nodes for a VM that cannot fit in any one host', () => {
    const s = state(); s.inventory[0].memoryGiB = 500
    const fit = assessHardwareFit(s)
    expect(fit.current.memory).toBeGreaterThan(500)
    expect(fit.current.fits).toBe(false)
    expect(fit.requiredNodes).toBeNull()
    const options = recommendHardware(s, constraints).options
    expect(options.length).toBeGreaterThan(0)
    expect(options.every(o => o.hardware.memoryPerNodeGB - s.advanced.systemReservedMemoryGB >= 500)).toBe(true)
  })
})

describe('Existing hardware headroom', () => {
  it('limits additional VMs by the scarcest resource and reserves maintenance nodes', () => {
    const s = state()
    const count = estimateAdditionalVms(s, { vCpu: 1, memoryGiB: 200, diskGiB: 1 })
    expect(count).toBe(Math.floor((assessHardwareFit(s).current.memory - 32) / 200))
    s.advanced.maintenanceReserveMode = 'n+1'
    expect(estimateAdditionalVms(s, { vCpu: 1, memoryGiB: 200, diskGiB: 1 })).toBeLessThan(count!)
    expect(estimateAdditionalVms(s, { vCpu: 1, memoryGiB: 1000, diskGiB: 1 })).toBe(0)
    expect(estimateAdditionalVms(s, { vCpu: 0, memoryGiB: 1, diskGiB: 1 })).toBeNull()
    expect(estimateAdditionalVms(s, { vCpu: 1, memoryGiB: 1, diskGiB: 1e9 })).toBe(0)
  })
})
