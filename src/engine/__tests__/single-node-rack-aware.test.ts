/**
 * Single node (1 machine), rack aware clusters and hybrid dual parity.
 * Every expected number is derived by hand from the Learn pages cited in src/engine/facts.ts.
 *
 * Pipeline (docs/capacity-model.md):
 *   raw = drives x size x N; pool = raw x 0.99; reserve = min(N, 4) x size;
 *   infra footprint = infraTB / efficiency; available = pool - reserve - infra footprint;
 *   usable = available x efficiency.
 */
import { describe, expect, it } from 'vitest'
import { normalizePersistedState } from '../../state/store'
import { assessHardwareFit } from '../fit'
import { computeCapacity, clampResiliency, getResiliencyFactor, minNodesForResiliency, validResiliencyOptions } from '../capacity'
import { getRecommendedResiliency, platformRuleIssues, validateHardwareInputs } from '../hardware'
import { runHealthCheck } from '../healthcheck'
import { computeCompute } from '../compute'
import { computeWorkloadSummary } from '../workloads'
import { DEFAULT_ADVANCED_SETTINGS, type AdvancedSettings, type HardwareInputs } from '../types'
import { PLATFORM_FACTS } from '../facts'

const hw = (over: Partial<HardwareInputs> = {}): HardwareInputs => ({
  nodeCount: 4, capacityDrivesPerNode: 8, capacityDriveSizeTB: 3.84, cacheDrivesPerNode: 0, cacheDriveSizeTB: 0,
  cacheMediaType: 'none', capacityMediaType: 'nvme', coresPerNode: 32, memoryPerNodeGB: 512, hyperthreadingEnabled: true, ...over,
})
const adv = (over: Partial<AdvancedSettings> = {}): AdvancedSettings => ({ ...DEFAULT_ADVANCED_SETTINGS, ...over })
const codes = (h: HardwareInputs) => platformRuleIssues(h).map(i => i.code)

describe('single node (1 machine, Learn: hyperconverged supports 1 to 16)', () => {
  it('two-way mirror is valid from one node; three-way and parity are not', () => {
    expect(minNodesForResiliency('two-way-mirror')).toBe(1)
    expect(validResiliencyOptions(1)).toEqual(['two-way-mirror'])
    expect(clampResiliency('two-way-mirror', 1)).toEqual({ resiliency: 'two-way-mirror', clamped: false })
    expect(clampResiliency('three-way-mirror', 1).clamped).toBe(true)
    expect(getRecommendedResiliency(hw({ nodeCount: 1 }))).toBe('two-way-mirror')
  })
  it('capacity: 1 node x 4 x 3.84 TB, two-way: 15.36 x 0.99 = 15.2064; reserve 1 x 3.84; infra 0.25/0.5 = 0.5; avail 10.8664; usable 5.4332', () => {
    const c = computeCapacity(hw({ nodeCount: 1, capacityDrivesPerNode: 4 }), adv({ defaultResiliency: 'two-way-mirror' }))
    expect(c.rawPoolTB).toBe(15.36)
    expect(c.reserveTB).toBe(3.84)
    expect(c.infraVolumeTB).toBe(0.5)
    expect(c.availableForVolumesTB).toBe(10.8664)
    expect(c.effectiveUsableTB).toBe(5.4332)
    expect(c.resiliencyClamped).toBe(false)
  })
  it('flags the single-node design: warning on N+1, error on cache or HDD', () => {
    expect(codes(hw({ nodeCount: 1 }))).toContain('HW_SINGLE_NODE')
    expect(validateHardwareInputs(hw({ nodeCount: 1 })).passed).toBe(true)
    const cached = hw({ nodeCount: 1, cacheMediaType: 'nvme', cacheDrivesPerNode: 2, cacheDriveSizeTB: 0.8, capacityMediaType: 'ssd' })
    expect(codes(cached)).toContain('HW_SINGLE_NODE_CACHE')
    expect(codes(hw({ nodeCount: 1, capacityMediaType: 'hdd' }))).toContain('HW_SINGLE_NODE_HDD')
  })
  it('health check no longer errors on one node and reports the single-node advisory', () => {
    const h = hw({ nodeCount: 1, capacityDrivesPerNode: 4 })
    const settings = adv({ defaultResiliency: 'two-way-mirror' })
    const capacity = computeCapacity(h, settings)
    const result = runHealthCheck({ hardware: h, settings, volumes: [], capacity, compute: computeCompute(h, settings), workloadSummary: computeWorkloadSummary([]) })
    const issueCodes = result.issues.map(i => i.code)
    expect(issueCodes).not.toContain('HC_MIN_NODES')
    expect(issueCodes).toContain('HC_SINGLE_NODE')
  })
  it('fit: one node is a candidate, N+1 leaves no workload node and is reported', () => {
    const state = normalizePersistedState({ hardware: hw({ nodeCount: 1 }), advanced: adv({ defaultResiliency: 'two-way-mirror', maintenanceReserveMode: 'n+1' }) })
    const fit = assessHardwareFit(state as never)
    expect(fit.candidates[0].nodeCount).toBe(1)
    expect(fit.candidates).toHaveLength(16)
    expect(fit.current.errors).toContain('No workload nodes remain after the maintenance reserve.')
    expect(fit.warnings.join(' ')).toMatch(/Single node/)
  })
})

