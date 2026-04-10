/**
 * AvdPlanner — Azure Virtual Desktop session host & storage sizing.
 * Ports the 80 formulas from the "AVD Planning" Excel sheet.
 * This is its own component/page — NOT nested under WorkloadPlanner.
 */
import { useSurveyorStore } from '../state/store'
import { computeAvd } from '../engine/avd'
import type { AvdWorkloadType } from '../engine/types'

export default function AvdPlanner() {
  const { avd, setAvd } = useSurveyorStore()
  const result = computeAvd(avd)

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Total users">
          <input type="number" min={1} className="input" value={avd.totalUsers}
            onChange={(e) => setAvd({ totalUsers: +e.target.value })} />
        </Field>

        <Field label="Workload type">
          <select className="input" value={avd.workloadType}
            onChange={(e) => setAvd({ workloadType: e.target.value as AvdWorkloadType })}>
            <option value="light">Light (Task Workers)</option>
            <option value="medium">Medium (Office / Browser)</option>
            <option value="heavy">Heavy (Creative / Dev)</option>
            <option value="power">Power (3D / CAD)</option>
          </select>
        </Field>

        <Field label="Session type">
          <select className="input" value={avd.multiSession ? 'multi' : 'single'}
            onChange={(e) => setAvd({ multiSession: e.target.value === 'multi' })}>
            <option value="multi">Multi-session (Windows 11 Enterprise)</option>
            <option value="single">Single-session VDI</option>
          </select>
        </Field>

        <Field label="FSLogix profile size (GB)">
          <input type="number" min={1} className="input" value={avd.profileSizeGB}
            onChange={(e) => setAvd({ profileSizeGB: +e.target.value })} />
        </Field>

        <Field label="Office Container">
          <label className="flex items-center gap-2 mt-2 text-sm">
            <input type="checkbox" checked={avd.officeContainerEnabled}
              onChange={(e) => setAvd({ officeContainerEnabled: e.target.checked })} />
            Enable FSLogix Office Container
          </label>
        </Field>

        {avd.officeContainerEnabled && (
          <Field label="Office Container size (GB)">
            <input type="number" min={1} className="input" value={avd.officeContainerSizeGB}
              onChange={(e) => setAvd({ officeContainerSizeGB: +e.target.value })} />
          </Field>
        )}
      </div>

      {/* Results */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">AVD Sizing Results</div>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Users per session host" value={String(result.usersPerHost)} />
            <Row label="Session host count" value={String(result.sessionHostCount)} highlight />
            <Row label="vCPUs per host" value={String(result.vCpusPerHost)} />
            <Row label="RAM per host" value={`${result.memoryPerHostGB} GB`} />
            <Row label="Total vCPUs" value={String(result.totalVCpus)} highlight />
            <Row label="Total RAM" value={`${result.totalMemoryGB} GB`} highlight />
            <Row label="OS disk storage" value={`${result.totalOsStorageTB} TB`} />
            <Row label="Profile storage" value={`${result.totalProfileStorageTB} TB`} />
            {avd.officeContainerEnabled && (
              <Row label="Office Container storage" value={`${result.totalOfficeContainerStorageTB} TB`} />
            )}
            <Row label="Total storage" value={`${result.totalStorageTB} TB`} highlight />
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr className={`border-t border-gray-100 dark:border-gray-800 ${highlight ? 'bg-brand-50 dark:bg-brand-900/20 font-semibold' : ''}`}>
      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{label}</td>
      <td className="px-4 py-2 text-right">{value}</td>
    </tr>
  )
}
