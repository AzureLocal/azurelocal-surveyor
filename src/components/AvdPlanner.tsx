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
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { createDefaultAvdPool } from '../engine/avd-pools'
import { computeAvd } from '../engine/avd'
import type { AvdHostPool, AvdPoolResult, AvdProfileStorageLocation, AvdWorkloadType } from '../engine/types'
import { useSurveyorStore } from '../state/store'

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

function num(e: React.ChangeEvent<HTMLInputElement>, current: number): number {
  const v = e.target.value
  if (v === '' || v === '-') return current
  const n = +v
  return isNaN(n) ? current : n
}

export default function AvdPlanner() {
  const { avd, setAvd, advanced, setSofs, setSofsEnabled, sofsEnabled, sofs } = useSurveyorStore()
  const result = computeAvd(avd, advanced.overrides)
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(avd.pools[0]?.id ?? null)

  const selectedPool = avd.pools.find((pool) => pool.id === selectedPoolId) ?? avd.pools[0]
  const selectedPoolResult = result.pools.find((pool) => pool.id === selectedPool?.id) ?? result.pools[0]
  const usingSofs = avd.pools.some((pool) => pool.profileStorageLocation === 'sofs')
  const sofsPoolCount = avd.pools.filter((pool) => pool.profileStorageLocation === 'sofs').length
  const profileSizeInSync = !usingSofs || sofs.profileSizeGB === result.sofsLinkedProfileSizeGB
  const sofsInSync = usingSofs && sofsEnabled &&
    sofs.userCount === result.sofsLinkedUserCount &&
    sofs.concurrentUsers === result.sofsLinkedConcurrentUsers &&
    profileSizeInSync

  useEffect(() => {
    if (!selectedPool && avd.pools[0]) {
      setSelectedPoolId(avd.pools[0].id)
    }
  }, [selectedPool, avd.pools])

  function updateSelectedPool(updates: Partial<AvdHostPool>) {
    if (!selectedPool) return
    setAvd({
      pools: avd.pools.map((pool) => pool.id === selectedPool.id ? { ...pool, ...updates } : pool),
    })
  }

  function addPool() {
    const nextPool = createDefaultAvdPool(avd.pools.length + 1)
    setAvd({ pools: [...avd.pools, nextPool] })
    setSelectedPoolId(nextPool.id)
  }

  function removeSelectedPool() {
    if (!selectedPool || avd.pools.length === 1) return
    const remainingPools = avd.pools.filter((pool) => pool.id !== selectedPool.id)
    setAvd({ pools: remainingPools })
    setSelectedPoolId(remainingPools[0]?.id ?? null)
  }

  function syncToSofs() {
    setSofsEnabled(true)
    setSofs({
      userCount: result.sofsLinkedUserCount,
      concurrentUsers: result.sofsLinkedConcurrentUsers,
      profileSizeGB: result.sofsLinkedProfileSizeGB,
    })
  }

  if (!selectedPool || !selectedPoolResult) return null

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between gap-4 bg-gray-50 dark:bg-gray-800 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Session Host Groups</div>
            <div className="text-xs text-gray-500">Model one or more session host groups. Each group maps to a host pool in Azure and its own set of session host VMs on Azure Local.</div>
          </div>
          <button
            onClick={addPool}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-brand-600 hover:bg-brand-700 text-white transition-colors"
          >
            Add session host group
          </button>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {avd.pools.map((pool) => {
            const poolResult = result.pools.find((item) => item.id === pool.id)
            const active = pool.id === selectedPool.id
            return (
              <button
                key={pool.id}
                onClick={() => setSelectedPoolId(pool.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${active
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm">{pool.name}</div>
                  <span className="text-[11px] uppercase tracking-wide text-gray-500">{pool.profileStorageLocation}</span>
                </div>
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <div>{pool.totalUsers} users, {pool.concurrentUsers > 0 ? `${pool.concurrentUsers} concurrent` : 'size to total users'}</div>
                  <div>{pool.workloadType} workload, {pool.multiSession ? 'multi-session' : 'single-session'}</div>
                  {poolResult && <div>{poolResult.sessionHostCount} hosts, {poolResult.totalVCpus} vCPUs, {poolResult.totalStorageTB} TB cluster storage</div>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Editing {selectedPool.name}</h3>
          <p className="text-xs text-gray-500">Session host group sizing lives here. User type mix and growth buffer remain shared across all groups.</p>
        </div>
        {avd.pools.length > 1 && (
          <button
            onClick={removeSelectedPool}
            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20 transition-colors"
          >
            Remove selected group
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Session host group name">
          <input
            type="text"
            className="input"
            value={selectedPool.name}
            onChange={(e) => updateSelectedPool({ name: e.target.value })}
          />
        </Field>

        <Field label="Total users" hint="Drives profile storage and overall capacity">
          <input type="number" min={1} className="input" value={selectedPool.totalUsers}
            onChange={(e) => updateSelectedPool({ totalUsers: num(e, selectedPool.totalUsers) })} />
        </Field>

        <Field label="Concurrent users (peak)" hint="Drives session hosts, compute, and bandwidth">
          <input type="number" min={0} className="input" value={selectedPool.concurrentUsers}
            onChange={(e) => updateSelectedPool({ concurrentUsers: num(e, selectedPool.concurrentUsers) })} />
          <p className="text-xs text-gray-400 mt-1">
            Session hosts, compute, and bandwidth are sized for concurrent users.
            Profile and Office Container storage is always sized for all total users —
            profiles exist for every assigned user, not just active ones.
          </p>
          {selectedPool.concurrentUsers > 0 && selectedPool.concurrentUsers < selectedPool.totalUsers && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Sizing for {selectedPool.concurrentUsers} concurrent ({Math.round(selectedPool.concurrentUsers / selectedPool.totalUsers * 100)}% of {selectedPool.totalUsers} total).
              {' '}If actual peaks exceed this assumption, compute and session hosts will run out of headroom first.
              {selectedPool.concurrentUsers < selectedPool.totalUsers * 0.7 && ' Build in burst headroom or size against total users for a conservative plan.'}
            </p>
          )}
        </Field>

        <Field label="Workload type">
          <select className="input" value={selectedPool.workloadType}
            onChange={(e) => updateSelectedPool({ workloadType: e.target.value as AvdWorkloadType })}>
            <option value="light">Light — Task workers (250 Kbps/user)</option>
            <option value="medium">Medium — Office / Browser (350 Kbps/user)</option>
            <option value="heavy">Heavy — Creative / Dev (1.5 Mbps/user)</option>
            <option value="power">Power — 3D / CAD (15 Mbps/user)</option>
          </select>
        </Field>

        <Field label="Session type">
          <select className="input" value={selectedPool.multiSession ? 'multi' : 'single'}
            onChange={(e) => updateSelectedPool({ multiSession: e.target.value === 'multi' })}>
            <option value="multi">Multi-session (Windows 11 Enterprise multi-session)</option>
            <option value="single">Single-session VDI (1 user per VM)</option>
          </select>
        </Field>

        <Field label="FSLogix profile size (GB)">
          {avd.userTypeMixEnabled ? (
            <div className="input bg-gray-100 dark:bg-gray-800 text-gray-500 text-sm py-2">
              {selectedPoolResult.effectiveProfileSizeGB} GB (computed from user type mix)
            </div>
          ) : (
            <input type="number" min={1} className="input" value={selectedPool.profileSizeGB}
              onChange={(e) => updateSelectedPool({ profileSizeGB: num(e, selectedPool.profileSizeGB) })} />
          )}
          {sofsEnabled && selectedPool.profileStorageLocation === 'sofs' && (
            <p className={`text-xs mt-1 ${profileSizeInSync ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {profileSizeInSync
                ? `SOFS linked aggregate profile size is ${sofs.profileSizeGB} GB.`
                : `SOFS planner currently differs (${sofs.profileSizeGB} GB). Editing SOFS-targeted pools updates the SOFS planner automatically.`}
            </p>
          )}
        </Field>

        <Field label="User type mix" hint="#59">
          <label className="flex items-center gap-2 mt-2 text-sm">
            <input type="checkbox" checked={avd.userTypeMixEnabled}
              onChange={(e) => setAvd({ userTypeMixEnabled: e.target.checked })} />
            Use weighted user type mix for profile size
          </label>
          <p className="text-xs text-gray-400 mt-1">Applies to every host pool.</p>
        </Field>

        <Field label="Profile storage growth buffer %" hint="#27 — applied to total profile storage">
          <input type="number" min={0} max={100} step={5} className="input" value={avd.growthBufferPct}
            onChange={(e) => setAvd({ growthBufferPct: num(e, avd.growthBufferPct) })} />
        </Field>

        <Field label="Office Container">
          <label className="flex items-center gap-2 mt-2 text-sm">
            <input type="checkbox" checked={selectedPool.officeContainerEnabled}
              onChange={(e) => updateSelectedPool({ officeContainerEnabled: e.target.checked })} />
            Enable FSLogix Office Container
          </label>
        </Field>

        {selectedPool.officeContainerEnabled && (
          <Field label="Office Container size (GB)">
            <input type="number" min={1} className="input" value={selectedPool.officeContainerSizeGB}
              onChange={(e) => updateSelectedPool({ officeContainerSizeGB: num(e, selectedPool.officeContainerSizeGB) })} />
          </Field>
        )}

        <Field label="Data / temp disk per host (GB)" hint="0 if not needed">
          <input type="number" min={0} step={10} className="input" value={selectedPool.dataDiskPerHostGB}
            onChange={(e) => updateSelectedPool({ dataDiskPerHostGB: num(e, selectedPool.dataDiskPerHostGB) })} />
        </Field>

        <Field label="FSLogix profile storage location">
          <select className="input" value={selectedPool.profileStorageLocation}
            onChange={(e) => updateSelectedPool({ profileStorageLocation: e.target.value as AvdProfileStorageLocation })}>
            <option value="s2d">S2D (CSV on this cluster)</option>
            <option value="sofs">SOFS (Scale-Out File Server)</option>
            <option value="azure-files">Azure Files</option>
            <option value="external">External NAS / SMB</option>
          </select>
        </Field>
      </div>

      {avd.userTypeMixEnabled && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">User Type Mix — Profile Size Estimator</div>
          <div className="px-4 py-4 space-y-3">
            <p className="text-sm text-gray-500">
              Specify the percentage of each user type. Profile size will be computed as a weighted average.
              Percentages do not need to sum to 100% — they are normalized automatically.
            </p>
            {([
              { key: 'task', label: 'Task Workers', hint: 'Email, browser, Office basics' },
              { key: 'knowledge', label: 'Knowledge Workers', hint: 'Office, Teams, moderate apps' },
              { key: 'power', label: 'Power Workers', hint: 'Dev tools, creative apps, large data' },
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
                        onChange={(e) => setAvd({ userTypeMix: { ...avd.userTypeMix, [pctKey]: num(e, avd.userTypeMix[pctKey] as number) } })} />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Profile size (GB)</label>
                    <input type="number" min={1} className="input w-full"
                      value={avd.userTypeMix[gbKey]}
                      onChange={(e) => setAvd({ userTypeMix: { ...avd.userTypeMix, [gbKey]: num(e, avd.userTypeMix[gbKey] as number) } })} />
                  </div>
                  <div className="text-sm text-gray-500">
                    {result.totalUsers > 0 && (
                      <>
                        {Math.round(result.totalUsers * (avd.userTypeMix[pctKey] as number) / 100)} users
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            <div className="rounded-md bg-brand-50 dark:bg-brand-900/20 px-3 py-2 text-sm">
              Weighted average profile size: <strong>{result.effectiveProfileSizeGB} GB</strong>
              {' '}({(result.effectiveProfileSizeGB / 1024 * result.totalUsers * (1 + avd.growthBufferPct / 100)).toFixed(2)} TB total with growth buffer)
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
        <span className="font-semibold">{selectedPool.name} profile storage ({selectedPool.profileStorageLocation}):</span>{' '}
        {STORAGE_LOCATION_DESCRIPTIONS[selectedPool.profileStorageLocation]}
      </div>

      {usingSofs && (
        <div className={`rounded-lg border px-4 py-3 space-y-2 ${sofsInSync ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-sm font-semibold ${sofsInSync ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
                {sofsInSync ? 'SOFS planner is in sync with AVD inputs' : 'SOFS planner needs AVD profile sizing'}
              </p>
              <p className={`text-xs mt-0.5 ${sofsInSync ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {sofsInSync
                  ? `SOFS is enabled and sized for ${result.sofsLinkedUserCount} users with ${result.sofsLinkedProfileSizeGB} GB profiles across ${sofsPoolCount} SOFS-targeted session host group${sofsPoolCount === 1 ? '' : 's'}. Configure additional SOFS settings on the SOFS page.`
                  : `You have ${sofsPoolCount} session host group${sofsPoolCount === 1 ? '' : 's'} targeting SOFS. Applying sync pushes aggregated user counts and weighted profile size into the SOFS planner.`}
              </p>
            </div>
            {!sofsInSync && (
              <button
                onClick={syncToSofs}
                className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 hover:bg-amber-700 text-white transition-colors"
              >
                Apply to SOFS planner
              </button>
            )}
          </div>
          {!sofsInSync && (
            <div className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
              <p>
              Applies: {result.sofsLinkedUserCount} total users, {result.sofsLinkedConcurrentUsers} concurrent, {result.sofsLinkedProfileSizeGB} GB weighted profile size.
              Does not overwrite SOFS guest VM count, mirror type, or redirected folder sizing.
              </p>
              <p>
                Open the <Link to="/sofs" className="font-semibold underline">SOFS planner</Link> to finish guest cluster sizing and redirected-folder assumptions.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">AVD Sizing Results</div>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Session host groups" value={String(result.poolCount)} />
            <Row label="Total users" value={String(result.totalUsers)} />
            <Row label="Sizing users" value={String(result.sizingUsers)} sub="Concurrent users where provided, otherwise total users" />
            <Row label="Session host count" value={String(result.sessionHostCount)} highlight />
            <Row label="Total vCPUs" value={String(result.totalVCpus)} highlight />
            <Row label="Total RAM" value={`${result.totalMemoryGB} GB`} highlight />
            <Row label="OS disk storage" value={`${result.totalOsStorageTB} TB`} />
            {result.totalDataDiskStorageTB > 0 && (
              <Row label="Data disk storage" value={`${result.totalDataDiskStorageTB} TB`} />
            )}
            <Row
              label={`Profile storage (${avd.growthBufferPct > 0 ? `+${avd.growthBufferPct}% growth` : 'no buffer'})`}
              value={`${result.profileStorageWithGrowthTB} TB`}
              sub={`Sized for all ${result.totalUsers} users — allocated for every assigned user regardless of concurrency`}
            />
            {result.totalOfficeContainerStorageTB > 0 && (
              <Row label="Office Container storage" value={`${result.totalOfficeContainerStorageTB} TB`} />
            )}
            <Row label="Cluster storage on Azure Local" value={`${result.totalStorageTB} TB`} highlight />
            {result.totalExternalStorageTB > 0 && (
              <Row label="External profile and Office storage" value={`${result.totalExternalStorageTB} TB`} sub="Storage hosted outside the Azure Local cluster" />
            )}
            <Row label="Total bandwidth" value={formatBandwidth(result.totalBandwidthMbps)} />
          </tbody>
        </table>
      </div>

      {result.poolCount > 1 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Per-Pool Breakdown</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50/60 dark:bg-gray-800/60 text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Pool</th>
                <th className="px-4 py-2 text-right font-medium">Users</th>
                <th className="px-4 py-2 text-right font-medium">Hosts</th>
                <th className="px-4 py-2 text-right font-medium">vCPUs</th>
                <th className="px-4 py-2 text-right font-medium">RAM</th>
                <th className="px-4 py-2 text-right font-medium">Cluster TB</th>
                <th className="px-4 py-2 text-right font-medium">External TB</th>
              </tr>
            </thead>
            <tbody>
              {result.pools.map((pool) => (
                <PoolRow key={pool.id} pool={pool} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Session Host Density Analysis{result.poolCount > 1 ? ` — ${selectedPool.name}` : ''}</div>
        <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800">
          <DensityCell
            label="CPU-limited density"
            value={selectedPoolResult.cpuLimitedUsersPerHost}
            active={selectedPoolResult.limitingFactor === 'cpu'}
          />
          <DensityCell
            label="RAM-limited density"
            value={selectedPoolResult.ramLimitedUsersPerHost}
            active={selectedPoolResult.limitingFactor === 'ram'}
          />
          <DensityCell
            label="Microsoft preset"
            value={selectedPoolResult.usersPerHost}
            active={selectedPoolResult.limitingFactor === 'preset'}
          />
        </div>
        <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800">
          Limiting factor: <strong>{selectedPoolResult.limitingFactor === 'preset' ? 'Microsoft sizing preset' : selectedPoolResult.limitingFactor === 'cpu' ? 'CPU cores' : 'RAM'}</strong>.
          Sizing uses <strong>{selectedPoolResult.usersPerHost} users/host</strong> (Microsoft preset).
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Network Bandwidth Estimate{result.poolCount > 1 ? ` — ${selectedPool.name}` : ''}</div>
        <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-800">
          <div className="px-4 py-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Per user ({selectedPool.workloadType})</div>
            <div className="text-2xl font-bold">{selectedPoolResult.bandwidthPerUserMbps < 1
              ? `${Math.round(selectedPoolResult.bandwidthPerUserMbps * 1000)} Kbps`
              : `${selectedPoolResult.bandwidthPerUserMbps} Mbps`}
            </div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Selected pool total ({selectedPoolResult.sizingUsers} sizing users)</div>
            <div className="text-2xl font-bold">{formatBandwidth(selectedPoolResult.totalBandwidthMbps)}</div>
          </div>
        </div>
        <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800">
          Source: Microsoft AVD network guidelines. Includes RDP display + input traffic only — add file server, update, and Azure traffic separately.
          {result.poolCount > 1 && ` Aggregate across all pools: ${formatBandwidth(result.totalBandwidthMbps)}.`}
        </p>
      </div>

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

function PoolRow({ pool }: { pool: AvdPoolResult }) {
  return (
    <tr className="border-t border-gray-100 dark:border-gray-800">
      <td className="px-4 py-2">
        <div className="font-medium">{pool.name}</div>
        <div className="text-xs text-gray-500">{pool.workloadType}, {pool.multiSession ? 'multi-session' : 'single-session'}, {pool.profileStorageLocation}</div>
      </td>
      <td className="px-4 py-2 text-right">{pool.totalUsers}{pool.concurrentUsers > 0 ? ` (${pool.concurrentUsers} conc.)` : ''}</td>
      <td className="px-4 py-2 text-right">{pool.sessionHostCount}</td>
      <td className="px-4 py-2 text-right">{pool.totalVCpus}</td>
      <td className="px-4 py-2 text-right">{pool.totalMemoryGB} GB</td>
      <td className="px-4 py-2 text-right">{pool.totalStorageTB} TB</td>
      <td className="px-4 py-2 text-right">{pool.externalizedStorageTB} TB</td>
    </tr>
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

function formatBandwidth(mbps: number): string {
  return mbps >= 1000 ? `${(mbps / 1000).toFixed(1)} Gbps` : `${mbps} Mbps`
}