describe('node count bounds', () => {
  it('rejects 17 with a message that states the 16 maximum and the SAN scope', () => {
    const issue = platformRuleIssues(hw({ nodeCount: 17 })).find(i => i.code === 'HW_MAX_NODES')
    expect(issue?.severity).toBe('error')
    expect(issue?.message).toMatch(/at most 16/)
    expect(issue?.message).toMatch(/64/)
    expect(codes(hw({ nodeCount: 0 }))).toContain('HW_MIN_NODES')
  })
})

describe('drive and cache rules (Learn system-requirements and S2D hardware requirements)', () => {
  it('needs at least 2 capacity drives per node', () => {
    expect(codes(hw({ capacityDrivesPerNode: 1 }))).toContain('HW_MIN_CAPACITY_DRIVES')
    expect(codes(hw({ capacityDrivesPerNode: 2 }))).not.toContain('HW_MIN_CAPACITY_DRIVES')
  })
  it('a cache tier needs 2 cache drives and 4 capacity drives', () => {
    const h = hw({ cacheMediaType: 'nvme', cacheDrivesPerNode: 1, cacheDriveSizeTB: 1.6, capacityMediaType: 'ssd', capacityDrivesPerNode: 3 })
    expect(codes(h)).toEqual(expect.arrayContaining(['HW_CACHE_MIN_DRIVES', 'HW_CACHE_MIN_CAPACITY']))
    const ok = hw({ cacheMediaType: 'nvme', cacheDrivesPerNode: 2, cacheDriveSizeTB: 1.6, capacityMediaType: 'ssd', capacityDrivesPerNode: 4 })
    expect(codes(ok)).not.toContain('HW_CACHE_MIN_DRIVES')
    expect(codes(ok)).not.toContain('HW_CACHE_MIN_CAPACITY')
  })
  it('hybrid: ratio 15% (2 x 0.8 / 4 x 4 = 10% fails, 2 x 1.6 / 16 = 20% passes), multiple of cache drives, no all-HDD', () => {
    const base = hw({ capacityMediaType: 'hdd', capacityDriveSizeTB: 4, capacityDrivesPerNode: 4, cacheMediaType: 'nvme', cacheDrivesPerNode: 2 })
    expect(codes({ ...base, cacheDriveSizeTB: 0.8 })).toContain('HW_LOW_CACHE_RATIO') // 1.6 / 16 = 10% < 15%
    expect(codes({ ...base, cacheDriveSizeTB: 1.6 })).not.toContain('HW_LOW_CACHE_RATIO') // 3.2 / 16 = 20%
    expect(codes({ ...base, cacheDriveSizeTB: 1.6, capacityDrivesPerNode: 5 })).toContain('HW_HYBRID_CACHE_MULTIPLE')
    expect(codes(hw({ capacityMediaType: 'hdd', cacheMediaType: 'none' }))).toContain('HW_HDD_NO_CACHE')
  })
  it('all-flash cache ratio guidance is 5%: 2 x 0.4 / 8 x 3.84 = 2.6% warns', () => {
    const h = hw({ cacheMediaType: 'nvme', cacheDrivesPerNode: 2, cacheDriveSizeTB: 0.4, capacityMediaType: 'ssd' })
    expect(codes(h)).toContain('HW_LOW_CACHE_RATIO')
  })
})

