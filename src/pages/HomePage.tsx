import { Link } from 'react-router-dom'

export default function HomePage() {
  return <div className="space-y-8 max-w-5xl mx-auto">
    <div className="py-5"><p className="text-sm font-semibold text-brand-600 mb-2">AZURE LOCAL SURVEYOR</p><h1 className="text-3xl sm:text-4xl font-bold">What are you planning?</h1><p className="text-gray-500 mt-3 max-w-2xl">Choose a focused storage calculator or build a hardware plan around your workloads. Each area keeps its own project so you can work on both.</p></div>
    <div className="grid md:grid-cols-2 gap-6">
      <section className="panel space-y-4 border-t-4 border-t-sky-500"><span className="text-sm text-sky-700 font-semibold">STORAGE SIZING</span><h2 className="text-2xl font-bold">Plan storage and volumes</h2><p>Calculate capacity from your nodes and drives. Compare resiliency and drive layouts, then design and export your volumes.</p><p className="text-sm text-gray-500">Use the storage calculator on its own. No workload inventory needed.</p><Link className="action" to="/storage">Open Storage Sizing →</Link></section>
      <section className="panel space-y-4 border-t-4 border-t-indigo-500"><span className="text-sm text-indigo-700 font-semibold">WORKLOAD PLANNING</span><h2 className="text-2xl font-bold">Plan around what you need to run</h2><p>Import or enter workloads to find hardware options, or assess capacity and headroom on equipment you already have.</p><p className="text-sm text-gray-500">VM inventory, measurements, virtual desktops, Kubernetes, file services and backup.</p><Link className="action" to="/planning">Open Workload Planning →</Link></section>
    </div>
    <section className="panel"><h2 className="font-semibold">Continue a plan</h2><p className="text-sm text-gray-500 mt-2">Each area remembers its current draft in this browser. Use Save project for a portable copy, or open a downloaded project to restore it.</p><div className="flex flex-wrap gap-4 mt-4"><Link className="text-brand-600 underline" to="/storage/projects">Open a storage project</Link><Link className="text-brand-600 underline" to="/planning/projects">Open a workload project</Link><Link className="text-brand-600 underline" to="/help">Help & Reference</Link></div></section>
  </div>
}
