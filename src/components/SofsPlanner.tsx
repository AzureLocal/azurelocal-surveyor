/**
 * SofsPlanner — SOFS guest cluster sizing for FSLogix scale-out.
 * Ports the 25 formulas from the "SOFS Planner" Excel sheet.
 * Distinct page/component — not nested under workloads or AVD.
 */
import { useSurveyorStore } from '../state/store'
import { computeSofs } from '../engine/sofs'

export default function SofsPlanner() {
  const { sofs, setSofs } = useSurveyorStore()
  const result = computeSofs(sofs)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Total users">
          <input type="number" min={1} className="input" value={sofs.userCount}
            onChange={(e) => setSofs({ userCount: +e.target.value })} />
        </Field>
        <Field label="FSLogix profile size (GB)">
          <input type="number" min={1} className="input" value={sofs.profileSizeGB}
            onChange={(e) => setSofs({ profileSizeGB: +e.target.value })} />
        </Field>
        <Field label="Redirected folders size (GB)">
          <input type="number" min={0} className="input" value={sofs.redirectedFolderSizeGB}
            onChange={(e) => setSofs({ redirectedFolderSizeGB: +e.target.value })} />
        </Field>
        <Field label="SOFS guest VM count" hint="min 2 for HA">
          <input type="number" min={2} className="input" value={sofs.sofsGuestVmCount}
            onChange={(e) => setSofs({ sofsGuestVmCount: +e.target.value })} />
        </Field>
        <Field label="vCPUs / SOFS VM">
          <input type="number" min={2} className="input" value={sofs.sofsVCpusPerVm}
            onChange={(e) => setSofs({ sofsVCpusPerVm: +e.target.value })} />
        </Field>
        <Field label="RAM / SOFS VM (GB)">
          <input type="number" min={4} className="input" value={sofs.sofsMemoryPerVmGB}
            onChange={(e) => setSofs({ sofsMemoryPerVmGB: +e.target.value })} />
        </Field>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">SOFS Sizing Results</div>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Profile storage" value={`${result.totalProfileStorageTB} TB`} />
            <Row label="Redirected folder storage" value={`${result.totalRedirectedStorageTB} TB`} />
            <Row label="Total storage" value={`${result.totalStorageTB} TB`} highlight />
            <Row label="Total SOFS vCPUs" value={String(result.sofsVCpusTotal)} />
            <Row label="Total SOFS RAM" value={`${result.sofsMemoryTotalGB} GB`} />
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}{hint && <span className="ml-1 text-xs text-gray-500">({hint})</span>}
      </label>
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
