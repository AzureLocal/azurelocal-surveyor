import { describe, it, expect } from 'vitest'
import { createProject, parseProject } from './project'
import { migratePersistedState, normalizePersistedState, useSurveyorStore } from './store'
import { createPlanManifest } from '../exporters/json'
import { generateMarkdown } from '../exporters/markdown'
import { computePlanning } from '../engine/planning'
import type { InventoryVm } from '../engine/inventory'

const vm: InventoryVm = { id: 'iic-vm', name: 'IIC-VM-01', tier: 'general', include: true, vCpu: 8, memoryGiB: 32, consumedGiB: 100, provisionedGiB: 200, powerState: 'on', sourceCluster: 'IIC', sourceHost: 'IIC-Host', guestOs: 'Windows', reviewed: true, measurement: { cpuP95Pct: 40, observationDays: 14 } }
const state = () => ({ ...useSurveyorStore.getState(), ...normalizePersistedState({ inventory: [vm], inventorySettings: { sizingBasis: 'measured-p95' } }) })

describe('Reopenable planning projects', () => {
  it('round-trips inventory, performance, specialized planners, and configuration', () => {
    const original = state()
    const project = createProject(original, 'IIC proposal')
    const reopened = parseProject(JSON.stringify(project))
    expect(reopened.name).toBe('IIC proposal')
    expect(reopened.inputs).toEqual(project.inputs)
    expect(computePlanning(reopened.inputs).workloadTotals).toEqual(computePlanning(original).workloadTotals)
  })
  it('takes an independent snapshot', () => {
    const original = state(); const snapshot = createProject(original, 'Before')
    original.inventory[0].name = 'Changed'
    expect(snapshot.inputs.inventory[0].name).toBe('IIC-VM-01')
    original.inventory[0].name = 'IIC-VM-01'
  })
  it('reopens the existing plan-manifest format', () => {
    const manifest = createPlanManifest(state())
    const reopened = parseProject(JSON.stringify(manifest))
    expect(reopened.inputs.inventory[0].measurement?.cpuP95Pct).toBe(40)
    expect(manifest.outputs.workloadTotals).toEqual(computePlanning(reopened.inputs).workloadTotals)
  })
  it('preserves old v9 groups without manufacturing duplicate inventory', () => {
    const old = normalizePersistedState({})
    old.virtualMachines.enabled = true
    const migrated = migratePersistedState(old, 9) as typeof old
    expect(migrated.inventory).toEqual([])
    expect(migrated.virtualMachines).toEqual(old.virtualMachines)
  })
  it('rejects unsupported project versions and unrelated JSON', () => {
    const project = createProject(state(), 'IIC')
    expect(() => parseProject(JSON.stringify({ ...project, schemaVersion: 99 }))).toThrow(/version/)
    expect(() => parseProject('{}')).toThrow(/project/)
  })
  it('rejects incomplete or corrupt inputs before restoration', () => {
    const project = createProject(state(), 'IIC')
    expect(() => parseProject(JSON.stringify({ ...project, inputs: { hardware: {} } }))).toThrow()
    project.inputs.inventory[0].memoryGiB = -1
    expect(() => parseProject(JSON.stringify(project))).toThrow()
  })
  it('rejects malformed workload groups', () => {
    const project = createProject(state(), 'IIC')
    const invalid = { ...project, inputs: { ...project.inputs, virtualMachines: { enabled: true, vCpuOvercommitRatio: 1, groups: [{ id: 'missing-resources' }] } } }
    expect(() => parseProject(JSON.stringify(invalid))).toThrow(/numeric/)
  })
  it('keeps JSON and Markdown totals consistent for inventory, mirrored custom data and AKS-hosted services', () => {
    const s = state()
    s.aks = { ...s.aks, enabled: true }
    s.servicePresets = [{ id: 'sql', catalogId: 'arc-sql-mi-gp', enabled: true, instanceCount: 1 }]
    s.customWorkloads = [{ id: 'custom', name: 'Mirrored data', description: '', enabled: true, vmCount: 2, vCpusPerVm: 4, memoryPerVmGB: 8, osDiskPerVmGB: 0, storageTB: 2, internalMirrorFactor: 3, bandwidthMbps: 0 }]
    const totals = computePlanning(s).workloadTotals
    expect(totals.totalVCpus).toBe(28) // 4 measured inventory + 16 AKS + 8 custom; service compute lives in AKS.
    expect(totals.totalStorageTB).toBeGreaterThan(6)
    expect(createPlanManifest(s).outputs.workloadTotals).toEqual(totals)
    const markdown = generateMarkdown(s)
    expect(markdown).toContain(`**${totals.totalVCpus}**`)
    expect(markdown).toContain('VM Inventory')
    expect(markdown).toContain('measured-p95')
    expect(markdown).toContain('Workload Fit')
  })
})

describe('State version 11 (rack aware and single node)', () => {
  it('writes stateVersion 11 and keeps rackAware absent on standard plans', () => {
    const project = createProject(state(), 'Standard')
    expect(project.stateVersion).toBe(11)
    expect('rackAware' in project.inputs.hardware).toBe(false)
  })
  it('still opens a version 10 project file unchanged', () => {
    const project = createProject(state(), 'Old')
    const reopened = parseProject(JSON.stringify({ ...project, stateVersion: 10 }))
    expect(reopened.inputs.hardware.nodeCount).toBe(project.inputs.hardware.nodeCount)
    expect(() => parseProject(JSON.stringify({ ...project, stateVersion: 12 }))).toThrow(/version/)
  })
  it('round-trips rackAware, four-way mirror volumes and one node', () => {
    const base = state()
    const rack = { ...base, ...normalizePersistedState({ ...base, hardware: { ...base.hardware, nodeCount: 4, rackAware: true }, volumes: [{ id: 'v1', name: 'V1', plannedSizeTB: 1, resiliency: 'four-way-mirror', provisioning: 'fixed' }] }) }
    const reopened = parseProject(JSON.stringify(createProject(rack, 'Rack')))
    expect(reopened.inputs.hardware.rackAware).toBe(true)
    expect(reopened.inputs.volumes[0].resiliency).toBe('four-way-mirror')
    const single = normalizePersistedState({ hardware: { nodeCount: 1 } })
    expect(single.hardware.nodeCount).toBe(1)
  })
  it('migration drops a stray rackAware value from an older save', () => {
    const migrated = migratePersistedState({ hardware: { nodeCount: 3, rackAware: 'yes' } }, 10) as { hardware: Record<string, unknown> }
    expect('rackAware' in migrated.hardware).toBe(false)
  })
})
