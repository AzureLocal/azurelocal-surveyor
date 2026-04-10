import VolumeTable from '../components/VolumeTable'
import HealthCheck from '../components/HealthCheck'
import LayoutCompare from '../components/LayoutCompare'
import { useSurveyorStore } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { computeCompute } from '../engine/compute'
import { computeWorkloadSummary } from '../engine/workloads'
import { runHealthCheck } from '../engine/healthcheck'

export default function VolumesPage() {
  const { hardware, advanced, volumes, workloads } = useSurveyorStore()
  const capacity = computeCapacity(hardware, advanced)
  const compute = computeCompute(hardware, advanced)
  const workloadSummary = computeWorkloadSummary(workloads)
  const health = runHealthCheck({ hardware, settings: advanced, volumes, capacity, compute, workloadSummary })

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Volume Detail</h1>
        <p className="text-sm text-gray-500 mt-1">
          Plan your Cluster Shared Volumes with per-volume resiliency and WAC-ready sizes.
          Ports the 95 formulas from the Volume Detail sheet.
        </p>
      </div>

      <VolumeTable />

      <HealthCheck result={health} />

      <section>
        <h2 className="text-xl font-semibold mb-4">Drive Layout Comparison</h2>
        <LayoutCompare />
      </section>
    </div>
  )
}
