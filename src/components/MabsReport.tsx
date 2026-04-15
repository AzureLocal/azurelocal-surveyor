/**
 * MabsReport — dedicated MABS solution summary for the Reports tab.
 * Shown only when MABS is enabled (Phase 13A).
 * Backup sizing, internal mirror impact, VM specs, volume suggestions.
 */
import { useSurveyorStore } from '../state/store'
import { computeMabs } from '../engine/mabs'

const MIRROR_LABELS: Record<string, string> = {
  'simple':    'Simple (no mirror — 1×)',
  'two-way':   'Two-Way Mirror (2×)',
  'three-way': 'Three-Way Mirror (3×)',
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

export default function MabsReport() {
  const state = useSurveyorStore()
  const result = computeMabs(state.mabs)
  const { mabs } = state

  const mirrorLabel = MIRROR_LABELS[mabs.internalMirror] ?? mabs.internalMirror

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">MABS Report</h2>
        <p className="text-sm text-gray-500 mt-1">
          Backup sizing summary, internal mirror impact, and MABS VM specifications.
        </p>
      </div>

      {/* Backup storage sizing */}
      <Section title="Backup Storage Sizing">
        <table className="w-full">
          <tbody>
            <Row label="Protected data" value={`${mabs.protectedDataTB} TB`}
              sub="Total data being protected across all workloads" />
            <Row label="Daily change rate" value={`${mabs.dailyChangeRatePct}%`}
              sub="Typical: 10% for mixed workloads" />
            <Row label="On-premises retention" value={`${mabs.onPremRetentionDays} days`} />
            <Row label="Scratch/cache ratio" value={`${mabs.scratchCachePct}%`}
              sub="Staging area as percentage of protected data" />
            <Row label="Scratch volume" value={`${result.scratchVolumeTB} TB`}
              sub="Staging/cache area for in-progress backups" />
            <Row label="Backup data volume" value={`${result.backupDataVolumeTB} TB`}
              sub="Full + incremental backups for the retention period" />
            <Row label="Total logical storage" value={`${result.totalStorageTB} TB`} highlight
              sub="Scratch + backup data (before internal mirror compounding)" />
          </tbody>
        </table>
      </Section>

      {/* Internal mirror impact */}
      <Section title="Internal Mirror Impact">
        <table className="w-full">
          <tbody>
            <Row label="Internal Storage Spaces mirror" value={mirrorLabel}
              sub="Data mirror inside the MABS VM for resilience" />
            <Row label="Mirror factor" value={`${result.internalMirrorFactor}×`} />
            <Row label="Internal footprint" value={`${result.internalFootprintTB} TB`} highlight
              sub={`${result.totalStorageTB} TB logical × ${result.internalMirrorFactor}× mirror`} />
          </tbody>
        </table>
        {result.internalMirrorFactor > 1 && (
          <div className="px-4 py-3">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-1">Resiliency compounding</p>
              <p>
                The {result.totalStorageTB} TB of backup data is mirrored {result.internalMirrorFactor}× inside the MABS VM ({result.internalFootprintTB} TB of virtual disks).
                Those virtual disks sit on an Azure Local CSV which has its own resiliency —
                for example, a three-way mirror host volume would require a further 3× pool footprint,
                making the total raw pool consumption up to{' '}
                <strong>{(result.internalFootprintTB * 3).toFixed(2)} TB</strong> at three-way mirror.
              </p>
            </div>
          </div>
        )}
      </Section>

      {/* MABS VM specs */}
      <Section title="MABS VM Specifications">
        <table className="w-full">
          <tbody>
            <Row label="vCPUs" value={String(result.mabsVCpus)} highlight />
            <Row label="Memory" value={`${result.mabsMemoryGB} GB`} highlight />
            <Row label="OS disk" value={`${mabs.mabsOsDiskGB} GB (${result.mabsOsDiskTB} TB)`} />
          </tbody>
        </table>
      </Section>

      {/* Volume suggestions */}
      <Section title="Volume Suggestions">
        <div className="px-4 py-3 text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
          These volumes should be created on the Azure Local cluster and presented to the MABS VM.
          Provisioning and resiliency are configured on the Volumes page.
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-800/30 text-left">
              <th className="px-4 py-2 text-xs font-semibold text-gray-500">Volume</th>
              <th className="px-4 py-2 text-xs font-semibold text-gray-500 text-right">Logical Size</th>
              <th className="px-4 py-2 text-xs font-semibold text-gray-500">Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 font-medium">MABS-OS</td>
              <td className="px-4 py-2 text-right">{result.mabsOsDiskTB} TB</td>
              <td className="px-4 py-2 text-gray-500 text-xs">MABS VM operating system disk</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 font-medium">MABS-Scratch</td>
              <td className="px-4 py-2 text-right">{result.scratchVolumeTB} TB</td>
              <td className="px-4 py-2 text-gray-500 text-xs">Staging/cache area — fast storage recommended</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 font-medium">MABS-BackupData</td>
              <td className="px-4 py-2 text-right">{result.backupDataVolumeTB} TB</td>
              <td className="px-4 py-2 text-gray-500 text-xs">Long-term backup retention; thin provisioning default</td>
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  )
}
