/**
 * SofsReport — dedicated SOFS solution summary for the Reports tab.
 * Shown only when SOFS is enabled. Provides an end-to-end design view:
 * - Azure Local host-side storage requirement
 * - SOFS guest cluster sizing
 * - Resiliency compounding explanation
 * - Deployment assumptions
 */
import { useSurveyorStore } from '../state/store'
import { computeSofs } from '../engine/sofs'

function Row({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <tr className={`border-t border-gray-100 dark:border-gray-800 ${highlight ? 'bg-brand-50 dark:bg-brand-900/20 font-semibold' : ''}`}>
      <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm">
        {label}
        {sub && <div className="text-xs text-gray-400 font-normal">{sub}</div>}
      </td>
      <td className="px-4 py-2 text-right text-sm">{value}</td>
    </tr>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold">{title}</div>
      {children}
    </div>
  )
}

const MIRROR_LABEL: Record<string, string> = {
  'three-way': 'Three-Way Mirror (3× footprint)',
  'two-way':   'Two-Way Mirror (2× footprint)',
  'simple':    'Simple / No Mirror (1×)',
}

const VOLUME_LAYOUT_LABEL: Record<string, string> = {
  shared:  'Shared CSV (one volume for all SOFS VMs)',
  'per-vm': 'Per-VM CSV (one volume per SOFS guest VM)',
}

const CONTAINER_LABEL: Record<string, string> = {
  single: 'Single Container (Profile VHD)',
  split:  'Split Container (Profile + Office)',
  three:  'Three Containers (Profile + Office + Apps)',
}

