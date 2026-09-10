import { useState } from 'react'
import { useSurveyorStore } from '../state/usePlanStore'
import { estimateAdditionalVms } from '../engine/recommendations'

export default function AdditionalWorkload() {
  const state = useSurveyorStore()
  const [profile, setProfile] = useState({ vCpu: 4, memoryGiB: 16, diskGiB: 128 })
  const count = estimateAdditionalVms(state, profile)
  return <section className="panel space-y-4"><h2 className="text-lg font-semibold">What else could this hardware run?</h2><p className="text-sm text-gray-500">Try a VM profile against the headroom remaining after the current workloads, volume layout and maintenance reserve. This preview does not add VMs to the plan.</p>
    <div className="grid sm:grid-cols-3 gap-3">{[['vCpu', 'vCPU per VM'], ['memoryGiB', 'RAM per VM (GiB)'], ['diskGiB', 'Disk per VM (GiB)']].map(([key, label]) => <label className="text-sm" key={key}>{label}<input className="input mt-1" type="number" min={1} value={profile[key as keyof typeof profile]} onChange={e => setProfile({ ...profile, [key]: +e.target.value })} /></label>)}</div>
    <p aria-live="polite" className="font-semibold">{count === null ? 'Enter positive VM resource values.' : `Aggregate headroom for up to ${count} additional example VMs.`}</p>
    <p className="text-xs text-gray-500">Uses the selected default resiliency for added disks. Placement, IOPS, network demand and application performance still require validation.</p>
  </section>
}
