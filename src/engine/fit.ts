import type { HardwareInputs, VolumeSpec } from './types'
import { computeCapacity, getResiliencyFactor, minNodesForResiliency } from './capacity'
import { computeCompute } from './compute'
import { computeInventory } from './inventory'
import { computePlanning, suggestPlanningVolumes, type PlanningInputs } from './planning'

export type FitInputs = PlanningInputs & { hardware: HardwareInputs; volumes: VolumeSpec[] }
// This is the range implemented by Surveyor's existing S2D engine, not a universal platform limit.
export const PLANNER_NODE_RANGE = { min: 2, max: 16 }

export function assessHardwareFit(state: FitInputs) {
  const demand = computePlanning(state).workloadTotals
  const suggested = suggestPlanningVolumes(state)
  const reserveNodes = state.advanced.maintenanceReserveMode === 'n+2' ? 2 : state.advanced.maintenanceReserveMode === 'n+1' ? 1 : 0
  const hasDemand = demand.totalVCpus > 0 || demand.totalMemoryGB > 0 || demand.totalStorageTB > 0
  const evaluate = (nodeCount: number) => {
    const hardware = { ...state.hardware, nodeCount }
    const capacity = computeCapacity(hardware, state.advanced)
    const compute = computeCompute(hardware, state.advanced)
    const cpu = reserveNodes === 2 ? compute.usableVCpusN2 : reserveNodes === 1 ? compute.usableVCpusN1 : compute.usableVCpus
    const memory = reserveNodes === 2 ? compute.usableMemoryGBN2 : reserveNodes === 1 ? compute.usableMemoryGBN1 : compute.usableMemoryGB
    const footprint = (volumes: VolumeSpec[]) => volumes.reduce((sum, v) => sum + v.plannedSizeTB / getResiliencyFactor(v.resiliency, nodeCount), 0)
    const workloadFootprintTB = footprint(suggested)
    const plannedFootprintTB = footprint(state.volumes)
    // Workload suggestions and the edited layout describe the same storage: test both independently.
    const requiredFootprintTB = Math.max(workloadFootprintTB, plannedFootprintTB)
    const errors: string[] = []
    if (nodeCount < PLANNER_NODE_RANGE.min || nodeCount > PLANNER_NODE_RANGE.max || !Number.isInteger(nodeCount)) errors.push('Node count is outside this planner’s modeled range of 2–16.')
    if (nodeCount <= reserveNodes) errors.push('No workload nodes remain after the maintenance reserve.')
    for (const [key, value] of Object.entries({ coresPerNode: hardware.coresPerNode, memoryPerNodeGB: hardware.memoryPerNodeGB, capacityDrivesPerNode: hardware.capacityDrivesPerNode, capacityDriveSizeTB: hardware.capacityDriveSizeTB })) {
      if (!Number.isFinite(value) || value <= 0) errors.push(`Enter a positive ${key} hardware value.`)
    }
    if (![demand.totalVCpus, demand.totalMemoryGB, requiredFootprintTB, cpu, memory, capacity.availableForVolumesTB].every(Number.isFinite)) errors.push('One or more planning inputs produced invalid capacity. Review the inputs.')
    const allVolumes = [...suggested, ...state.volumes]
    const oversizedVm = state.inventory?.some(vm => vm.include && computeInventory([vm], { ...state.inventorySettings, growthPct: 0 }).totalMemoryGB > hardware.memoryPerNodeGB - state.advanced.systemReservedMemoryGB)
    if (oversizedVm) errors.push('An inventory VM needs more RAM than one host can provide. Choose larger hosts or revise that VM sizing; adding hosts alone cannot resolve it.')
    if (allVolumes.some(v => nodeCount < minNodesForResiliency(v.resiliency))) errors.push('A workload or planned volume uses resiliency that requires more nodes.')
    if (allVolumes.some(v => v.plannedSizeTB > 64 || v.plannedSizeTB < 0 || !Number.isFinite(v.plannedSizeTB))) errors.push('A volume is outside the planner’s 0–64 TB size range. Review or split the volume.')
    if (state.advanced.defaultResiliency === 'nested-two-way' && nodeCount !== 2 || allVolumes.some(v => v.resiliency === 'nested-two-way') && nodeCount !== 2) errors.push('Nested resiliency is modeled only for two-node designs. Change the volume resiliency before expanding.')
    const deficits = {
      vCpus: Math.max(0, demand.totalVCpus - cpu),
      memoryGB: Math.max(0, demand.totalMemoryGB - memory),
      poolTB: Math.max(0, requiredFootprintTB - capacity.availableForVolumesTB),
    }
    return {
      nodeCount, cpu, memory, poolTB: capacity.availableForVolumesTB,
      workloadFootprintTB, plannedFootprintTB, requiredFootprintTB, deficits, errors,
      fits: Object.values(deficits).every(n => n <= 1e-9) && errors.length === 0,
    }
  }
  const current = evaluate(state.hardware.nodeCount)
  const candidates = Array.from({ length: PLANNER_NODE_RANGE.max - PLANNER_NODE_RANGE.min + 1 }, (_, i) => evaluate(i + PLANNER_NODE_RANGE.min))
  const requiredNodes = hasDemand ? candidates.find(candidate => candidate.fits)?.nodeCount ?? null : null
  const limiting = Object.entries(current.deficits).filter(([, deficit]) => deficit > 1e-9).map(([resource]) => resource)
  const warnings = [
    'Capacity fit is an aggregate planning estimate. VM placement, hardware certification, network design, and storage performance still require validation.',
    'Workload storage and your edited volume layout are checked separately; the larger pool footprint controls the fit estimate.',
  ]
  if (state.inventorySettings?.sizingBasis === 'measured-p95') warnings.push('Measured demand assumes the proposed CPU and memory right-sizing will be applied. Confirm individual VM sizes before deployment.')
  if (state.inventorySettings?.storageBasis === 'consumed') warnings.push('Consumed-storage sizing relies on thin provisioning or disk reclamation. Provisioned growth is not reserved unless you add headroom.')
  if (state.inventory?.some(vm => vm.include && vm.memoryGiB > state.hardware.memoryPerNodeGB - state.advanced.systemReservedMemoryGB)) warnings.push('At least one inventory VM’s allocated memory exceeds the usable memory of a single host. Adding hosts cannot resolve that VM size without right-sizing or denser hosts.')
  if (state.servicePresets.some(p => p.enabled) && state.aks.enabled) warnings.push('AKS-hosted service compute is counted inside worker capacity. Confirm the worker pools can accommodate those services.')
  return { demand, hasDemand, reserveNodes, current, candidates, requiredNodes,
    additionalNodes: requiredNodes === null ? null : Math.max(0, requiredNodes - state.hardware.nodeCount),
    limiting, warnings, fits: hasDemand ? current.fits : null }
}
