import { Link } from 'react-router-dom'
import { useSurveyorStore } from '../state/usePlanStore'
import { computeCapacity } from '../engine/capacity'
import { computeVolumeSummary } from '../engine/volumes'
import PlanTransfer from '../components/PlanTransfer'

export default function StorageHomePage() {
  const state = useSurveyorStore()
  const capacity = computeCapacity(state.hardware, state.advanced)
  const volumes = computeVolumeSummary(state.volumes, capacity)
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Storage Sizing</h1><p className="mt-2 text-gray-500">Size your S2D storage and volumes independently of workload planning.</p></div>
    <div className="grid md:grid-cols-3 gap-4">{[['Nodes', state.hardware.nodeCount], ['Raw storage · TB', capacity.rawPoolTB.toFixed(2)], ['Pool available for volumes · TB', capacity.availableForVolumesTB.toFixed(2)]].map(([label, value]) => <div className="panel" key={label}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-2">{value}</p></div>)}</div>
    <div className="grid sm:grid-cols-2 gap-4">{[['hardware', '1. Hardware & Drives', 'Choose nodes, an OEM example, and drive configuration.'], ['capacity', '2. Capacity & Resiliency', 'Review reserves, overhead and usable storage.'], ['volumes', '3. Volume Planning', 'Design volumes with per-volume resiliency and provisioning.'], ['reports', '4. Storage Report', 'Review the storage plan and download your deliverables.']].map(([path, title, description]) => <Link className="panel hover:border-brand-500" key={path} to={'/storage/' + path}><h2 className="font-semibold">{title} →</h2><p className="text-sm text-gray-500 mt-2">{description}</p></Link>)}</div>
    <p className="text-sm">{state.volumes.length} planned volumes · {volumes.totalPoolFootprintTB.toFixed(2)} TB pool footprint · {volumes.utilizationPct.toFixed(1)}% pool utilization.</p>
    <PlanTransfer />
  </div>
}
