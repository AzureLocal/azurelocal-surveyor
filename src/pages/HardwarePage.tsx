import HardwareForm from '../components/HardwareForm'
import CapacityReport from '../components/CapacityReport'
import { useSurveyorStore } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { validateHardwareInputs } from '../engine/hardware'
import HealthCheck from '../components/HealthCheck'

export default function HardwarePage() {
  const { hardware, advanced } = useSurveyorStore()
  const capacity = computeCapacity(hardware, advanced)
  const validation = validateHardwareInputs(hardware)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Hardware Inputs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Define your Azure Local cluster hardware. All other calculations derive from this sheet.
        </p>
      </div>

      <HardwareForm />

      {!validation.passed && (
        <HealthCheck result={validation} />
      )}

      <CapacityReport result={capacity} />
    </div>
  )
}
