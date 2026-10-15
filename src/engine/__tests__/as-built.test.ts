import { describe, expect, it } from 'vitest'
import { normalizePersistedState } from '../../state/store'
import { compareBuiltToDemand, parseAsBuilt } from '../as-built'
import type { InventoryVm } from '../inventory'

/**
 * Demand: 10 VMs x 8 vCPU / 32 GiB / 200 GiB provisioned (inventory, allocation basis, no growth).
 *   vCPU 80, memory 320 GiB. Hardware per node: 32 cores x 2 threads x 4:1 = 256 vCPU - 4 reserved = 252;
 *   memory 512 - 8 = 504 GiB.
 *   4 nodes: 1008 vCPU, 2016 GiB. N+1 (3 nodes): 756 vCPU, 1512 GiB.
 *   1 node: 252 vCPU, 504 GiB; N+1 leaves 0 nodes.
 */
const vm = (i: number): InventoryVm => ({ id: `vm${i}`, name: `VM-${i}`, tier: 'general', include: true, vCpu: 8, memoryGiB: 32, consumedGiB: 100, provisionedGiB: 200, powerState: 'on', sourceCluster: '', sourceHost: '', guestOs: '', reviewed: true })
const hardware = { nodeCount: 4, coresPerNode: 32, memoryPerNodeGB: 512, capacityDrivesPerNode: 8, capacityDriveSizeTB: 3.84, capacityMediaType: 'nvme', cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, cacheMediaType: 'none', hyperthreadingEnabled: true }
const state = () => normalizePersistedState({ hardware, advanced: { defaultResiliency: 'three-way-mirror' }, inventory: Array.from({ length: 10 }, (_, i) => vm(i)), inventorySettings: { growthPct: 0 } })
const record = (over: Record<string, unknown> = {}) => JSON.stringify({ kind: 'azurelocal-surveyor-asbuilt', schemaVersion: 1, source: 'fixture', hardware: { ...hardware, ...over } })

describe('as-built record', () => {
  it('parses the as-built format, a bare hardware object and a Surveyor project', () => {
    expect(parseAsBuilt(record())).toMatchObject({ ok: true, record: { source: 'fixture', hardware: { nodeCount: 4 } } })
    expect(parseAsBuilt(JSON.stringify(hardware))).toMatchObject({ ok: true })
    expect(parseAsBuilt(JSON.stringify({ kind: 'azurelocal-surveyor-project', inputs: { hardware, volumes: [] } }))).toMatchObject({ ok: true, record: { source: 'Surveyor project' } })
  })
  it('rejects bad input with a readable message', () => {
    expect(parseAsBuilt('{nope')).toEqual({ ok: false, error: 'This is not valid JSON.' })
    expect(parseAsBuilt(record({ nodeCount: 17 }))).toMatchObject({ ok: false })
    expect(parseAsBuilt(record({ nodeCount: 0 }))).toMatchObject({ ok: false })
    expect(parseAsBuilt(JSON.stringify({ kind: 'azurelocal-surveyor-asbuilt', schemaVersion: 2, hardware }))).toMatchObject({ ok: false })
    expect(parseAsBuilt('[]')).toMatchObject({ ok: false })
  })
  it('4 nodes carries 80 vCPU / 320 GiB with N+1 headroom: (1008-80)/1008 = 92.1% CPU, (2016-320)/2016 = 84.1% memory', () => {
    const parsed = parseAsBuilt(record())
    if (!parsed.ok) throw new Error(parsed.error)
    const c = compareBuiltToDemand(state() as never, parsed.record.hardware)
    expect(c.verdict).toBe('fits-with-n1')
    expect(c.built.cpu).toBe(1008)
    expect(c.built.memory).toBe(2016)
    expect(c.builtWithN1.cpu).toBe(756)
    expect(c.builtWithN1.memory).toBe(1512)
    expect(c.headroom.cpu).toBeCloseTo(928 / 1008, 6)
    expect(c.headroom.memory).toBeCloseTo(1696 / 2016, 6)
  })
  it('a one node build has 252 vCPU, carries 80 but has no N+1', () => {
    const parsed = parseAsBuilt(record({ nodeCount: 1 }))
    if (!parsed.ok) throw new Error(parsed.error)
    const c = compareBuiltToDemand(state() as never, parsed.record.hardware)
    expect(c.built.cpu).toBe(252)
    expect(c.verdict === 'fits-no-n1' || c.verdict === 'does-not-fit').toBe(true)
    expect(c.n1Fits).toBe(false)
    expect(c.notes.join(' ')).toMatch(/Single node/)
  })
  it('too little memory does not fit: 2 x (128 - 8) = 240 GiB < 320 GiB', () => {
    const parsed = parseAsBuilt(record({ nodeCount: 2, memoryPerNodeGB: 128 }))
    if (!parsed.ok) throw new Error(parsed.error)
    expect(compareBuiltToDemand(state() as never, parsed.record.hardware).verdict).toBe('does-not-fit')
  })
})
