/**
 * SofsPlanner — SOFS guest cluster sizing for FSLogix profile share scale-out.
 * Ports the 25 formulas from the "SOFS Planner" Excel sheet.
 *
 * Architecture:
 *   Azure Local host cluster (CSVs) → SOFS guest VM cluster (Storage Spaces + SOFS role) → FSLogix clients
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSurveyorStore } from '../state/store'
import { computeAvd } from '../engine/avd'
import { computeSofs } from '../engine/sofs'
import type { SofsContainerType, SofsInternalMirror } from '../engine/types'

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

/** Parse numeric input — returns current value if input is empty or NaN. */
function num(e: React.ChangeEvent<HTMLInputElement>, current: number): number {
  const v = e.target.value
  if (v === '' || v === '-') return current
  const n = +v
  return isNaN(n) ? current : n
}

export default function SofsPlanner() {
  const { sofs, setSofs, advanced, avd, avdEnabled } = useSurveyorStore()
  const result = computeSofs(sofs, advanced.overrides)
  const avdResult = computeAvd(avd, advanced.overrides)
  const [checklistOpen, setChecklistOpen] = useState(false)
  const recommendedHostCsvCount = Math.max(1, sofs.sofsGuestVmCount)

  const avdUsingSofs = avdEnabled && avdResult.sofsLinkedUserCount > 0
  const profileSizeInSync = avdResult.sofsLinkedProfileSizeGB === sofs.profileSizeGB
  const avdInSync = avdUsingSofs &&
    sofs.userCount === avdResult.sofsLinkedUserCount &&
    sofs.concurrentUsers === avdResult.sofsLinkedConcurrentUsers &&
    profileSizeInSync

  return (
    <div className="space-y-8">

      {/* AVD source-of-truth indicator */}
      {avdUsingSofs && (
        <div className={`rounded-lg border px-4 py-3 text-xs ${avdInSync ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'}`}>
          <p className="font-semibold text-sm">
            {avdInSync ? 'Synced with AVD planner' : 'AVD planner is using SOFS for profile storage'}
          </p>
          <p className="mt-0.5">
            {avdInSync
              ? `User count (${sofs.userCount}), concurrent users (${sofs.concurrentUsers}), and profile size (${sofs.profileSizeGB} GB) match AVD inputs. Adjust guest VM count, mirror type, and redirected folders here as needed.`
              : `One or more AVD host pools target SOFS, but the user count or profile size here differs from the aggregated AVD inputs. Use "Apply to SOFS planner" on the AVD page to sync, or set values manually below.`
            }
          </p>
          <p className="mt-1">
            Open the <Link to="/avd" className="font-semibold underline">AVD planner</Link> to review the source host pools and linked FSLogix assumptions.
          </p>
        </div>
      )}

      {/* Architecture context */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
        <p className="font-semibold text-sm">How SOFS for FSLogix works on Azure Local</p>
        <p><strong>Layer 1 — Azure Local host cluster:</strong> provides Cluster Shared Volumes (CSVs) that host SOFS guest VM virtual disks.</p>
        <p><strong>Layer 2 — SOFS guest VM cluster:</strong> 2+ Windows Server VMs running Failover Clustering, Storage Spaces, and the Scale-Out File Server role. This cluster owns the SMB share.</p>
        <p><strong>Layer 3 — FSLogix clients:</strong> AVD session hosts mount the SOFS SMB share and store profile VHD(X) containers there.</p>
        <p className="text-blue-600 dark:text-blue-400 mt-1">
          Inputs below size the SOFS guest cluster. The host-side Azure Local volume requirement is shown in Sizing Results.
        </p>
      </div>

      {/* ── FSLogix Demand Inputs ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">FSLogix Profile Storage Demand</h3>
        <p className="text-xs text-gray-400 mb-3">These inputs determine how much logical storage the SOFS guest cluster must provide.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Total users">
            <input type="number" min={1} className="input" value={sofs.userCount}
              onChange={(e) => setSofs({ userCount: num(e, sofs.userCount) })} />
          </Field>

          <Field label="Concurrent users" hint="0 = use total; affects IOPS peak estimate only">
            <input type="number" min={0} className="input" value={sofs.concurrentUsers}
              onChange={(e) => setSofs({ concurrentUsers: num(e, sofs.concurrentUsers) })} />
          </Field>

          <Field label="FSLogix profile size (GB)">
            <input type="number" min={1} className="input" value={sofs.profileSizeGB}
              onChange={(e) => setSofs({ profileSizeGB: num(e, sofs.profileSizeGB) })} />
            {avdEnabled && (
              <p className={`text-xs mt-1 ${avdUsingSofs ? (profileSizeInSync ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400') : 'text-gray-500 dark:text-gray-400'}`}>
                {avdUsingSofs
                  ? profileSizeInSync
                    ? `AVD-linked profile size is ${avdResult.sofsLinkedProfileSizeGB} GB.`
                    : `AVD-linked profile size currently differs (${avdResult.sofsLinkedProfileSizeGB} GB). Editing this field updates every SOFS-targeted AVD host pool automatically.`
                  : 'AVD is not currently targeting SOFS, so profile size changes here stay local to the SOFS planner.'}
              </p>
            )}
          </Field>

          <Field label="Redirected folders size (GB)">
            <input type="number" min={0} className="input" value={sofs.redirectedFolderSizeGB}
              onChange={(e) => setSofs({ redirectedFolderSizeGB: num(e, sofs.redirectedFolderSizeGB) })} />
          </Field>

          <Field label="FSLogix container type" className="col-span-2">
            <select className="input w-full" value={sofs.containerType}
              onChange={(e) => setSofs({ containerType: e.target.value as SofsContainerType })}>
              <option value="single">Single Container (Profile VHD)</option>
              <option value="split">Split Container (Profile + Office)</option>
              <option value="three">Three Containers (Profile + Office + Apps)</option>
            </select>
          </Field>
        </div>

        {/* Container type advisory */}
        <div className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
          <span className="font-semibold">{(CONTAINER_TYPE_INFO[sofs.containerType] ?? CONTAINER_TYPE_INFO.split).label}:</span>{' '}
          {(CONTAINER_TYPE_INFO[sofs.containerType] ?? CONTAINER_TYPE_INFO.split).desc}
        </div>
      </div>

      {/* ── SOFS Guest Cluster Inputs ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">SOFS Guest Cluster Configuration</h3>
        <p className="text-xs text-gray-400 mb-3">
          These inputs size the Windows Server VM cluster that runs the SOFS role on Azure Local.
          Guest VMs should be placed on separate host nodes using anti-affinity rules.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Guest cluster data protection" hint="mirrors data across SOFS guest VMs">
            <select className="input w-full" value={sofs.internalMirror}
              onChange={(e) => setSofs({ internalMirror: e.target.value as SofsInternalMirror })}>
              <option value="three-way">Three-Way Mirror (3× footprint) — recommended</option>
              <option value="two-way">Two-Way Mirror (2× footprint)</option>
              <option value="simple">Simple / No Mirror (1×) — not recommended for production</option>
            </select>
          </Field>

          <Field label="SOFS guest VM count" hint="min 2 for HA">
            <input type="number" min={2} className="input" value={sofs.sofsGuestVmCount}
              onChange={(e) => setSofs({ sofsGuestVmCount: num(e, sofs.sofsGuestVmCount) })} />
          </Field>

          <Field label="vCPUs / SOFS VM">
            <input type="number" min={2} className="input" value={sofs.sofsVCpusPerVm}
              onChange={(e) => setSofs({ sofsVCpusPerVm: num(e, sofs.sofsVCpusPerVm) })} />
          </Field>

          <Field label="RAM / SOFS VM (GB)">
            <input type="number" min={4} className="input" value={sofs.sofsMemoryPerVmGB}
              onChange={(e) => setSofs({ sofsMemoryPerVmGB: num(e, sofs.sofsMemoryPerVmGB) })} />
          </Field>

          <Field label="OS disk per SOFS VM (GB)" hint="default 127">
            <input type="number" min={64} className="input" value={sofs.sofsOsDiskPerVmGB}
              onChange={(e) => setSofs({ sofsOsDiskPerVmGB: num(e, sofs.sofsOsDiskPerVmGB) })} />
          </Field>

          <Field label="Volume layout" hint="affects Volumes page suggestions">
            <select className="input w-full" value={sofs.volumeLayout}
              onChange={(e) => setSofs({ volumeLayout: e.target.value as 'shared' | 'per-vm' })}>
              <option value="shared">Single shared volume</option>
              <option value="per-vm">One volume per SOFS VM</option>
            </select>
          </Field>
        </div>
      </div>

      {/* ── Sizing Results ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">SOFS Sizing Results</div>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Profile storage (logical)" sub="All users × profile size"
              value={`${result.totalProfileStorageTB} TB`} />
            <Row label="Redirected folder storage (logical)" sub="All users × redirected folder size"
              value={`${result.totalRedirectedStorageTB} TB`} />
            <Row label="Total logical storage" value={`${result.totalStorageTB} TB`} highlight />
            <Row
              label={`Guest cluster footprint (${sofs.internalMirror === 'simple' ? '1×' : sofs.internalMirror === 'two-way' ? '2× mirror' : '3× mirror'})`}
              sub="Virtual disk space inside the SOFS guest Storage Spaces pool"
              value={`${result.internalFootprintTB} TB`}
            />
            <Row
              label="Azure Local host-side volume requirement"
              sub="Minimum usable space needed on the Azure Local CSV backing SOFS — before host resiliency overhead"
              value={`${result.internalFootprintTB} TB`}
              highlight
            />
            <Row
              label="Recommended Azure Local CSV volume count"
              sub={`Production guidance: ${recommendedHostCsvCount} host CSV volume${recommendedHostCsvCount > 1 ? 's' : ''} — one per SOFS VM for fault isolation`}
              value={String(recommendedHostCsvCount)}
            />
            <Row label="Total SOFS vCPUs" sub={`${sofs.sofsGuestVmCount} VMs × ${sofs.sofsVCpusPerVm} vCPUs`}
              value={String(result.sofsVCpusTotal)} />
            <Row label="Total SOFS RAM" sub={`${sofs.sofsGuestVmCount} VMs × ${sofs.sofsMemoryPerVmGB} GB`}
              value={`${result.sofsMemoryTotalGB} GB`} />
          </tbody>
        </table>
      </div>

      {/* ── Resiliency Compounding ── */}
      {result.internalMirrorFactor > 1 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm space-y-1">
          <p className="font-semibold text-amber-900 dark:text-amber-200">Resiliency compounding — plan your Azure Local volumes accordingly</p>
          <p className="text-amber-800 dark:text-amber-300 text-xs">
            The SOFS guest cluster mirrors data {result.internalMirrorFactor}× internally, producing{' '}
            <strong>{result.internalFootprintTB} TB</strong> of virtual disks on the Azure Local CSV.
            Those virtual disks sit on an Azure Local volume that has its own resiliency — for example, at three-way mirror
            on the host cluster, raw pool consumption for SOFS would be up to{' '}
            <strong>{(result.internalFootprintTB * 3).toFixed(2)} TB</strong>.
            Use the Azure Local host-side volume requirement above as the input to your host-cluster volume planning.
          </p>
        </div>
      )}

      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm space-y-1.5">
        <p className="font-semibold text-blue-900 dark:text-blue-200">Recommended Azure Local host volume layout</p>
        <p className="text-blue-800 dark:text-blue-300 text-xs">
          For production, create <strong>{recommendedHostCsvCount} Azure Local CSV volume{recommendedHostCsvCount > 1 ? 's' : ''}</strong> and place
          <strong> one SOFS VM per host CSV</strong>. This isolates failures and maintenance events to a single SOFS VM instead of giving the whole guest cluster shared fate on one host volume.
        </p>
        <p className="text-blue-800 dark:text-blue-300 text-xs">
          A single shared host CSV is simpler, but it is better suited to dev/test or very small deployments. This recommendation is aligned with the Azure Local SOFS for FSLogix guide.
        </p>
        <a
          href="https://azurelocal.cloud/azurelocal-sofs-fslogix/getting-started/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          Open SOFS deployment guide
        </a>
      </div>

      {/* ── IOPS Estimate ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">
          IOPS Estimate
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
          Based on FSLogix guidance — steady-state ~10 IOPS/user, login storm ~50 IOPS/user.
          Validate with actual workload profiling. Size SOFS guest cluster drives for login storm headroom.
        </p>
      </div>

      {/* ── Guest Cluster Drive Sizing ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">SOFS Guest Cluster Auto-Sizing</div>
        <div className="px-4 py-4 space-y-3">
          <p className="text-sm text-gray-500">
            Enter the SOFS guest cluster node and drive count to calculate the required capacity drive size.
            This sizes the <strong>virtual drives inside the SOFS guest Storage Spaces pool</strong> — not physical
            drives on the Azure Local host. Those virtual drives are VHD/VHDX files stored on an Azure Local CSV.
          </p>
          <p className="text-xs text-gray-400">
            Auto-sizing computes <strong>required virtual drive size = guest cluster footprint ÷ (nodes × drives per node)</strong>.
            Keep the default at <strong>4 drives per node</strong> as the baseline and prefer adding more drives before only making them larger.
            More drives usually improve balance, reserve behavior, and rebuild characteristics.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="SOFS guest cluster nodes">
              <input type="number" min={2} className="input" value={sofs.autoSizeNodes}
                onChange={(e) => setSofs({ autoSizeNodes: num(e, sofs.autoSizeNodes) })} />
            </Field>
            <Field label="Virtual drives per node" hint="default 4; add drives before only enlarging them">
              <input type="number" min={1} className="input" value={sofs.autoSizeDrivesPerNode}
                onChange={(e) => setSofs({ autoSizeDrivesPerNode: num(e, sofs.autoSizeDrivesPerNode) })} />
            </Field>
          </div>
          {result.autoSizeDriveSizeTB > 0 ? (
            <div className="rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 px-4 py-3">
              <div className="text-xs text-gray-500">Required virtual drive size (includes {result.internalMirrorFactor}× guest mirror overhead)</div>
              <div className="text-2xl font-bold text-brand-700 dark:text-brand-300 mt-1">
                {result.autoSizeDriveSizeTB} TB
                <span className="text-sm font-normal text-gray-500 ml-2">per virtual drive</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {sofs.autoSizeDrivesPerNode} drives × {sofs.autoSizeNodes} nodes = {sofs.autoSizeDrivesPerNode * sofs.autoSizeNodes} total virtual drives
                to store {result.internalFootprintTB} TB of guest-mirrored data on the Azure Local CSV
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Set guest-cluster node and drive counts to calculate the required virtual drive size.</p>
          )}
        </div>
      </div>

      {/* ── Readiness Checklist ── */}
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

function Row({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <tr className={`border-t border-gray-100 dark:border-gray-800 ${highlight ? 'bg-brand-50 dark:bg-brand-900/20 font-semibold' : ''}`}>
      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
        <span className="text-sm">{label}</span>
        {sub && <div className="text-xs text-gray-400 font-normal">{sub}</div>}
      </td>
      <td className="px-4 py-2 text-right text-sm">{value}</td>
    </tr>
  )
}
