import { Link } from 'react-router-dom'
import WorkloadPlanner from '../components/WorkloadPlanner'

export default function SpecializedPage() {
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Specialized Workloads</h1><p className="text-sm text-gray-500 mt-2">Enable a workload below to include it in the plan. Detailed planners remain available here.</p></div>
    <nav aria-label="Specialized workload planners" className="flex flex-wrap gap-3">
      {[['avd', 'Virtual desktops (AVD)'], ['aks', 'Kubernetes (AKS)'], ['sofs', 'File services (SOFS)'], ['mabs', 'Backup server (MABS)']].map(([path, label]) => <Link className="action-secondary" key={path} to={'/planning/' + path}>{label}</Link>)}
    </nav><WorkloadPlanner />
  </div>
}
