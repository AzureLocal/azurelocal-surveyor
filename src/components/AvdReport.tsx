/**
 * AvdReport — dedicated AVD solution summary for the Reports tab.
 * Shown only when AVD is enabled (Phase 13A).
 * Per-pool breakdown: session host count, tier, vCPU, memory, storage, bandwidth.
 */
import { useSurveyorStore } from '../state/store'
import { computeAvd } from '../engine/avd'
import type { AvdPoolResult } from '../engine/types'

const WORKLOAD_LABELS: Record<string, string> = {
  light:     'Light (Task Worker)',
  medium:    'Medium (Knowledge Worker)',
  heavy:     'Heavy (Power User)',
  power:     'Power (3D / Dev)',
}

const STORAGE_LOCATION_LABELS: Record<string, string> = {
  'sofs':        'SOFS (Scale-Out File Server)',
  'azure-files': 'Azure Files',
  'external':    'External / Do Not Count',
}

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

function PoolCard({ pool }: { pool: AvdPoolResult }) {
  return (
    <Section title={`Pool: ${pool.name}`}>
      <table className="w-full">
        <tbody>
          <Row label="Workload type" value={WORKLOAD_LABELS[pool.workloadType] ?? pool.workloadType} />
          <Row label="Session type" value={pool.multiSession ? 'Multi-Session (Windows 11)' : 'Single-Session (VDI)'} />
          <Row label="Total users" value={pool.totalUsers.toLocaleString()} />
          {pool.concurrentUsers > 0 && (
            <Row label="Concurrent users (sizing basis)" value={pool.concurrentUsers.toLocaleString()} />
          )}
          <Row label="Users per host" value={String(pool.usersPerHost)}
            sub={`Limiting factor: ${pool.limitingFactor.toUpperCase()} (CPU limit: ${pool.cpuLimitedUsersPerHost}, RAM limit: ${pool.ramLimitedUsersPerHost})`} />
          <Row label="Session host count" value={String(pool.sessionHostCount)} highlight />
          <Row label="vCPUs per host" value={String(pool.vCpusPerHost)} />
          <Row label="Memory per host" value={`${pool.memoryPerHostGB} GB`} />
          <Row label="Total vCPUs (pool)" value={String(pool.totalVCpus)} highlight />
          <Row label="Total RAM (pool)" value={`${pool.totalMemoryGB} GB`} highlight />
          <Row label="OS disk per host" value={`${pool.osDiskPerHostGB} GB`} />
          {pool.dataDiskPerHostGB > 0 && (
            <Row label="Data/temp disk per host" value={`${pool.dataDiskPerHostGB} GB`} />
          )}
          <Row label="OS storage (pool total)" value={`${pool.totalOsStorageTB} TB`} />
          {pool.dataDiskPerHostGB > 0 && (
            <Row label="Data disk storage (pool total)" value={`${pool.totalDataDiskStorageTB} TB`} />
          )}
          <Row label="Profile storage location" value={STORAGE_LOCATION_LABELS[pool.profileStorageLocation] ?? pool.profileStorageLocation} />
          {pool.profileStorageWithGrowthTB > 0 && (
            <Row label="Profile storage (with growth)" value={`${pool.profileStorageWithGrowthTB} TB`} />
          )}
          {pool.totalOfficeContainerStorageTB > 0 && (
            <Row label="Office container storage" value={`${pool.totalOfficeContainerStorageTB} TB`} />
          )}
          <Row label="Total storage (pool)" value={`${pool.totalStorageTB} TB`} highlight />
          {pool.externalizedStorageTB > 0 && (
            <Row label="Externalized storage (off-cluster)" value={`${pool.externalizedStorageTB} TB`}
              sub="Profile/Office containers hosted outside Azure Local. Not included in cluster storage planning." />
          )}
          <Row label="Bandwidth per user" value={`${pool.bandwidthPerUserMbps} Mbps`} />
          <Row label="Total bandwidth (pool)" value={`${pool.totalBandwidthMbps} Mbps`}
            sub={`${(pool.totalBandwidthMbps / 1024).toFixed(2)} Gbps`} />
        </tbody>
      </table>
    </Section>
  )
}

export default function AvdReport() {
  const state = useSurveyorStore()
  const result = computeAvd(state.avd, state.advanced.overrides)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">AVD Report</h2>
        <p className="text-sm text-gray-500 mt-1">
          Per-pool session host sizing, storage breakdown, and bandwidth estimates for Azure Virtual Desktop on Azure Local.
        </p>
      </div>

      {/* Summary totals */}
      <Section title="AVD Summary">
        <table className="w-full">
          <tbody>
            <Row label="Host pools" value={String(result.poolCount)} />
            <Row label="Total users" value={result.totalUsers.toLocaleString()} />
            <Row label="Total session hosts" value={String(result.sessionHostCount)} highlight />
            <Row label="Total vCPUs" value={String(result.totalVCpus)} highlight />
            <Row label="Total RAM" value={`${result.totalMemoryGB} GB`} highlight />
            <Row label="Total storage (on-cluster)" value={`${result.totalStorageTB} TB`}
              sub="Includes OS disks, data disks, profiles (if on-cluster)" />
            {result.totalExternalStorageTB > 0 && (
              <Row label="External storage (off-cluster)" value={`${result.totalExternalStorageTB} TB`}
                sub="Profile/Office containers on SOFS, Azure Files, or external host" />
            )}
            <Row label="Total bandwidth" value={`${result.totalBandwidthMbps} Mbps`}
              sub={`${(result.totalBandwidthMbps / 1024).toFixed(2)} Gbps across all pools`} />
          </tbody>
        </table>
      </Section>

      {/* Per-pool breakdown */}
      {result.pools.map((pool) => (
        <PoolCard key={pool.id} pool={pool} />
      ))}
    </div>
  )
}