describe('rack aware clusters (Learn rack-aware-cluster-requirements)', () => {
  it('only offers two-way (1+1) or four-way mirror (2+2 and larger)', () => {
    expect(validResiliencyOptions(2, true)).toEqual(['two-way-mirror'])
    for (const n of [4, 6, 8]) expect(validResiliencyOptions(n, true)).toEqual(['four-way-mirror'])
    expect(clampResiliency('three-way-mirror', 4, true)).toEqual({ resiliency: 'four-way-mirror', clamped: true })
    expect(getResiliencyFactor('four-way-mirror', 4)).toBe(0.25)
    expect(validResiliencyOptions(4)).not.toContain('four-way-mirror')
  })
  it('2+2: 4 x 8 x 3.84 = 122.88 raw; x0.99 = 121.6512; reserve 4 x 3.84 = 15.36; infra 0.25/0.25 = 1; avail 105.2912; usable 26.3228', () => {
    const c = computeCapacity(hw({ nodeCount: 4, rackAware: true }), adv())
    expect(c.rawPoolTB).toBe(122.88)
    expect(c.reserveTB).toBe(15.36)
    expect(c.infraVolumeTB).toBe(1)
    expect(c.availableForVolumesTB).toBe(105.2912)
    expect(c.effectiveUsableTB).toBe(26.3228)
    expect(c.resiliencyType).toBe('four-way-mirror')
  })
  it('4+4: 8 x 6 x 7.68 = 368.64; x0.99 = 364.9536; reserve 4 x 7.68 = 30.72; infra 1; avail 333.2336; usable 83.3084', () => {
    const c = computeCapacity(hw({ nodeCount: 8, capacityDrivesPerNode: 6, capacityDriveSizeTB: 7.68, rackAware: true }), adv())
    expect(c.availableForVolumesTB).toBe(333.2336)
    expect(c.effectiveUsableTB).toBe(83.3084)
  })
  it('1+1: 2 x 4 x 1.92 = 15.36; x0.99 = 15.2064; reserve 2 x 1.92 = 3.84; infra 0.25/0.5 = 0.5; avail 10.8664; usable 5.4332 (two-way, 50%)', () => {
    const c = computeCapacity(hw({ nodeCount: 2, capacityDrivesPerNode: 4, capacityDriveSizeTB: 1.92, rackAware: true }), adv())
    expect(c.resiliencyType).toBe('two-way-mirror')
    expect(c.availableForVolumesTB).toBe(10.8664)
    expect(c.effectiveUsableTB).toBe(5.4332)
  })
  it('four-way mirror data copies feed expansion headroom as 4', async () => {
    const { resiliencyDataCopies } = await import('../capacity')
    expect(resiliencyDataCopies('four-way-mirror')).toBe(4)
  })
  it('hardware rules: odd zones, HDD, and prerequisites', () => {
    expect(codes(hw({ nodeCount: 3, rackAware: true }))).toContain('HW_RACK_ZONES')
    expect(codes(hw({ nodeCount: 10, rackAware: true }))).toContain('HW_RACK_ZONES')
    expect(codes(hw({ nodeCount: 4, rackAware: true, capacityMediaType: 'hdd', cacheMediaType: 'nvme', cacheDrivesPerNode: 2, cacheDriveSizeTB: 1.6 }))).toContain('HW_RACK_ALL_FLASH')
    const notes = platformRuleIssues(hw({ nodeCount: 2, rackAware: true })).find(i => i.code === 'HW_RACK_NOTES')
    expect(notes?.message).toMatch(/Active Directory/)
    expect(notes?.message).toMatch(/cannot be expanded/)
    expect(codes(hw({ nodeCount: 4, rackAware: true }))).toEqual(['HW_RACK_NOTES'])
  })
  it('fit: candidates are 2, 4, 6, 8 and the surviving zone is checked', () => {
    const state = normalizePersistedState({ hardware: hw({ nodeCount: 4, rackAware: true }) })
    const fit = assessHardwareFit(state as never)
    expect(fit.candidates.map(c => c.nodeCount)).toEqual([2, 4, 6, 8])
    // 2 surviving nodes x 32 cores x 2 threads x 4:1 = 512 vCPU - 2 x 4 reserved = 504
    expect(fit.current.rackLoss?.cpu).toBe(504)
    // 2 x (512 - 8) = 1008 GB
    expect(fit.current.rackLoss?.memory).toBe(1008)
  })
  it('fit: a standard cluster rejects four-way mirror volumes, a rack aware one rejects 3 nodes', () => {
    const volumes = [{ id: 'v', name: 'V', plannedSizeTB: 1, resiliency: 'four-way-mirror', provisioning: 'fixed' }]
    const standard = assessHardwareFit(normalizePersistedState({ hardware: hw({ nodeCount: 5 }), volumes }) as never)
    expect(standard.current.errors.join(' ')).toMatch(/only on rack aware/)
    const three = assessHardwareFit(normalizePersistedState({ hardware: hw({ nodeCount: 3, rackAware: true }) }) as never)
    expect(three.current.errors.join(' ')).toMatch(/2, 4, 6 or 8/)
  })
})

