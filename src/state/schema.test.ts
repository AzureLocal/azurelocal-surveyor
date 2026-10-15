import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import projectSchemaText from '../../docs/reference/project.schema.json?raw'
import manifestSchemaText from '../../docs/reference/plan-manifest.schema.json?raw'
import { createProject } from './project'
import { createPlanManifest } from '../exporters/json'
import { normalizePersistedState, useSurveyorStore } from './store'

/**
 * The JSON Schema files in docs/reference describe the two files Surveyor writes. These tests validate
 * freshly written files (standard, single node, rack aware) and a stateVersion 10 file against them.
 */
const read = (name: string) => JSON.parse(name === 'project.schema.json' ? projectSchemaText : manifestSchemaText)
const ajv = new Ajv2020({ strict: false, allErrors: true })
const projectSchema = read('project.schema.json')
ajv.addSchema(projectSchema)
const validateProject = ajv.compile(projectSchema)
const validateManifest = ajv.compile(read('plan-manifest.schema.json'))

const base = () => ({ ...useSurveyorStore.getState() })
const variant = (hardware: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
  const s = base()
  return { ...s, ...normalizePersistedState({ ...s, hardware: { ...s.hardware, ...hardware }, ...extra }) }
}
const fixtures = {
  standard: () => base(),
  'single node': () => variant({ nodeCount: 1, cacheMediaType: 'none', cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, capacityMediaType: 'nvme' }),
  'rack aware 2+2': () => variant({ nodeCount: 4, rackAware: true, cacheMediaType: 'none', cacheDrivesPerNode: 0, cacheDriveSizeTB: 0, capacityMediaType: 'nvme' }, { volumes: [{ id: 'v1', name: 'V1', plannedSizeTB: 2, resiliency: 'four-way-mirror', provisioning: 'fixed' }] }),
}

describe('docs/reference JSON Schemas', () => {
  for (const [name, make] of Object.entries(fixtures)) {
    it(`project file validates: ${name}`, () => {
      const ok = validateProject(JSON.parse(JSON.stringify(createProject(make() as never, 'Fixture'))))
      expect(validateProject.errors ?? []).toEqual([])
      expect(ok).toBe(true)
    })
    it(`plan manifest validates: ${name}`, () => {
      const ok = validateManifest(JSON.parse(JSON.stringify(createPlanManifest(make() as never))))
      expect(validateManifest.errors ?? []).toEqual([])
      expect(ok).toBe(true)
    })
  }
  it('a stateVersion 10 project (no rackAware) still validates', () => {
    const project = JSON.parse(JSON.stringify(createProject(base() as never, 'Old')))
    project.stateVersion = 10
    expect(validateProject(project)).toBe(true)
  })
  it('rejects wrong kind, unknown state version, zero nodes, 17 nodes and unknown hardware keys', () => {
    const good = JSON.parse(JSON.stringify(createProject(base() as never, 'Bad')))
    const mutate = (fn: (p: typeof good) => void) => { const p = structuredClone(good); fn(p); return validateProject(p) }
    expect(mutate(p => { p.kind = 'other' })).toBe(false)
    expect(mutate(p => { p.stateVersion = 12 })).toBe(false)
    expect(mutate(p => { p.inputs.hardware.nodeCount = 0 })).toBe(false)
    expect(mutate(p => { p.inputs.hardware.nodeCount = 17 })).toBe(false)
    expect(mutate(p => { p.inputs.hardware.rackAware = false })).toBe(false)
    expect(mutate(p => { p.inputs.hardware.surprise = 1 })).toBe(false)
    expect(mutate(p => { p.inputs.volumes = [{ id: 'x', name: 'x', resiliency: 'five-way', provisioning: 'fixed', plannedSizeTB: 1 }] })).toBe(false)
  })
  it('manifest schema pins the major version', () => {
    const m = JSON.parse(JSON.stringify(createPlanManifest(base() as never)))
    m.schemaVersion = '2.0'
    expect(validateManifest(m)).toBe(false)
  })
  it('schema files carry a version marker', () => {
    expect(projectSchema['x-schemaVersion']).toBe(1)
    expect(read('plan-manifest.schema.json')['x-schemaVersion']).toBe('1.0')
  })
})