export default function SofsReport() {
  const state = useSurveyorStore()
  const { sofs, advanced } = state
  const result = computeSofs(sofs, advanced.overrides)

  const mirrorLabel = MIRROR_LABEL[sofs.internalMirror] ?? sofs.internalMirror
  const containerLabel = CONTAINER_LABEL[sofs.containerType] ?? sofs.containerType
  const volumeLayoutLabel = VOLUME_LAYOUT_LABEL[sofs.volumeLayout] ?? sofs.volumeLayout

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">SOFS Solution Report</h2>
        <p className="text-sm text-gray-500 mt-1">
          End-to-end sizing summary for a Scale-Out File Server guest cluster on Azure Local,
          used to host FSLogix profile shares at scale.
        </p>
      </div>

      {/* Architecture summary */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
        <p className="font-semibold">Architecture layers</p>
        <p><strong>Layer 1 — Azure Local host cluster:</strong> provides CSV-backed storage volumes that host the SOFS guest VM virtual disks.</p>
        <p><strong>Layer 2 — SOFS guest VM cluster:</strong> Windows Server Failover Cluster running Scale-Out File Server and Storage Spaces, exposing a high-availability SMB share.</p>
        <p><strong>Layer 3 — FSLogix clients:</strong> AVD session hosts (or other clients) mount the SOFS SMB share for profile VHD(X) containers.</p>
      </div>

      {/* FSLogix storage demand */}
      <Section title="FSLogix Storage Demand (Logical)">
        <table className="w-full">
          <tbody>
            <Row label="Total users" value={sofs.userCount.toLocaleString()} />
            <Row label="FSLogix container type" value={containerLabel} />
            <Row label="Profile size per user" value={`${sofs.profileSizeGB} GB`} />
            <Row label="Redirected folders per user" value={`${sofs.redirectedFolderSizeGB} GB`} />
            <Row label="Profile storage demand" value={`${result.totalProfileStorageTB} TB`} />
            <Row label="Redirected folder demand" value={`${result.totalRedirectedStorageTB} TB`} />
            <Row label="Total logical storage" value={`${result.totalStorageTB} TB`} highlight
              sub="Combined profile + redirected folders for all users" />
          </tbody>
        </table>
      </Section>

      {/* Guest cluster design */}
      <Section title="SOFS Guest Cluster Design">
        <table className="w-full">
          <tbody>
            <Row label="Guest cluster data protection" value={mirrorLabel}
              sub="Data mirrored across SOFS guest VM virtual disks inside the guest Storage Spaces pool" />
            <Row label="Volume layout" value={volumeLayoutLabel}
              sub="Determines how Azure Local CSV volumes are presented to SOFS guest VMs" />
            <Row label="Internal storage footprint" value={`${result.internalFootprintTB} TB`}
              sub={`${result.totalStorageTB} TB logical × ${result.internalMirrorFactor}× mirror`} />
            <Row label="SOFS guest VMs" value={String(sofs.sofsGuestVmCount)}
              sub="Minimum 2 for high availability; anti-affinity across Azure Local host nodes recommended" />
            <Row label="OS disk per SOFS VM" value={`${sofs.sofsOsDiskPerVmGB} GB`}
              sub="Operating system disk for each SOFS guest VM" />
            <Row label="vCPUs per SOFS VM" value={String(sofs.sofsVCpusPerVm)} />
            <Row label="RAM per SOFS VM" value={`${sofs.sofsMemoryPerVmGB} GB`} />
            <Row label="Total SOFS vCPUs" value={String(result.sofsVCpusTotal)} highlight />
            <Row label="Total SOFS RAM" value={`${result.sofsMemoryTotalGB} GB`} highlight />
          </tbody>
        </table>
      </Section>

      {/* Azure Local host-side requirement */}
      <Section title="Azure Local Host-Side Storage Requirement">
        <div className="px-4 py-3 space-y-2">
          <p className="text-sm text-gray-500">
            The SOFS guest cluster's Storage Spaces virtual disks are backed by Azure Local CSV volumes.
            The host cluster must provide at least the following usable capacity — before applying the host cluster's own resiliency factor.
          </p>
          <div className="rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 px-4 py-3">
            <div className="text-xs text-gray-500 mb-1">Minimum Azure Local CSV usable capacity needed for SOFS</div>
            <div className="text-2xl font-bold text-brand-700 dark:text-brand-300">{result.internalFootprintTB} TB</div>
            <div className="text-xs text-gray-400 mt-1">
              This is the virtual disk footprint ({result.totalStorageTB} TB logical × {result.internalMirrorFactor}× guest mirror).
              Add the Azure Local host resiliency overhead on top of this number when sizing your total pool.
            </div>
          </div>
          {result.internalMirrorFactor > 1 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-1">Resiliency compounding</p>
              <p>
                {result.totalStorageTB} TB of user data is mirrored {result.internalMirrorFactor}× inside the guest cluster ({result.internalFootprintTB} TB of virtual disks).
                Those virtual disks sit on an Azure Local CSV which has its own resiliency — for example, a three-way mirror host volume
                would require a further 3× pool footprint, making the total raw pool consumption up to{' '}
                <strong>{(result.internalFootprintTB * 3).toFixed(2)} TB</strong> at three-way mirror on the host cluster.
                Plan your Azure Local volumes accordingly.
              </p>
            </div>
          )}
        </div>
      </Section>

      {/* IOPS */}
      <Section title="IOPS Estimate">
        <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-800">
          <div className="px-4 py-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Steady-state IOPS</div>
            <div className="text-2xl font-bold">{result.totalSteadyStateIops.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">{result.steadyStateIopsPerUser} IOPS/user</div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Login storm peak IOPS</div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{result.totalLoginStormIops.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">
              {result.loginStormIopsPerUser} IOPS/user
              {sofs.concurrentUsers > 0 && <span> · based on {sofs.concurrentUsers} concurrent</span>}
            </div>
          </div>
        </div>
        <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800">
          Based on FSLogix guidance: ~10 IOPS/user steady-state, ~50 IOPS/user login storm peak.
          Validate with actual workload profiling. Size SOFS guest cluster drives for login storm headroom.
        </p>
      </Section>

      {/* Deployment assumptions */}
      <Section title="Deployment Assumptions">
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {[
            'Guest OS: Windows Server 2022 (or 2019) with Failover Clustering and Scale-Out File Server roles',
            'Storage Spaces (S2D) running inside the SOFS guest VM cluster provides the mirrored pool',
            'SMB 3.x with Continuous Availability (CA) enabled on the SOFS share',
            'FSLogix Group Policy points to the SOFS UNC path (\\\\SOFS\\Profiles)',
            'Guest VMs placed on separate Azure Local host nodes via anti-affinity rules',
            'Azure Local host cluster provides a single shared CSV volume backing SOFS guest VM virtual disks',
            'Profile storage sized for all assigned users; concurrent users affect IOPS estimates only',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">
              <span className="shrink-0 mt-0.5 text-gray-300 dark:text-gray-600">—</span>
              {item}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
