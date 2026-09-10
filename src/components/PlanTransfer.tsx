import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSurveyorStore } from '../state/usePlanStore'
import { storagePlanStore, useSurveyorStore as workloadPlanStore } from '../state/store'
import { usePlanningArea } from '../state/planning-area'

export default function PlanTransfer() {
  const state = useSurveyorStore()
  const area = usePlanningArea()
  const [review, setReview] = useState(false)
  const navigate = useNavigate()
  return <section className="panel space-y-3 no-print"><h2 className="font-semibold">{area === 'storage' ? 'Use this hardware for workload planning' : 'Open a copy in Storage Sizing'}</h2>
    <p className="text-sm text-gray-500">{area === 'storage' ? 'Copy these hardware inputs into your workload project. Workloads and volume design in that project are preserved.' : 'Copy hardware, storage assumptions and volumes into the standalone storage project. Your workload project remains available here.'}</p>
    {!review ? <button className="action-secondary" onClick={() => setReview(true)}>Review copy</button> : <div className="space-y-3"><p className="text-sm">This replaces {area === 'storage' ? 'hardware in the workload project' : 'hardware, assumptions and volumes in the storage project'}. Save that destination project first if you want to keep its current design.</p><p className="text-sm">{state.hardware.nodeCount} nodes · {state.hardware.capacityDrivesPerNode} × {state.hardware.capacityDriveSizeTB} TB per node{area === 'workload' ? ' · ' + state.volumes.length + ' volumes' : ''}</p>
      <button className="action" onClick={() => {
        if (area === 'storage') {
          workloadPlanStore.getState().setHardware(structuredClone(state.hardware))
          workloadPlanStore.getState().setPlanningPurpose('existing')
          navigate('/planning/hardware')
        } else {
          storagePlanStore.getState().setHardware(structuredClone(state.hardware))
          storagePlanStore.getState().setAdvanced(structuredClone(state.advanced))
          storagePlanStore.setState({ volumes: structuredClone(state.volumes), volumeMode: 'generic' })
          navigate('/storage/volumes')
        }
      }}>Copy and open {area === 'storage' ? 'Workload Planning' : 'Storage Sizing'}</button>
      <button className="action-secondary ml-2" onClick={() => setReview(false)}>Cancel</button></div>}
  </section>
}
