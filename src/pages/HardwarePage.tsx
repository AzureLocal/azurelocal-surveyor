import HardwareForm from '../components/HardwareForm'
import CapacityReport from '../components/CapacityReport'
import { useSurveyorStore } from '../state/usePlanStore'
import { computeCapacity } from '../engine/capacity'
import { validateHardwareInputs } from '../engine/hardware'
import HealthCheck from '../components/HealthCheck'
import PlanTransfer from '../components/PlanTransfer'
import { usePlanningArea } from '../state/planning-area'
import { Link } from '../components/PlanLink'

export default function HardwarePage() {
  const state = useSurveyorStore()
  const storage = usePlanningArea() === 'storage'
  const validation = validateHardwareInputs(state.hardware)
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">{storage ? 'Hardware & Drives' : 'Hardware Inputs'}</h1><p className="text-sm text-gray-500 mt-2">{storage ? 'Define the nodes and drives for your standalone storage plan. No workload inventory is required.' : 'Describe existing equipment or choose a proposed configuration for your workloads.'}</p></div>
    <HardwareForm />
    {!validation.passed && <HealthCheck result={validation} title="Hardware Health Check" />}
    <div className="flex flex-wrap gap-3"><Link className="action" to={storage ? '/capacity' : '/workloads'}>{storage ? 'Review capacity & resiliency' : 'Review workloads'} →</Link>{!storage && <Link className="action-secondary" to="/fit">Assess workload fit</Link>}</div>
    <details><summary className="font-semibold cursor-pointer">Storage capacity preview</summary><div className="mt-4"><CapacityReport result={computeCapacity(state.hardware, state.advanced)} /></div></details>
    <PlanTransfer />
  </div>
}
