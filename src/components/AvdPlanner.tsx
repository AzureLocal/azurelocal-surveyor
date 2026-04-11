/**
 * AvdPlanner — Azure Virtual Desktop session host & storage sizing.
 * Ports the 80 formulas from the "AVD Planning" Excel sheet.
 * This is its own component/page — NOT nested under WorkloadPlanner.
 *
 * Features:
 *  #26 — concurrent users as primary sizing driver
 *  #27 — growth buffer on FSLogix profile storage
 *  #29 — session host density (CPU-limited vs RAM-limited)
 *  #31 — separate OS disk and data/temp disk storage
 *  #33 — FSLogix profile storage location selector
 *  #35 — network bandwidth estimator
 *  #37 — gold image sizing reference
 *  #39 — AVD deployment readiness checklist
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useSurveyorStore } from '../state/store'
import { computeAvd } from '../engine/avd'
import type { AvdWorkloadType, AvdProfileStorageLocation } from '../engine/types'

const GOLD_IMAGE_SIZES = [
  { label: 'Windows 11 base (no apps)', sizeGB: 30 },
  { label: 'Windows 11 + Microsoft 365 Apps', sizeGB: 60 },
  { label: 'Windows 11 + M365 + LOB apps', sizeGB: 80 },
  { label: 'Windows 11 + Developer tools (VS, etc.)', sizeGB: 120 },
  { label: 'Windows 11 + Creative suite (Adobe, etc.)', sizeGB: 150 },
]

const READINESS_CHECKLIST = [
  'Azure Local cluster registered with Azure Arc',
  'Minimum 3 nodes (recommended for production AVD)',
  'Network: 25 GbE RDMA for storage, 10 GbE minimum for VM traffic',
  'Active Directory or Azure AD DS reachable from session hosts',
  'FSLogix license available (included in M365 E3/E5, Win E3/E5, RDS CAL)',
  'Profile storage (SOFS, Azure Files, or S2D share) planned and sized',
  'Gold image tested and captured as managed image or Azure Compute Gallery',
  'Host pool created in Azure with correct workspace assignment',
  'App groups configured and assigned to users/groups',
  'Azure Monitor / Insights enabled on host pool for session metrics',
  'Conditional Access policy for AVD reviewed and applied',
  'BitLocker encryption enabled on session host OS volumes',
]

const STORAGE_LOCATION_DESCRIPTIONS: Record<AvdProfileStorageLocation, string> = {
  's2d': 'Profile VHDXs stored on a CSV on this cluster. Simple, low-latency, no egress — but profiles go offline if cluster is down.',
  'sofs': 'Dedicated Scale-Out File Server guest cluster on this or a separate Azure Local cluster. Recommended for >200 users.',
  'azure-files': 'Azure Files share (Standard or Premium). Survives cluster failure, AD-integrated, but adds latency and egress cost.',
  'external': 'Third-party NAS/SMB share external to Azure Local. Full control but additional infrastructure to manage.',
}

export default function AvdPlanner() {
  const { avd, setAvd, advanced } = useSurveyorStore()
  const result = computeAvd(avd, advanced.overrides)
  const [checklistOpen, setChecklistOpen] = useState(false)

  return (
    <div className="space-y-8">
      {/* ── Inputs ── */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Total users" hint="All licensed users, including non-concurrent">
          <input type="number" min={1} className="input" value={avd.totalUsers}
            onChange={(e) => setAvd({ totalUsers: +e.target.value })} />
        </Field>

        <Field label="Concurrent users (peak)" hint="#26 — 0 = size for all users">
          <input type="number" min={0} className="input" value={avd.concurrentUsers}
            onChange={(e) => setAvd({ concurrentUsers: +e.target.value })} />
          {avd.concurrentUsers > 0 && (
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">
              Sizing for {avd.concurrentUsers} concurrent users (not all {avd.totalUsers})
            </p>
          )}
        </Field>

        <Field label="Workload type">
          <select className="input" value={avd.workloadType}
            onChange={(e) => setAvd({ workloadType: e.target.value as AvdWorkloadType })}>
            <option value="light">Light — Task workers (250 Kbps/user)</option>
            <option value="medium">Medium — Office / Browser (350 Kbps/user)</option>
            <option value="heavy">Heavy — Creative / Dev (1.5 Mbps/user)</option>
            <option value="power">Power — 3D / CAD (15 Mbps/user)</option>
          </select>
        </Field>

        <Field label="Session type">
          <select className="input" value={avd.multiSession ? 'multi' : 'single'}
            onChange={(e) => setAvd({ multiSession: e.target.value === 'multi' })}>
            <option value="multi">Multi-session (Windows 11 Enterprise multi-session)</option>
            <option value="single">Single-session VDI (1 user per VM)</option>
          </select>
        </Field>

        <Field label="FSLogix profile size (GB)">
          {avd.userTypeMixEnabled ? (
            <div className="input bg-gray-100 dark:bg-gray-800 text-gray-500 text-sm py-2">
              {result.effectiveProfileSizeGB} GB (computed from user type mix)
            </div>
          ) : (
            <input type="number" min={1} className="input" value={avd.profileSizeGB}
              onChange={(e) => setAvd({ profileSizeGB: +e.target.value })} />
          )}
        </Field>

        <Field label="User type mix" hint="#59">
          <label className="flex items-center gap-2 mt-2 text-sm">
            <input type="checkbox" checked={avd.userTypeMixEnabled}
              onChange={(e) => setAvd({ userTypeMixEnabled: e.target.checked })} />
            Use weighted user type mix for profile size
          </label>
        </Field>

        <Field label="Profile storage growth buffer %" hint="#27 — applied to total profile storage">
          <input type="number" min={0} max={100} step={5} className="input" value={avd.growthBufferPct}
            onChange={(e) => setAvd({ growthBufferPct: +e.target.value })} />
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

        <Field label="Data / temp disk per host (GB)" hint="#31 — 0 if not needed">
          <input type="number" min={0} step={10} className="input" value={avd.dataDiskPerHostGB}
            onChange={(e) => setAvd({ dataDiskPerHostGB: +e.target.value })} />
        </Field>

        <Field label="FSLogix profile storage location" hint="#33">
          <select className="input" value={avd.profileStorageLocation}
            onChange={(e) => setAvd({ profileStorageLocation: e.target.value as AvdProfileStorageLocation })}>
            <option value="s2d">S2D (CSV on this cluster)</option>
            <option value="sofs">SOFS (Scale-Out File Server)</option>
            <option value="azure-files">Azure Files</option>
            <option value="external">External NAS / SMB</option>
          </select>
        </Field>
      </div>

      {/* User Type Mix (#59) */}
      {avd.userTypeMixEnabled && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">User Type Mix — Profile Size Estimator</div>
          <div className="px-4 py-4 space-y-3">
            <p className="text-sm text-gray-500">
              Specify the percentage of each user type. Profile size will be computed as a weighted average.
              Percentages do not need to sum to 100% — they are normalized automatically.
            </p>
            {([
              { key: 'task', label: 'Task Workers', hint: 'Email, browser, Office basics', defaultGB: 15 },
              { key: 'knowledge', label: 'Knowledge Workers', hint: 'Office, Teams, moderate apps', defaultGB: 40 },
              { key: 'power', label: 'Power Workers', hint: 'Dev tools, creative apps, large data', defaultGB: 80 },
            ] as const).map(({ key, label, hint }) => {
              const pctKey = `${key}Pct` as keyof typeof avd.userTypeMix
              const gbKey = `${key}ProfileGB` as keyof typeof avd.userTypeMix
              return (
                <div key={key} className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-1">
                    <label className="block text-xs font-medium mb-1">
                      {label}
                      <span className="ml-1 text-xs text-gray-400">({hint})</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} max={100} className="input flex-1"
                        value={avd.userTypeMix[pctKey]}
                        onChange={(e) => setAvd({ userTypeMix: { ...avd.userTypeMix, [pctKey]: +e.target.value } })} />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Profile size (GB)</label>
                    <input type="number" min={1} className="input w-full"
                      value={avd.userTypeMix[gbKey]}
                      onChange={(e) => setAvd({ userTypeMix: { ...avd.userTypeMix, [gbKey]: +e.target.value } })} />
                  </div>
                  <div className="text-sm text-gray-500">
                    {avd.totalUsers > 0 && (
                      <>
                        {Math.round(avd.totalUsers * (avd.userTypeMix[pctKey] as number) / 100)} users
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            <div className="rounded-md bg-brand-50 dark:bg-brand-900/20 px-3 py-2 text-sm">
              Weighted average profile size: <strong>{result.effectiveProfileSizeGB} GB</strong>
              {' '}({(result.effectiveProfileSizeGB / 1024 * avd.totalUsers * (1 + avd.growthBufferPct / 100)).toFixed(2)} TB total with growth buffer)
            </div>
          </div>
        </div>
      )}

      {/* Storage location advisory */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
        <span className="font-semibold">Profile storage ({avd.profileStorageLocation}):</span>{' '}
        {STORAGE_LOCATION_DESCRIPTIONS[avd.profileStorageLocation]}
      </div>

      {/* ── Sizing Results ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">AVD Sizing Results</div>
        <table className="w-full text-sm">
          <tbody>
            <Row label={`Sizing users ${avd.concurrentUsers > 0 ? '(concurrent)' : '(total)'}`} value={String(result.sizingUsers)} />
            <Row label="Users per session host" value={String(result.usersPerHost)} />
            <Row label="Session host count" value={String(result.sessionHostCount)} highlight />
            <Row label="vCPUs per host" value={String(result.vCpusPerHost)} />
            <Row label="RAM per host" value={`${result.memoryPerHostGB} GB`} />
            <Row label="Total vCPUs" value={String(result.totalVCpus)} highlight />
            <Row label="Total RAM" value={`${result.totalMemoryGB} GB`} highlight />
            <Row label="OS disk per host" value={`${result.osDiskPerHostGB} GB`} />
            {avd.dataDiskPerHostGB > 0 && (
              <Row label="Data/temp disk per host (#31)" value={`${avd.dataDiskPerHostGB} GB`} />
            )}
            <Row label="OS disk storage" value={`${result.totalOsStorageTB} TB`} />
            {result.totalDataDiskStorageTB > 0 && (
              <Row label="Data disk storage (#31)" value={`${result.totalDataDiskStorageTB} TB`} />
            )}
            <Row label={`Profile storage (${avd.growthBufferPct > 0 ? `+${avd.growthBufferPct}% growth` : 'no buffer'})`}
              value={`${result.profileStorageWithGrowthTB} TB`} />
            {avd.officeContainerEnabled && (
              <Row label="Office Container storage" value={`${result.totalOfficeContainerStorageTB} TB`} />
            )}
            <Row label="Total storage" value={`${result.totalStorageTB} TB`} highlight />
          </tbody>
        </table>
      </div>

      {/* ── Session Host Density Analysis (#29) ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Session Host Density Analysis</div>
        <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800">
          <DensityCell
            label="CPU-limited density"
            value={result.cpuLimitedUsersPerHost}
            active={result.limitingFactor === 'cpu'}
          />
          <DensityCell
            label="RAM-limited density"
            value={result.ramLimitedUsersPerHost}
            active={result.limitingFactor === 'ram'}
          />
          <DensityCell
            label="Microsoft preset"
            value={result.usersPerHost}
            active={result.limitingFactor === 'preset'}
          />
        </div>
        <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800">
          Limiting factor: <strong>{result.limitingFactor === 'preset' ? 'Microsoft sizing preset' : result.limitingFactor === 'cpu' ? 'CPU cores' : 'RAM'}</strong>.
          Sizing uses <strong>{result.usersPerHost} users/host</strong> (Microsoft preset).
        </p>
      </div>

      {/* ── Network Bandwidth Estimator (#35) ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Network Bandwidth Estimate</div>
        <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-800">
          <div className="px-4 py-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Per user ({avd.workloadType})</div>
            <div className="text-2xl font-bold">{result.bandwidthPerUserMbps < 1
              ? `${Math.round(result.bandwidthPerUserMbps * 1000)} Kbps`
              : `${result.bandwidthPerUserMbps} Mbps`}
            </div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Total ({result.sizingUsers} concurrent users)</div>
            <div className="text-2xl font-bold">
              {result.totalBandwidthMbps >= 1000
                ? `${(result.totalBandwidthMbps / 1000).toFixed(1)} Gbps`
                : `${result.totalBandwidthMbps} Mbps`}
            </div>
          </div>
        </div>
        <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800">
          Source: Microsoft AVD network guidelines. Includes RDP display + input traffic only — add file server, update, and Azure traffic separately.
        </p>
      </div>

      {/* ── Gold Image Reference (#37) ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Gold Image Sizing Reference</div>
        <table className="w-full text-sm">
          <tbody>
            {GOLD_IMAGE_SIZES.map((img) => (
              <tr key={img.label} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{img.label}</td>
                <td className="px-4 py-2 text-right font-mono">~{img.sizeGB} GB</td>
                <td className="px-4 py-2 text-right text-gray-400 text-xs">
                  × {result.sessionHostCount} hosts = {Math.round(img.sizeGB * result.sessionHostCount / 1024 * 100) / 100} TB
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800">
          Gold image sizes are estimates. Actual size depends on installed apps and Windows updates.
          Use Azure Compute Gallery for versioned image management.
        </p>
      </div>

      {/* ── AVD Deployment Readiness Checklist (#39) ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          className="flex items-center gap-2 w-full px-4 py-3 text-sm font-semibold text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          onClick={() => setChecklistOpen((o) => !o)}
        >
          {checklistOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          AVD Deployment Readiness Checklist
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
        {hint && <span className="ml-1 text-xs text-gray-400">({hint})</span>}
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

function DensityCell({ label, value, active }: { label: string; value: number; active: boolean }) {
  return (
    <div className={`px-4 py-3 text-center ${active ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${active ? 'text-amber-700 dark:text-amber-400' : ''}`}>
        {value} users/host
      </div>
      {active && <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">limiting factor</div>}
    </div>
  )
}
