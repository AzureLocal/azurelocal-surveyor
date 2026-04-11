import { ExternalLink } from 'lucide-react'
import { useSurveyorStore } from '../state/store'
import { computeMabs } from '../engine/mabs'
import type { ResiliencyType, MabsInternalMirror } from '../engine/types'

/** Parse numeric input — returns current value if input is empty or NaN. */
function num(e: React.ChangeEvent<HTMLInputElement>, current: number): number {
  const v = e.target.value
  if (v === '' || v === '-') return current
  const n = +v
  return isNaN(n) ? current : n
}

export default function MabsPage() {
  const { mabs, setMabs, mabsEnabled, setMabsEnabled } = useSurveyorStore()
  const result = computeMabs(mabs)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">MABS Planner</h1>
          <p className="text-sm text-gray-500 mt-1">
            Microsoft Azure Backup Server sizing for on-prem backup with Azure offload.
            MABS runs as a single Windows Server VM on the Azure Local cluster.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1 shrink-0">
          <span className="text-sm text-gray-600 dark:text-gray-400">Include in cluster totals</span>
          <button
            onClick={() => setMabsEnabled(!mabsEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${mabsEnabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${mabsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {!mabsEnabled && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          MABS is currently <strong>excluded</strong> from workload totals and health checks.
          Enable the toggle above to include MABS compute and storage in cluster planning.
        </div>
      )}

      {/* Architecture overview */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-sm space-y-1.5">
        <p className="font-semibold text-blue-900 dark:text-blue-200">How MABS works on Azure Local</p>
        <ol className="list-decimal list-inside text-blue-800 dark:text-blue-300 text-xs space-y-1">
          <li>Create Azure Local volumes (CSVs) for MABS scratch and backup storage</li>
          <li>Attach those volumes to the MABS Windows Server VM as virtual data disks</li>
          <li>Inside the VM, MABS uses <strong>Storage Spaces</strong> (classic, not S2D) to pool the data disks</li>
          <li>MABS manages backup jobs — data lands in the scratch/cache first, then moves to backup storage</li>
          <li>After on-prem retention (typically 7–14 days), older recovery points offload to Azure Recovery Services Vault</li>
        </ol>
      </div>

      {/* #73: MABS explanation and docs links */}
      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-4 text-sm space-y-2">
        <p className="text-gray-700 dark:text-gray-300">
          <strong>Microsoft Azure Backup Server (MABS)</strong> provides enterprise backup for Azure Local
          workloads — VMs, SQL databases, and file servers. MABS runs as a single Windows Server VM and
          uses Storage Spaces (classic) internally to pool virtual data disks for scratch/cache and backup
          retention. On-prem retention is typically 7–14 days before recovery points offload to Azure
          Recovery Services Vault. This is the recommended approach for small-to-mid sites that lack
          dedicated backup infrastructure.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <DocLink href="https://learn.microsoft.com/azure/backup/backup-mabs-install-azure-stack" label="Microsoft Learn: MABS on Azure Local" />
          <DocLink href="https://learn.microsoft.com/azure/backup/backup-azure-microsoft-azure-backup" label="Microsoft Learn: MABS Overview" />
        </div>
      </div>

      {/* ── Inputs ── */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Protected data (TB)" hint="total data being backed up">
          <input type="number" min={0.1} step={0.1} className="input" value={mabs.protectedDataTB}
            onChange={(e) => setMabs({ protectedDataTB: num(e, mabs.protectedDataTB) })} />
        </Field>

        <Field label="Daily change rate (%)" hint="typical 10% for mixed workloads">
          <input type="number" min={1} max={50} step={1} className="input" value={mabs.dailyChangeRatePct}
            onChange={(e) => setMabs({ dailyChangeRatePct: num(e, mabs.dailyChangeRatePct) })} />
        </Field>

        <Field label="On-prem retention (days)" hint="before Azure offload">
          <input type="number" min={1} max={90} step={1} className="input" value={mabs.onPremRetentionDays}
            onChange={(e) => setMabs({ onPremRetentionDays: num(e, mabs.onPremRetentionDays) })} />
        </Field>

        <Field label="Scratch/cache (% of protected)" hint="staging area for backup jobs">
          <input type="number" min={5} max={50} step={1} className="input" value={mabs.scratchCachePct}
            onChange={(e) => setMabs({ scratchCachePct: num(e, mabs.scratchCachePct) })} />
        </Field>

        <Field label="Backup volume resiliency" hint="Azure Local cluster volume">
          <select className="input" value={mabs.resiliency}
            onChange={(e) => setMabs({ resiliency: e.target.value as ResiliencyType })}>
            <option value="dual-parity">Dual Parity (50–80%)</option>
            <option value="three-way-mirror">Three-Way Mirror (33%)</option>
            <option value="two-way-mirror">Two-Way Mirror (50%)</option>
          </select>
        </Field>

        <Field label="Storage Spaces mirror (#70)" hint="inside MABS VM">
          <select className="input" value={mabs.internalMirror}
            onChange={(e) => setMabs({ internalMirror: e.target.value as MabsInternalMirror })}>
            <option value="two-way">Two-Way Mirror (2× footprint)</option>
            <option value="three-way">Three-Way Mirror (3× footprint)</option>
            <option value="simple">Simple / No Mirror (1×)</option>
          </select>
        </Field>
      </div>

      {/* MABS VM specs */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">MABS VM Sizing</div>
        <div className="px-4 py-4">
          <p className="text-xs text-gray-500 mb-3">
            The MABS server runs as a single Windows Server VM. These defaults follow Microsoft sizing guidance.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="vCPUs">
              <input type="number" min={2} max={32} step={1} className="input" value={mabs.mabsVCpus}
                onChange={(e) => setMabs({ mabsVCpus: num(e, mabs.mabsVCpus) })} />
            </Field>
            <Field label="RAM (GB)">
              <input type="number" min={8} max={256} step={8} className="input" value={mabs.mabsMemoryGB}
                onChange={(e) => setMabs({ mabsMemoryGB: num(e, mabs.mabsMemoryGB) })} />
            </Field>
            <Field label="OS disk (GB)">
              <input type="number" min={100} max={500} step={50} className="input" value={mabs.mabsOsDiskGB}
                onChange={(e) => setMabs({ mabsOsDiskGB: num(e, mabs.mabsOsDiskGB) })} />
            </Field>
          </div>
        </div>
      </div>

      {/* ── Sizing Results ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">MABS Storage Sizing</div>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Scratch/cache volume" value={`${result.scratchVolumeTB} TB`}
              detail={`${mabs.scratchCachePct}% of ${mabs.protectedDataTB} TB protected`} />
            <Row label="Backup data volume" value={`${result.backupDataVolumeTB} TB`}
              detail={`Full copy + ${mabs.dailyChangeRatePct}% daily change × ${mabs.onPremRetentionDays} days`} />
            <Row label="Total logical storage" value={`${result.totalStorageTB} TB`} highlight />
            <Row label={`Storage Spaces mirror (${mabs.internalMirror === 'simple' ? '1×' : mabs.internalMirror === 'two-way' ? '2×' : '3×'})`}
              value={`${result.internalFootprintTB} TB`}
              detail={`Logical ${result.totalStorageTB} TB × ${result.internalMirrorFactor} mirror = virtual disk demand`} />
            <Row label="MABS VM compute" value={`${result.mabsVCpus} vCPUs, ${result.mabsMemoryGB} GB RAM`} />
            <Row label="MABS VM OS disk" value={`${mabs.mabsOsDiskGB} GB`} />
          </tbody>
        </table>
      </div>

      {/* Resiliency Compounding (#70) */}
      {result.internalMirrorFactor > 1 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm space-y-1">
          <p className="font-semibold text-amber-900 dark:text-amber-200">Resiliency Compounding</p>
          <p className="text-amber-800 dark:text-amber-300 text-xs">
            MABS needs {result.totalStorageTB} TB of logical backup storage. Storage Spaces inside the VM
            uses a <strong>{mabs.internalMirror} mirror</strong>, requiring{' '}
            <strong>{result.internalFootprintTB} TB</strong> of virtual disk space.
            Those virtual disks sit on Azure Local CSV volumes with their own resiliency.
            For example, at dual-parity (50%) the total pool footprint would be{' '}
            <strong>{(result.internalFootprintTB * 2).toFixed(2)} TB</strong>.
            At three-way mirror it would be <strong>{(result.internalFootprintTB * 3).toFixed(2)} TB</strong>.
          </p>
        </div>
      )}

      {/* Storage breakdown visual */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Storage Breakdown</div>
        <div className="px-4 py-4">
          <div className="flex h-8 rounded-lg overflow-hidden">
            {result.totalStorageTB > 0 && (
              <>
                <div
                  className="bg-amber-400 dark:bg-amber-600 flex items-center justify-center text-xs font-medium text-white"
                  style={{ width: `${(result.scratchVolumeTB / result.totalStorageTB) * 100}%` }}
                  title={`Scratch: ${result.scratchVolumeTB} TB`}
                >
                  {result.scratchVolumeTB > 0 && 'Scratch'}
                </div>
                <div
                  className="bg-brand-500 dark:bg-brand-600 flex items-center justify-center text-xs font-medium text-white"
                  style={{ width: `${(result.backupDataVolumeTB / result.totalStorageTB) * 100}%` }}
                  title={`Backup: ${result.backupDataVolumeTB} TB`}
                >
                  Backup Data
                </div>
              </>
            )}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-400 dark:bg-amber-600 inline-block" />
              Scratch: {result.scratchVolumeTB} TB
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-brand-500 dark:bg-brand-600 inline-block" />
              Backup data: {result.backupDataVolumeTB} TB
            </span>
          </div>
        </div>
      </div>

      {/* Azure offload note */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-sm space-y-1.5">
        <p className="font-semibold text-blue-900 dark:text-blue-200">Azure Recovery Services Vault</p>
        <p className="text-blue-800 dark:text-blue-300 text-xs">
          Long-term retention beyond {mabs.onPremRetentionDays} days offloads to Azure.
          Only the on-prem storage footprint is counted in cluster capacity.
          Configure retention policies in the Azure portal after deploying MABS.
        </p>
      </div>
    </div>
  )
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-700 dark:text-brand-300 bg-white dark:bg-gray-900 border border-brand-200 dark:border-brand-800 rounded-md hover:bg-brand-50 dark:hover:bg-brand-900/50 transition-colors"
    >
      <ExternalLink className="w-3 h-3" />
      {label}
    </a>
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

function Row({ label, value, detail, highlight }: { label: string; value: string; detail?: string; highlight?: boolean }) {
  return (
    <tr className={`border-t border-gray-100 dark:border-gray-800 ${highlight ? 'bg-brand-50 dark:bg-brand-900/20 font-semibold' : ''}`}>
      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
        {label}
        {detail && <span className="block text-xs text-gray-400 font-normal">{detail}</span>}
      </td>
      <td className="px-4 py-2 text-right">{value}</td>
    </tr>
  )
}
