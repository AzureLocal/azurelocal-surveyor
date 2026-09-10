import { describe, expect, it } from 'vitest'
import { createSurveyorStore, storageSnapshot } from './store'
import { createProject, parseProject } from './project'
import { storageReportData, storageMarkdown } from '../exporters/storage'
import { computePlanning } from '../engine/planning'

describe('Independent planning areas', () => {
  it('isolates hardware, workloads, restore and reset between stores', () => {
    const workload = createSurveyorStore('test-workload')
    const storage = createSurveyorStore('surveyor-storage-state')
    workload.getState().setHardware({ nodeCount: 8 })
    workload.getState().setAvdEnabled(true)
    storage.getState().setHardware({ nodeCount: 6 })
    expect(workload.getState().hardware.nodeCount).toBe(8)
    const snapshot = createProject(workload.getState(), 'Workload')
    storage.getState().restoreProject(snapshot.inputs)
    expect(storage.getState().hardware.nodeCount).toBe(8)
    expect(storage.getState().avdEnabled).toBe(false)
    expect(computePlanning(storage.getState()).workloadTotals.totalVCpus).toBe(0)
    storage.getState().resetAll()
    expect(storage.getState().hardware.nodeCount).toBe(4)
    expect(workload.getState().avdEnabled).toBe(true)
    expect(workload.getState().hardware.nodeCount).toBe(8)
  })
  it('round-trips the planning area and defaults legacy files to workload planning', () => {
    const s = createSurveyorStore('test-project').getState()
    const project = createProject(s, 'Storage', 'storage')
    expect(parseProject(JSON.stringify(project)).planningArea).toBe('storage')
    const { planningArea: _area, ...legacy } = project
    expect(_area).toBe('storage')
    expect(parseProject(JSON.stringify(legacy)).planningArea).toBe('workload')
    expect(() => parseProject(JSON.stringify({ ...project, planningArea: 'invalid' }))).toThrow(/planning area/)
  })
  it('keeps workload demand out of storage snapshots, projects and exported reports', () => {
    const store = createSurveyorStore('test-export')
    store.getState().setAvdEnabled(true)
    store.getState().setHardware({ nodeCount: 6 })
    const s = store.getState()
    expect(computePlanning(s).workloadTotals.totalVCpus).toBeGreaterThan(0)
    expect(computePlanning(storageSnapshot(s)).workloadTotals.totalVCpus).toBe(0)
    expect(createProject(s, 'Storage', 'storage').inputs.avdEnabled).toBe(false)
    const report = storageReportData(s)
    expect(report.capacity.rawPoolTB).toBeCloseTo(6 * 6 * 3.84)
    expect(report.tables.map(t => t.title)).toEqual(['Hardware', 'Capacity', 'Volumes', 'Assumptions', 'Checks'])
    expect(storageMarkdown(s)).toContain('Standalone storage plan; no workload demand included.')
    expect(storageMarkdown(s)).not.toContain('Session hosts')
  })
})
