/**
 * SofsPlanner — SOFS guest cluster sizing for FSLogix profile share scale-out.
 * Ports the 25 formulas from the "SOFS Planner" Excel sheet.
 * Distinct page/component — not nested under workloads or AVD.
 *
 * Features:
 *  #41 — IOPS estimate (steady-state and login storm peak)
 *  #43 — cluster hardware auto-sizing
 *  #45 — FSLogix profile container type selector
 *  #47 — SOFS deployment readiness checklist
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useSurveyorStore } from '../state/store'
import { computeSofs } from '../engine/sofs'
import type { SofsContainerType } from '../engine/types'

const CONTAINER_TYPE_INFO: Record<SofsContainerType, { label: string; desc: string }> = {
  single: {
    label: 'Single Container (Profile VHD)',
    desc: 'One VHD(X) per user containing both profile and Office data. Simplest setup — best for smaller deployments (<100 users). Higher contention risk when both profile and Office data are accessed simultaneously.',
  },
  split: {
    label: 'Split Container (Profile + Office)',
    desc: 'Separate Profile Container and Office Container VHDs per user. Recommended for most organizations — reduces VHD file size and allows independent management of Office data. Requires FSLogix 2.9.7+.',
  },
  three: {
    label: 'Three Containers (Profile + Office + Apps)',
    desc: 'Profile, Office, and application-specific containers. Advanced configuration for organizations with complex application virtualization requirements. Highest operational complexity.',
  },
}

const READINESS_CHECKLIST = [
  'Azure Local cluster has minimum 3 nodes (recommended for SOFS with redundancy)',
  'Separate cluster for SOFS (preferred) OR same cluster with resource reservation',
  'SMB 3.x enabled on all SOFS guest VMs (enabled by default on Server 2019+)',
  'Scale-Out File Server role installed on all SOFS guest VMs',
  'Failover Cluster configured across all SOFS guest VMs (minimum 2)',
  'Cluster Shared Volume (CSV) provisioned and accessible to all SOFS nodes',
  'SMB share created with continuous availability (CA) flag enabled',
  'FSLogix Group Policy configured to point to SOFS UNC path (\\\\SOFS\\Profiles)',
  'Access-Based Enumeration (ABE) disabled on SOFS share (required for FSLogix)',
  'NTFS permissions: users have read/write on their own subfolder only',
  'Health Service monitoring configured for SOFS cluster',
  'Backup solution for profile VHD(X) files validated (VSS-aware or file-level)',
]

export default function SofsPlanner() {
  const { sofs, setSofs } = useSurveyorStore()
  const result = computeSofs(sofs)
  const [checklistOpen, setChecklistOpen] = useState(false)

  return (
    <div className="space-y-8">
      {/* ── Inputs ── */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Total users">
          <input type="number" min={1} className="input" value={sofs.userCount}
            onChange={(e) => setSofs({ userCount: +e.target.value })} />
        </Field>

        <Field label="Concurrent users (login storm)" hint="#41 — 0 = use total">
          <input type="number" min={0} className="input" value={sofs.concurrentUsers}
            onChange={(e) => setSofs({ concurrentUsers: +e.target.value })} />
        </Field>

        <Field label="FSLogix profile size (GB)">
          <input type="number" min={1} className="input" value={sofs.profileSizeGB}
            onChange={(e) => setSofs({ profileSizeGB: +e.target.value })} />
        </Field>

        <Field label="Redirected folders size (GB)">
          <input type="number" min={0} className="input" value={sofs.redirectedFolderSizeGB}
            onChange={(e) => setSofs({ redirectedFolderSizeGB: +e.target.value })} />
        </Field>

        <Field label="Profile container type (#45)" className="col-span-2">
          <select className="input w-full" value={sofs.containerType}
            onChange={(e) => setSofs({ containerType: e.target.value as SofsContainerType })}>
            <option value="single">Single Container (Profile VHD)</option>
            <option value="split">Split Container (Profile + Office)</option>
            <option value="three">Three Containers (Profile + Office + Apps)</option>
          </select>
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

      {/* Container type advisory */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
        <span className="font-semibold">{CONTAINER_TYPE_INFO[sofs.containerType].label}:</span>{' '}
        {CONTAINER_TYPE_INFO[sofs.containerType].desc}
      </div>

      {/* ── Sizing Results ── */}
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

      {/* ── IOPS Estimate (#41) ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">
          IOPS Estimate (#41)
          {sofs.concurrentUsers > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-500">based on {sofs.concurrentUsers} concurrent users</span>
          )}
        </div>
        <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-800">
          <div className="px-4 py-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Steady-state IOPS</div>
            <div className="text-2xl font-bold">{result.totalSteadyStateIops.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">{result.steadyStateIopsPerUser} IOPS/user</div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Login storm peak IOPS</div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{result.totalLoginStormIops.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">{result.loginStormIopsPerUser} IOPS/user</div>
          </div>
        </div>
        <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800">
          Estimates based on FSLogix sizing guidance — steady-state ~10 IOPS/user, login storm ~50 IOPS/user.
          Validate with actual workload profiling in production. Profile Azure Premium SSD or NVMe capacity drives for login storm headroom.
        </p>
      </div>

      {/* ── Auto-Sizing (#43) ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">SOFS Cluster Hardware Auto-Sizing (#43)</div>
        <div className="px-4 py-4 space-y-3">
          <p className="text-sm text-gray-500">
            Set the target SOFS cluster layout and the required drive size will be auto-calculated based on your storage demand.
            This is for the <strong>SOFS guest cluster</strong> hardware, separate from your main Azure Local cluster.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="SOFS cluster nodes">
              <input type="number" min={2} className="input" value={sofs.autoSizeNodes}
                onChange={(e) => setSofs({ autoSizeNodes: +e.target.value })} />
            </Field>
            <Field label="Capacity drives per node (0 = disable)">
              <input type="number" min={0} className="input" value={sofs.autoSizeDrivesPerNode}
                onChange={(e) => setSofs({ autoSizeDrivesPerNode: +e.target.value })} />
            </Field>
          </div>
          {result.autoSizeDriveSizeTB > 0 ? (
            <div className="rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 px-4 py-3">
              <div className="text-xs text-gray-500">Required drive size (three-way-mirror, includes 3× footprint)</div>
              <div className="text-2xl font-bold text-brand-700 dark:text-brand-300 mt-1">
                {result.autoSizeDriveSizeTB} TB
                <span className="text-sm font-normal text-gray-500 ml-2">per drive</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {sofs.autoSizeDrivesPerNode} drives × {sofs.autoSizeNodes} nodes = {sofs.autoSizeDrivesPerNode * sofs.autoSizeNodes} total drives
                to store {result.totalStorageTB} TB at 3× mirror footprint
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Set drives per node above 0 to enable auto-sizing.</p>
          )}
        </div>
      </div>

      {/* ── Readiness Checklist (#47) ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          className="flex items-center gap-2 w-full px-4 py-3 text-sm font-semibold text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          onClick={() => setChecklistOpen((o) => !o)}
        >
          {checklistOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          SOFS Deployment Readiness Checklist
          <span className="ml-2 text-xs font-normal text-gray-400">{READINESS_CHECKLIST.length} items</span>
        </button>
        {checklistOpen && (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
            {READINESS_CHECKLIST.map((item, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <span className="shrink-0 mt-0.5 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs text-gray-400">{i + 1}</span>
                <span className="text-gray-700 dark:text-gray-300">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
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
