import { Link } from 'react-router-dom'

export default function HelpPage() {
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Help &amp; Reference</h1><p className="text-gray-500">Choose a planning guide or look up the assumptions behind your results.</p>
    <div className="grid md:grid-cols-2 gap-4">
      <section className="panel space-y-3"><h2 className="font-semibold">Storage sizing guide</h2><p className="text-sm">Hardware & drives → Capacity & resiliency → Volumes → Storage report. Workloads are optional and stay in their own planning area.</p><Link className="text-brand-600 underline" to="/storage">Open Storage Sizing</Link></section>
      <section className="panel space-y-3"><h2 className="font-semibold">Workload planning guide</h2><p className="text-sm">Start with workloads to find hardware options, or enter existing hardware and assess what fits. Review storage design before exporting.</p><Link className="text-brand-600 underline" to="/planning">Open Workload Planning</Link></section>
      <section className="panel space-y-3"><h2 className="font-semibold">Documentation</h2><p className="text-sm">Calculation methods, OEM sources, planning workflows and project formats.</p><a className="text-brand-600 underline" href={import.meta.env.BASE_URL + 'docs/'} target="_blank" rel="noopener noreferrer">Open documentation</a></section>
      <section className="panel space-y-3"><h2 className="font-semibold">Reference library</h2><div className="flex flex-col gap-2"><Link className="text-brand-600 underline" to="/references">Microsoft and vendor references</Link><Link className="text-brand-600 underline" to="/thin-provisioning">Thin provisioning guide</Link><a className="text-brand-600 underline" href={import.meta.env.BASE_URL + 'docs/reference/oem-presets.html'} target="_blank" rel="noopener noreferrer">OEM planning presets</a><Link className="text-brand-600 underline" to="/about">About and release information</Link></div></section>
    </div>
  </div>
}
