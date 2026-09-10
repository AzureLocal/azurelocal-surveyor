import { normalizePersistedState, storageSnapshot, type SurveyorState } from './store'
import { version } from '../../package.json'
import { computePlanning } from '../engine/planning'
import { suggestPlanningVolumes } from '../engine/planning'

export interface SurveyorProject {
  planningArea?: 'storage' | 'workload'
  kind: 'azurelocal-surveyor-project'
  schemaVersion: 1
  stateVersion: 10
  appVersion: string
  name: string
  savedAt: string
  inputs: ReturnType<typeof normalizePersistedState>
}

export function createProject(state: SurveyorState, name: string, planningArea: 'storage' | 'workload' = 'workload'): SurveyorProject {
  return {
    kind: 'azurelocal-surveyor-project', schemaVersion: 1, stateVersion: 10,
    planningArea,
    appVersion: version, name: name.trim() || 'Azure Local plan', savedAt: new Date().toISOString(),
    inputs: structuredClone(planningArea === 'storage' ? storageSnapshot(state) : normalizePersistedState(state)),
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function checkNumbers(value: unknown): void {
  if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) throw new Error('Project inputs contain an invalid or negative number.')
  if (value && typeof value === 'object') Object.values(value).forEach(checkNumbers)
}

/** Fully parse before restoring so a rejected file cannot partially replace the active plan. */
export function parseProject(text: string): { name: string; planningArea: 'storage' | 'workload'; inputs: ReturnType<typeof normalizePersistedState> } {
  const file: unknown = JSON.parse(text)
  if (!record(file)) throw new Error('Not an Azure Local Surveyor project.')
  const project = file.kind === 'azurelocal-surveyor-project'
  const manifest = file.kind === undefined && file.schemaVersion === '1.0' && typeof file.surveyorVersion === 'string'
  if (!project && !manifest) throw new Error('Choose an Azure Local Surveyor project or plan manifest JSON file.')
  if (file.planningArea !== undefined && !['storage', 'workload'].includes(String(file.planningArea))) throw new Error('Invalid planning area.')
  if (project && (file.schemaVersion !== 1 || file.stateVersion !== 10)) throw new Error('Unsupported project version. Open it with a compatible Surveyor version.')
  if (!record(file.inputs)) throw new Error('The project has no input snapshot.')
  const inputs = file.inputs
  for (const key of ['hardware', 'advanced', 'avd', 'aks', 'virtualMachines', 'sofs', 'mabs']) {
    if (!record(inputs[key])) throw new Error(`Project is missing ${key} inputs.`)
  }
  for (const key of ['volumes', 'customWorkloads', 'servicePresets']) {
    if (!Array.isArray(inputs[key])) throw new Error(`Project is missing ${key}.`)
  }
  for (const key of ['avdEnabled', 'sofsEnabled', 'mabsEnabled']) {
    if (typeof inputs[key] !== 'boolean') throw new Error(`Invalid ${key} flag.`)
  }
  if (project && (!Array.isArray(inputs.inventory) || !record(inputs.inventorySettings))) throw new Error('The project is missing its inventory or sizing settings.')
  checkNumbers(inputs)
  const state = normalizePersistedState(inputs)
  for (const key of ['nodeCount', 'coresPerNode', 'memoryPerNodeGB', 'capacityDrivesPerNode', 'capacityDriveSizeTB'] as const) {
    if (typeof state.hardware[key] !== 'number' || state.hardware[key] <= 0) throw new Error(`Invalid hardware ${key}.`)
  }
  if (!(state.advanced.vCpuOversubscriptionRatio >= 1) || !(state.virtualMachines.vCpuOvercommitRatio >= 1)) throw new Error('CPU overcommit ratios must be at least 1.')
  // Arrays contain structured records; primitive rows must never reach a planner.
  for (const rows of [state.avd.pools, state.aks.clusters, state.virtualMachines.groups, state.volumes, state.customWorkloads, state.servicePresets]) {
    if (!Array.isArray(rows) || rows.some(row => !record(row))) throw new Error('Project contains malformed workload or volume rows.')
  }
  const numericRows: [object[], string[]][] = [
    [state.virtualMachines.groups, ['vmCount', 'vCpusPerVm', 'memoryPerVmGB', 'storagePerVmGB']],
    [state.customWorkloads, ['vmCount', 'vCpusPerVm', 'memoryPerVmGB', 'osDiskPerVmGB', 'storageTB', 'internalMirrorFactor']],
    [state.volumes, ['plannedSizeTB']],
    [state.aks.clusters, ['controlPlaneNodesPerCluster', 'workerNodesPerCluster', 'vCpusPerWorker', 'memoryPerWorkerGB', 'osDiskPerNodeGB', 'persistentVolumesTB']],
    [state.servicePresets, ['instanceCount']],
  ]
  for (const [rows, keys] of numericRows) for (const row of rows) {
    const entry = row as Record<string, unknown>
    if (typeof entry.id !== 'string' || !entry.id) throw new Error('A workload or volume is missing its ID.')
    if (keys.some(key => typeof entry[key] !== 'number' || !Number.isFinite(entry[key]))) throw new Error('A workload or volume is missing required numeric inputs.')
  }
  const resiliencies = ['two-way-mirror', 'three-way-mirror', 'dual-parity', 'nested-two-way']
  if (!resiliencies.includes(state.advanced.defaultResiliency) || state.volumes.some(v => !resiliencies.includes(v.resiliency) || !['fixed', 'thin'].includes(v.provisioning) || typeof v.name !== 'string')) throw new Error('Invalid volume resiliency, provisioning, or name.')
  if (state.inventorySources.some(source => !source || typeof source.fileName !== 'string' || typeof source.importedAt !== 'string' || !['rvtools', 'performance'].includes(source.kind) || !Number.isFinite(source.rows))) throw new Error('Invalid inventory import history.')
  const totals = computePlanning(state).workloadTotals
  if (!Object.values(totals).every(Number.isFinite) || suggestPlanningVolumes(state).some(volume => !Number.isFinite(volume.plannedSizeTB))) throw new Error('Project inputs produced invalid sizing results.')
  return { name: typeof file.name === 'string' ? file.name : 'Imported plan manifest', planningArea: file.planningArea === 'storage' ? 'storage' : 'workload', inputs: state }
}

export function downloadProject(project: SurveyorProject): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${project.name.replace(/[^a-z0-9-]/gi, '-').slice(0, 80) || 'azurelocal-plan'}.surveyor.json`
  anchor.click(); URL.revokeObjectURL(url)
}
