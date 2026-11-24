import Ajv2020 from 'ajv/dist/2020'
import { describe, expect, it } from 'vitest'
import schemaText from '../../docs/reference/sizing-handoff.schema.json?raw'
import exampleText from '../../docs/reference/sizing-handoff.example.json?raw'
import hardwareForm from '../components/HardwareForm.tsx?raw'
import advancedSettings from '../components/AdvancedSettings.tsx?raw'
import computeReport from '../components/ComputeReport.tsx?raw'
import recommendationsPage from '../pages/RecommendationsPage.tsx?raw'
import { normalizePersistedState, useSurveyorStore } from '../state/store'
import { SCHEMA5_RESILIENCY, createSizingHandoff, sizingHandoffFilename, sizingHandoffProblems, tbToGib } from './sizing-handoff'

const schema = JSON.parse(schemaText) as object
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false })
const validate = ajv.compile(schema)
const NOW = new Date('2026-11-23T12:00:00.000Z')

describe('sizing handoff for Trailwright', () => {
  it('describes the default plan and follows its published schema', () => {
    const h = createSizingHandoff({ ...useSurveyorStore.getState() }, NOW)
    expect(validate(h), JSON.stringify(validate.errors)).toBe(true)
    const hw = useSurveyorStore.getState().hardware
    expect(h).toMatchObject({ kind: 'azurelocal-sizing-handoff', schemaVersion: '1.1', generatedBy: 'azurelocal-surveyor', generatedAt: NOW.toISOString() })
    expect(h.targetRelease).toMatch(/^Azure Local 12\.\d{4}$/)
    expect(h.cluster).toEqual({ node_count: hw.nodeCount, topology: 'standard' })
    expect(h.hardware.cpu_cores).toBe(hw.coresPerNode)
    expect(h.hardware.memory_gib).toBe(hw.memoryPerNodeGB)
    expect(h.hardware.drives.capacity).toEqual({ media: hw.capacityMediaType, count: hw.capacityDrivesPerNode, size_tb: hw.capacityDriveSizeTB })
    expect(sizingHandoffFilename(NOW)).toBe('azure-local-sizing-handoff-2026-11-23.json')
  })

  it('writes the volumes in the infrastructure.yml spelling, the decimal TB plan in GiB rounded down', () => {
    const state = { ...useSurveyorStore.getState(), volumes: [{ id: 'v1', name: 'Data', resiliency: 'three-way-mirror' as const, provisioning: 'fixed' as const, plannedSizeTB: 2.5 }] }
    const h = createSizingHandoff(state, NOW)
    expect(h.storage.volumes).toEqual([{ name: 'Data', size_gib: 2328, resiliency: 'three_way', provisioning_type: 'fixed', provisioning: 'fixed' }])
    expect(validate(h)).toBe(true)
  })

  it('marks a rack aware plan and carries a four-way mirror', () => {
    const rack = normalizePersistedState({ hardware: { ...useSurveyorStore.getState().hardware, nodeCount: 4, rackAware: true, cacheMediaType: 'none', cacheDrivesPerNode: 0 } })
    const state = { ...useSurveyorStore.getState(), ...rack, volumes: [{ id: 'v1', name: 'Zoned', resiliency: 'four-way-mirror' as const, provisioning: 'fixed' as const, plannedSizeTB: 1 }] }
    const h = createSizingHandoff(state, NOW)
    expect(h.cluster).toEqual({ node_count: 4, topology: 'rack_aware' })
    expect(h.hardware.drives.cache).toBeUndefined()
    expect(h.storage.volumes[0].resiliency).toBe('four_way')
    expect(validate(h), JSON.stringify(validate.errors)).toBe(true)
  })

  it('maps every Surveyor resiliency to a schema 5 value', () => {
    expect(Object.values(SCHEMA5_RESILIENCY).sort()).toEqual(['four_way', 'nested_two_way', 'parity', 'three_way', 'two_way'])
  })
})

// docs/reference/sizing-handoff.example.json is what Surveyor writes for the default plan with two volumes. Trailwright imports
// a copy of it (tests/fixtures/surveyor-sizing-handoff.json). When the output changes on purpose, update the example from the diff.
describe('the published example', () => {
  it('is what Surveyor writes today', () => {
    const state = {
      ...useSurveyorStore.getState(),
      planName: 'Example plan',
      volumes: [
        { id: 'v1', name: 'Volume1', resiliency: 'two-way-mirror' as const, provisioning: 'fixed' as const, plannedSizeTB: 4.44 },
        { id: 'v2', name: 'Volume2', resiliency: 'two-way-mirror' as const, provisioning: 'thin' as const, plannedSizeTB: 2 },
      ],
    }
    const fresh = { ...createSizingHandoff(state, NOW), surveyorVersion: 'x.y.z' }
    expect(JSON.parse(exampleText)).toEqual(fresh)
    expect(validate(fresh)).toBe(true)
  })
})

describe('what stops the handoff', () => {
  it('a plan outside the contract is not written, and says why', () => {
    const base = createSizingHandoff({ ...useSurveyorStore.getState() }, NOW)
    expect(sizingHandoffProblems(base)).toEqual([])
    const bad = { ...base, cluster: { ...base.cluster, node_count: 17 }, hardware: { ...base.hardware, memory_gib: 64.5 } }
    expect(sizingHandoffProblems(bad)).toHaveLength(2)
    expect(validate(bad)).toBe(false)
  })
  it('converts decimal TB to GiB, rounded down', () => {
    expect(tbToGib(1)).toBe(931)
    expect(tbToGib(0)).toBe(0)
  })
})

describe('memory is labelled GiB wherever it is the per-machine value that goes to memory_gib', () => {
  it('keeps the value unconverted and the labels in GiB', () => {
    const state = { ...useSurveyorStore.getState() }
    expect(createSizingHandoff(state, NOW).hardware.memory_gib).toBe(state.hardware.memoryPerNodeGB)
    const labels = [
      [hardwareForm, 'RAM / node (GiB)'],
      [hardwareForm, 'physical cores · {selectedPreset.memoryPerNodeGB} GiB RAM'],
      [recommendationsPage, '{option.hardware.memoryPerNodeGB} GiB RAM per node'],
      [advancedSettings, 'System reserved memory / node (GiB)'],
      [computeReport, 'value={`${result.physicalMemoryGB} GiB`}'],
    ] as const
    for (const [source, label] of labels) expect(source).toContain(label)
    for (const source of [hardwareForm, recommendationsPage, advancedSettings]) {
      expect(source).not.toMatch(/RAM \/ node \(GB\)|memoryPerNodeGB\} GB|reserved memory \/ node \(GB\)/)
    }
  })
})
