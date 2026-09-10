import type { SurveyorState } from '../state/store'
import { computeAvd } from './avd'
import { computeAks } from './aks'
import { computeSofs } from './sofs'
import { computeMabs } from './mabs'
import { computeWorkloadTotals } from './workloads'
import { generateWorkloadVolumes } from './workload-volumes'

export type PlanningInputs = Pick<SurveyorState, 'advanced' | 'avd' | 'avdEnabled' | 'aks' | 'virtualMachines' | 'sofs' | 'sofsEnabled' | 'mabs' | 'mabsEnabled' | 'customWorkloads' | 'servicePresets'> & Partial<Pick<SurveyorState, 'inventory' | 'inventorySettings'>>

/** Shared demand path for screens, fit calculations, and every report exporter. */
export function computePlanning(state: PlanningInputs) {
  const avd = computeAvd(state.avd, state.advanced.overrides)
  const aks = computeAks(state.aks)
  const sofs = computeSofs(state.sofs, state.advanced.overrides)
  const mabs = computeMabs(state.mabs)
  const workloadTotals = computeWorkloadTotals({
    avdEnabled: state.avdEnabled, avd, aksEnabled: state.aks.enabled, aks,
    virtualMachines: state.virtualMachines, sofsEnabled: state.sofsEnabled, sofs,
    mabsEnabled: state.mabsEnabled, mabs, servicePresets: state.servicePresets,
    customWorkloads: state.customWorkloads, inventory: state.inventory, inventorySettings: state.inventorySettings,
  })
  return { avd, aks, sofs, mabs, workloadTotals }
}

export function suggestPlanningVolumes(state: PlanningInputs) {
  const { avd, aks, sofs, mabs } = computePlanning(state)
  return generateWorkloadVolumes({
    advanced: state.advanced, avdEnabled: state.avdEnabled, avdResult: avd,
    aksEnabled: state.aks.enabled, aksResult: aks, aksInputs: state.aks,
    virtualMachines: state.virtualMachines, sofsEnabled: state.sofsEnabled,
    sofsInputs: state.sofs, sofsResult: sofs, mabsEnabled: state.mabsEnabled,
    mabsInputs: state.mabs, mabsResult: mabs, servicePresets: state.servicePresets,
    customWorkloads: state.customWorkloads, inventory: state.inventory, inventorySettings: state.inventorySettings,
  })
}