describe('dual parity efficiency tables (Learn fault-tolerance)', () => {
  it('all-flash: 4-6 = 50%, 7-8 = 66.7%, 9-15 = 75%, 16 = 80%', () => {
    expect([4, 6, 7, 8, 9, 15, 16].map(n => getResiliencyFactor('dual-parity', n))).toEqual([0.5, 0.5, 2 / 3, 2 / 3, 0.75, 0.75, 0.8])
  })
  it('hybrid: 4-6 = 50%, 7-11 = 66.7%, 12-16 = 72.7% (8/11 = LRC 8,2,1)', () => {
    expect([4, 6, 7, 11].map(n => getResiliencyFactor('dual-parity', n, true))).toEqual([0.5, 0.5, 2 / 3, 2 / 3])
    expect(getResiliencyFactor('dual-parity', 12, true)).toBeCloseTo(0.7273, 4)
    expect(getResiliencyFactor('dual-parity', 16, true)).toBeCloseTo(0.7273, 4)
  })
  it('capacity uses the hybrid table when capacity media is HDD', () => {
    const h = hw({ nodeCount: 12, capacityMediaType: 'hdd', capacityDriveSizeTB: 10, capacityDrivesPerNode: 8, cacheMediaType: 'nvme', cacheDrivesPerNode: 2, cacheDriveSizeTB: 3.2 })
    const c = computeCapacity(h, adv({ defaultResiliency: 'dual-parity' }))
    expect(c.resiliencyFactor).toBeCloseTo(8 / 11, 6)
    expect(c.hybridCapacity).toBe(true)
  })
})

describe('facts registry', () => {
  it('every fact has a Learn URL and a verified date', () => {
    for (const f of PLATFORM_FACTS) {
      expect(f.url).toMatch(/^https:\/\/learn\.microsoft\.com\//)
      expect(f.verified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
  it('every rule issue cites a registered fact', () => {
    const ids = new Set(PLATFORM_FACTS.map(f => f.id))
    const issues = [
      ...platformRuleIssues(hw({ nodeCount: 1, cacheMediaType: 'nvme', cacheDrivesPerNode: 1, capacityMediaType: 'hdd', capacityDrivesPerNode: 1 })),
      ...platformRuleIssues(hw({ nodeCount: 3, rackAware: true, capacityMediaType: 'hdd', cacheMediaType: 'nvme', cacheDrivesPerNode: 1, cacheDriveSizeTB: 0.01 })),
      ...platformRuleIssues(hw({ nodeCount: 20 })),
    ]
    expect(issues.length).toBeGreaterThan(5)
    for (const i of issues) expect(ids.has(i.factId)).toBe(true)
  })
})
