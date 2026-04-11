import VolumeTable from '../components/VolumeTable'
import HealthCheck from '../components/HealthCheck'
import LayoutCompare from '../components/LayoutCompare'
import { useSurveyorStore } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { computeCompute } from '../engine/compute'
import { computeAvd } from '../engine/avd'
import { computeSofs } from '../engine/sofs'
import { computeAks } from '../engine/aks'
import { runHealthCheck } from '../engine/healthcheck'

export default function VolumesPage() {
  const state = useSurveyorStore()
  const { hardware, advanced, volumes } = state
  const capacity = computeCapacity(hardware, advanced)
  const compute  = computeCompute(hardware, advanced)
  const avd      = computeAvd(state.avd)
  const sofs     = computeSofs(state.sofs)
  const aks      = computeAks(state.aks)

  // Aggregate workload demand from all enabled scenarios for accurate health checks
  let totalVCpus = 0, totalMemoryGB = 0, totalStorageTB = 0
  if (state.avdEnabled)            { totalVCpus += avd.totalVCpus;   totalMemoryGB += avd.totalMemoryGB;   totalStorageTB += avd.totalStorageTB }
  if (state.aks.enabled)           { totalVCpus += aks.totalVCpus;   totalMemoryGB += aks.totalMemoryGB;   totalStorageTB += aks.totalStorageTB }
  if (state.infraVms.enabled)      { totalVCpus += state.infraVms.vmCount * state.infraVms.vCpusPerVm;     totalMemoryGB += state.infraVms.vmCount * state.infraVms.memoryPerVmGB;     totalStorageTB += (state.infraVms.vmCount * state.infraVms.storagePerVmGB) / 1024 }
  if (state.devTestVms.enabled)    { totalVCpus += state.devTestVms.vmCount * state.devTestVms.vCpusPerVm; totalMemoryGB += state.devTestVms.vmCount * state.devTestVms.memoryPerVmGB; totalStorageTB += (state.devTestVms.vmCount * state.devTestVms.storagePerVmGB) / 1024 }
  if (state.backupArchive.enabled) { totalStorageTB += state.backupArchive.storageTB }
  if (state.customVms.enabled)     { totalVCpus += state.customVms.vmCount * state.customVms.vCpusPerVm;   totalMemoryGB += state.customVms.vmCount * state.customVms.memoryPerVmGB;   totalStorageTB += (state.customVms.vmCount * state.customVms.storagePerVmGB) / 1024 }
  if (state.sofsEnabled)           { totalVCpus += sofs.sofsVCpusTotal; totalMemoryGB += sofs.sofsMemoryTotalGB; totalStorageTB += sofs.totalStorageTB }

  const workloadSummary = {
    totalVCpus: Math.round(totalVCpus),
    totalMemoryGB: Math.round(totalMemoryGB),
    totalStorageTB: Math.round(totalStorageTB * 100) / 100,
  }

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
