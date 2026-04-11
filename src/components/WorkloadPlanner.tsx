/**
 * WorkloadPlanner — six fixed, enable/disable scenarios matching the Excel
 * "Workload Planner" sheet exactly:
 *   1. AVD (Azure Virtual Desktop) — configured on the AVD page
 *   2. AKS on Azure Local
 *   3. Infrastructure VMs
 *   4. Dev / Test VMs
 *   5. Backup / Archive
 *   6. Custom VMs
 */
import { Link } from 'react-router-dom'
import { useSurveyorStore } from '../state/store'
import { computeAvd } from '../engine/avd'
import { computeAks } from '../engine/aks'
import { computeSofs } from '../engine/sofs'
import type { ResiliencyType, VmScenario } from '../engine/types'

// ─── Scenario card wrapper ────────────────────────────────────────────────────

function ScenarioCard({
  label,
  badge,
  enabled,
  onToggle,
  children,
}: {
  label: string
  badge?: string
  enabled: boolean
  onToggle: () => void
  children?: React.ReactNode
}) {
  return (
    <div className={`rounded-lg border ${enabled ? 'border-brand-400 dark:border-brand-600' : 'border-gray-200 dark:border-gray-700'} overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{label}</span>
          {badge && <span className="px-2 py-0.5 text-xs rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300">{badge}</span>}
        </div>
        <button
          onClick={onToggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {enabled && children && (
        <div className="px-4 py-3 space-y-3 border-t border-gray-100 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Resiliency select shared ─────────────────────────────────────────────────

function ResiliencySelect({ value, onChange }: { value: ResiliencyType; onChange: (v: ResiliencyType) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as ResiliencyType)} className="input">
      <option value="three-way-mirror">Three-Way Mirror (33%)</option>
      <option value="two-way-mirror">Two-Way Mirror (50%)</option>
      <option value="dual-parity">Dual Parity (50–80%)</option>
      <option value="nested-two-way">Nested Two-Way (25%)</option>
    </select>
  )
}

// ─── VM scenario fields (Infra / Dev-Test / Custom) ──────────────────────────

function VmFields({
  value,
  onChange,
}: {
  value: VmScenario
  onChange: (v: Partial<VmScenario>) => void
}) {
  const effectiveVCpus = Math.round((value.vmCount * value.vCpusPerVm) / value.vCpuOvercommitRatio)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <SmallField label="VM count">
        <input type="number" min={1} className="input w-full" value={value.vmCount}
          onChange={(e) => onChange({ vmCount: +e.target.value })} />
      </SmallField>
      <SmallField label="vCPUs / VM">
        <input type="number" min={1} className="input w-full" value={value.vCpusPerVm}
          onChange={(e) => onChange({ vCpusPerVm: +e.target.value })} />
      </SmallField>
      <SmallField label="RAM / VM (GB)">
        <input type="number" min={1} className="input w-full" value={value.memoryPerVmGB}
          onChange={(e) => onChange({ memoryPerVmGB: +e.target.value })} />
      </SmallField>
      <SmallField label="Storage / VM (GB)">
        <input type="number" min={1} className="input w-full" value={value.storagePerVmGB}
          onChange={(e) => onChange({ storagePerVmGB: +e.target.value })} />
      </SmallField>
      <SmallField label="vCPU overcommit" hint={`${effectiveVCpus} effective vCPUs`}>
        <select className="input w-full" value={value.vCpuOvercommitRatio}
          onChange={(e) => onChange({ vCpuOvercommitRatio: +e.target.value })}>
          <option value={1}>1:1 (no overcommit)</option>
          <option value={2}>2:1</option>
          <option value={4}>4:1</option>
          <option value={6}>6:1</option>
          <option value={8}>8:1</option>
        </select>
      </SmallField>
      <SmallField label="Resiliency">
        <ResiliencySelect value={value.resiliency} onChange={(r) => onChange({ resiliency: r })} />
      </SmallField>
    </div>
  )
}

function vmScenarioTotals(s: VmScenario) {
  return {
    vCpus: Math.round((s.vmCount * s.vCpusPerVm) / s.vCpuOvercommitRatio),
    memoryGB: s.vmCount * s.memoryPerVmGB,
    storageTB: (s.vmCount * s.storagePerVmGB) / 1024,
  }
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function WorkloadPlanner() {
  const {
    avd, avdEnabled, setAvdEnabled,
    aks, setAks,
    infraVms, setInfraVms,
    devTestVms, setDevTestVms,
    backupArchive, setBackupArchive,
    customVms, setCustomVms,
    sofs, sofsEnabled, setSofsEnabled,
    advanced,
  } = useSurveyorStore()

  const avdResult = computeAvd(avd, advanced.overrides)
  const aksResult = computeAks(aks)
  const sofsResult = computeSofs(sofs, advanced.overrides)
  const infraTotals = vmScenarioTotals(infraVms)
  const devTestTotals = vmScenarioTotals(devTestVms)
  const customTotals = vmScenarioTotals(customVms)

  // Aggregate totals across all enabled scenarios
  let totalVCpus = 0
  let totalMemoryGB = 0
  let totalStorageTB = 0

  if (avdEnabled) {
    totalVCpus   += avdResult.totalVCpus
    totalMemoryGB += avdResult.totalMemoryGB
    totalStorageTB += avdResult.totalStorageTB
  }
  if (aks.enabled) {
    totalVCpus   += aksResult.totalVCpus
    totalMemoryGB += aksResult.totalMemoryGB
    totalStorageTB += aksResult.totalStorageTB
  }
  if (infraVms.enabled) {
    totalVCpus   += infraTotals.vCpus
    totalMemoryGB += infraTotals.memoryGB
    totalStorageTB += infraTotals.storageTB
  }
  if (devTestVms.enabled) {
    totalVCpus   += devTestTotals.vCpus
    totalMemoryGB += devTestTotals.memoryGB
    totalStorageTB += devTestTotals.storageTB
  }
  if (backupArchive.enabled) {
    totalStorageTB += backupArchive.storageTB
  }
  if (customVms.enabled) {
    totalVCpus   += customTotals.vCpus
    totalMemoryGB += customTotals.memoryGB
    totalStorageTB += customTotals.storageTB
  }
  if (sofsEnabled) {
    totalVCpus   += sofsResult.sofsVCpusTotal
    totalMemoryGB += sofsResult.sofsMemoryTotalGB
    totalStorageTB += sofsResult.totalStorageTB
  }

  return (
    <div className="space-y-4">

      {/* ── 1. AVD ── */}
      <ScenarioCard label="Azure Virtual Desktop (AVD)" badge="separate page" enabled={avdEnabled} onToggle={() => setAvdEnabled(!avdEnabled)}>
        <div className="text-sm text-gray-500">
          AVD is configured on the{' '}
          <Link to="/avd" className="text-brand-600 hover:underline">AVD Planning page</Link>.
          Enabling this includes its compute and storage in the totals below.
        </div>
        <SummaryRow label="Session hosts" value={String(avdResult.sessionHostCount)} />
        <SummaryRow label="vCPUs" value={String(avdResult.totalVCpus)} />
        <SummaryRow label="Memory" value={`${avdResult.totalMemoryGB} GB`} />
        <SummaryRow label="Storage" value={`${avdResult.totalStorageTB} TB`} />
      </ScenarioCard>

      {/* ── 2. AKS ── */}
      <ScenarioCard label="AKS on Azure Local" enabled={aks.enabled} onToggle={() => setAks({ enabled: !aks.enabled })}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SmallField label="Clusters">
            <input type="number" min={1} className="input w-full" value={aks.clusterCount}
              onChange={(e) => setAks({ clusterCount: +e.target.value })} />
          </SmallField>
          <SmallField label="Control plane nodes / cluster" hint="1=dev, 3=HA">
            <input type="number" min={1} max={3} className="input w-full" value={aks.controlPlaneNodesPerCluster}
              onChange={(e) => setAks({ controlPlaneNodesPerCluster: +e.target.value })} />
          </SmallField>
          <SmallField label="Worker nodes / cluster">
            <input type="number" min={1} className="input w-full" value={aks.workerNodesPerCluster}
              onChange={(e) => setAks({ workerNodesPerCluster: +e.target.value })} />
          </SmallField>
          <SmallField label="vCPUs / worker">
            <input type="number" min={1} className="input w-full" value={aks.vCpusPerWorker}
              onChange={(e) => setAks({ vCpusPerWorker: +e.target.value })} />
          </SmallField>
          <SmallField label="RAM / worker (GB)">
            <input type="number" min={1} className="input w-full" value={aks.memoryPerWorkerGB}
              onChange={(e) => setAks({ memoryPerWorkerGB: +e.target.value })} />
          </SmallField>
          <SmallField label="OS disk / node (GB)" hint="default 200">
            <input type="number" min={100} className="input w-full" value={aks.osDiskPerNodeGB}
              onChange={(e) => setAks({ osDiskPerNodeGB: +e.target.value })} />
          </SmallField>
          <SmallField label="Persistent volumes (TB)">
            <input type="number" min={0} step={0.1} className="input w-full" value={aks.persistentVolumesTB}
              onChange={(e) => setAks({ persistentVolumesTB: +e.target.value })} />
          </SmallField>
          <SmallField label="Data services (TB)" hint="Arc SQL, etc.">
            <input type="number" min={0} step={0.1} className="input w-full" value={aks.dataServicesTB}
              onChange={(e) => setAks({ dataServicesTB: +e.target.value })} />
          </SmallField>
          <SmallField label="Storage resiliency" className="col-span-2">
            <ResiliencySelect value={aks.resiliency} onChange={(r) => setAks({ resiliency: r })} />
          </SmallField>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 grid grid-cols-4 gap-2 text-xs text-gray-500">
          <span>Nodes: <strong className="text-gray-900 dark:text-white">{aksResult.totalNodes}</strong></span>
          <span>vCPUs: <strong className="text-gray-900 dark:text-white">{aksResult.totalVCpus}</strong></span>
          <span>RAM: <strong className="text-gray-900 dark:text-white">{aksResult.totalMemoryGB} GB</strong></span>
          <span>Storage: <strong className="text-gray-900 dark:text-white">{aksResult.totalStorageTB} TB</strong></span>
        </div>
      </ScenarioCard>

      {/* ── 3. Infrastructure VMs ── */}
      <ScenarioCard label="Infrastructure VMs" enabled={infraVms.enabled} onToggle={() => setInfraVms({ enabled: !infraVms.enabled })}>
        <VmFields value={infraVms} onChange={setInfraVms} />
        <ScenarioTotals vCpus={infraTotals.vCpus} memGB={infraTotals.memoryGB} storageTB={infraTotals.storageTB}
          rawVCpus={infraVms.vmCount * infraVms.vCpusPerVm} overcommit={infraVms.vCpuOvercommitRatio} />
      </ScenarioCard>

      {/* ── 4. Dev / Test VMs ── */}
      <ScenarioCard label="Dev / Test VMs" enabled={devTestVms.enabled} onToggle={() => setDevTestVms({ enabled: !devTestVms.enabled })}>
        <VmFields value={devTestVms} onChange={setDevTestVms} />
        <ScenarioTotals vCpus={devTestTotals.vCpus} memGB={devTestTotals.memoryGB} storageTB={devTestTotals.storageTB}
          rawVCpus={devTestVms.vmCount * devTestVms.vCpusPerVm} overcommit={devTestVms.vCpuOvercommitRatio} />
      </ScenarioCard>

      {/* ── 5. Backup / Archive ── */}
      <ScenarioCard label="Backup / Archive" enabled={backupArchive.enabled} onToggle={() => setBackupArchive({ enabled: !backupArchive.enabled })}>
        <div className="grid grid-cols-2 gap-3">
          <SmallField label="Storage (TB)">
            <input type="number" min={0.1} step={0.1} className="input w-full" value={backupArchive.storageTB}
              onChange={(e) => setBackupArchive({ storageTB: +e.target.value })} />
          </SmallField>
          <SmallField label="Resiliency">
            <ResiliencySelect value={backupArchive.resiliency} onChange={(r) => setBackupArchive({ resiliency: r })} />
          </SmallField>
        </div>
        <ScenarioTotals storageTB={backupArchive.storageTB} />
      </ScenarioCard>

      {/* ── 6. Custom VMs ── */}
      <ScenarioCard label="Custom VMs" enabled={customVms.enabled} onToggle={() => setCustomVms({ enabled: !customVms.enabled })}>
        <VmFields value={customVms} onChange={setCustomVms} />
        <ScenarioTotals vCpus={customTotals.vCpus} memGB={customTotals.memoryGB} storageTB={customTotals.storageTB}
          rawVCpus={customVms.vmCount * customVms.vCpusPerVm} overcommit={customVms.vCpuOvercommitRatio} />
      </ScenarioCard>

      {/* ── 7. SOFS ── */}
      <ScenarioCard label="Scale-Out File Server (SOFS)" badge="separate page" enabled={sofsEnabled} onToggle={() => setSofsEnabled(!sofsEnabled)}>
        <div className="text-sm text-gray-500">
          SOFS is configured on the{' '}
          <Link to="/sofs" className="text-brand-600 hover:underline">SOFS Planning page</Link>.
          Enabling this includes its compute and storage in the totals below.
        </div>
        <SummaryRow label="Profile + redirected storage" value={`${sofsResult.totalStorageTB} TB`} />
        <SummaryRow label="SOFS vCPUs" value={String(sofsResult.sofsVCpusTotal)} />
        <SummaryRow label="SOFS memory" value={`${sofsResult.sofsMemoryTotalGB} GB`} />
      </ScenarioCard>

      {/* ── Totals ── */}
      <div className="rounded-lg border-2 border-brand-300 dark:border-brand-700 overflow-hidden">
        <div className="bg-brand-50 dark:bg-brand-900/30 px-4 py-3 text-sm font-semibold">Workload Totals (enabled scenarios)</div>
        <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700">
          <TotalCell label="Total vCPUs" value={String(Math.round(totalVCpus))} />
          <TotalCell label="Total Memory" value={`${Math.round(totalMemoryGB)} GB`} />
          <TotalCell label="Total Storage" value={`${totalStorageTB.toFixed(2)} TB`} />
        </div>
      </div>
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function SmallField({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium mb-1">
        {label}
        {hint && <span className="ml-1 text-xs text-gray-400">({hint})</span>}
      </label>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function ScenarioTotals({ vCpus = 0, memGB = 0, storageTB, rawVCpus, overcommit }: {
  vCpus?: number; memGB?: number; storageTB: number; rawVCpus?: number; overcommit?: number
}) {
  return (
    <div className="mt-1 pt-2 border-t border-gray-100 dark:border-gray-700 flex gap-4 text-xs text-gray-500">
      {vCpus > 0 && (
        <span>
          Effective vCPUs: <strong className="text-gray-900 dark:text-white">{vCpus}</strong>
          {rawVCpus && overcommit && overcommit > 1 && (
            <span className="ml-1 text-gray-400">({rawVCpus} raw ÷ {overcommit})</span>
          )}
        </span>
      )}
      {memGB > 0 && <span>RAM: <strong className="text-gray-900 dark:text-white">{memGB} GB</strong></span>}
      <span>Storage: <strong className="text-gray-900 dark:text-white">{storageTB.toFixed(2)} TB</strong></span>
    </div>
  )
}

function TotalCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  )
}
