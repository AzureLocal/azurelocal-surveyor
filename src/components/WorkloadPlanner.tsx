/**
 * WorkloadPlanner — enable/disable workload scenarios for capacity planning.
 *
 * Scenarios:
 *   1. AVD (Azure Virtual Desktop) — configured on the AVD page
 *   2. AKS on Azure Local
 *   3. Virtual Machines — general purpose VMs (consolidated)
 *   4. SOFS (Scale-Out File Server) — configured on the SOFS page
 *   5. MABS (Microsoft Azure Backup Server) — configured on the MABS page
 */
import { Link } from 'react-router-dom'
import { useSurveyorStore } from '../state/store'
import { computeAvd } from '../engine/avd'
import { computeAks } from '../engine/aks'
import { computeSofs } from '../engine/sofs'
import { computeMabs } from '../engine/mabs'
import { computeAllCustomWorkloads } from '../engine/custom-workloads'
import { computeAllServicePresets, getCatalogEntry } from '../engine/service-presets'
import ServicePresets from './ServicePresets'
import CustomWorkloads from './CustomWorkloads'
import type { ResiliencyType, VmScenario } from '../engine/types'

/** Parse numeric input — returns current value if input is empty or NaN. */
function num(e: React.ChangeEvent<HTMLInputElement>, current: number): number {
  const v = e.target.value
  if (v === '' || v === '-') return current
  const n = +v
  return isNaN(n) ? current : n
}

// ─── Scenario card wrapper ────────────────────────────────────────────────────

function ScenarioCard({
  label,
  subtitle,
  badge,
  enabled,
  onToggle,
  children,
}: {
  label: string
  subtitle?: string
  badge?: string
  enabled: boolean
  onToggle: () => void
  children?: React.ReactNode
}) {
  return (
    <div className={`rounded-lg border ${enabled ? 'border-brand-400 dark:border-brand-600' : 'border-gray-200 dark:border-gray-700'} overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <div>
            <span className="text-sm font-semibold">{label}</span>
            {subtitle && <span className="block text-xs font-normal text-gray-400 dark:text-gray-500 leading-none mt-0.5">{subtitle}</span>}
          </div>
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

// ─── VM scenario fields ─────────────────────────────────────────────────────

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
          onChange={(e) => onChange({ vmCount: num(e, value.vmCount) })} />
      </SmallField>
      <SmallField label="vCPUs / VM">
        <input type="number" min={1} className="input w-full" value={value.vCpusPerVm}
          onChange={(e) => onChange({ vCpusPerVm: num(e, value.vCpusPerVm) })} />
      </SmallField>
      <SmallField label="RAM / VM (GB)">
        <input type="number" min={1} className="input w-full" value={value.memoryPerVmGB}
          onChange={(e) => onChange({ memoryPerVmGB: num(e, value.memoryPerVmGB) })} />
      </SmallField>
      <SmallField label="Storage / VM (GB)">
        <input type="number" min={1} className="input w-full" value={value.storagePerVmGB}
          onChange={(e) => onChange({ storagePerVmGB: num(e, value.storagePerVmGB) })} />
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
      <SmallField label="Workload volume resiliency" hint="applies to VM storage volumes">
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
    virtualMachines, setVirtualMachines,
    sofs, sofsEnabled, setSofsEnabled,
    mabs, mabsEnabled, setMabsEnabled,
    servicePresets,
    customWorkloads,
    advanced,
  } = useSurveyorStore()

  const avdResult = computeAvd(avd, advanced.overrides)
  const aksResult = computeAks(aks)
  const sofsResult = computeSofs(sofs, advanced.overrides)
  const mabsResult = computeMabs(mabs)
  const vmTotals = vmScenarioTotals(virtualMachines)
  const presetTotals = computeAllServicePresets(servicePresets)
  const customTotals = computeAllCustomWorkloads(customWorkloads)

  // True when any enabled service preset requires AKS
  const aksDependentPresetsEnabled = servicePresets.some(
    (p) => p.enabled && (getCatalogEntry(p.catalogId)?.requiresAks ?? false)
  )

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
  if (virtualMachines.enabled) {
    totalVCpus   += vmTotals.vCpus
    totalMemoryGB += vmTotals.memoryGB
    totalStorageTB += vmTotals.storageTB
  }
  if (sofsEnabled) {
    totalVCpus   += sofsResult.sofsVCpusTotal
    totalMemoryGB += sofsResult.sofsMemoryTotalGB
    totalStorageTB += sofsResult.totalStorageTB
  }
  if (mabsEnabled) {
    totalVCpus   += mabsResult.mabsVCpus
    totalMemoryGB += mabsResult.mabsMemoryGB
    totalStorageTB += mabsResult.totalStorageTB + mabsResult.mabsOsDiskTB
  }
  // Service presets: always aggregate enabled instances (no top-level toggle)
  totalVCpus    += presetTotals.totalVCpus
  totalMemoryGB += presetTotals.totalMemoryGB
  totalStorageTB += presetTotals.totalStorageTB
  // Custom workloads: always aggregate enabled instances
  totalVCpus    += customTotals.totalVCpus
  totalMemoryGB += customTotals.totalMemoryGB
  totalStorageTB += customTotals.totalStorageTB

  return (
    <div className="space-y-4">

      {/* ── 1. Virtual Machines ── */}
      <ScenarioCard label="Virtual Machines" subtitle="Workload VMs, dev/test, infra" enabled={virtualMachines.enabled} onToggle={() => setVirtualMachines({ enabled: !virtualMachines.enabled })}>
        <VmFields value={virtualMachines} onChange={setVirtualMachines} />
        <ScenarioTotals vCpus={vmTotals.vCpus} memGB={vmTotals.memoryGB} storageTB={vmTotals.storageTB}
          rawVCpus={virtualMachines.vmCount * virtualMachines.vCpusPerVm} overcommit={virtualMachines.vCpuOvercommitRatio} />
      </ScenarioCard>

      {/* ── 2. AVD ── */}
      <ScenarioCard label="Azure Virtual Desktop (AVD)" subtitle="Azure Virtual Desktop" badge="separate page" enabled={avdEnabled} onToggle={() => setAvdEnabled(!avdEnabled)}>
        <div className="text-sm text-gray-500">
          AVD is configured on the{' '}
          <Link to="/avd" className="text-brand-600 hover:underline">AVD Planning page</Link>.
          Enabling this includes its compute and storage in the totals below.
        </div>
        <SummaryRow label="Session hosts" value={String(avdResult.sessionHostCount)} />
        <SummaryRow label="vCPUs" value={String(avdResult.totalVCpus)} />
        <SummaryRow label="Memory" value={`${avdResult.totalMemoryGB} GB`} />
        <SummaryRow label="Storage" value={`${avdResult.totalStorageTB} TB`} />
        <p className="text-xs text-gray-400 mt-1">
          Volume resiliency: OS disks use Three-Way Mirror. Profile and data volumes follow the default resiliency in Advanced Settings.
        </p>
      </ScenarioCard>

      {/* ── 3. AKS ── */}
      <ScenarioCard label="AKS on Azure Local" subtitle="Kubernetes" enabled={aks.enabled} onToggle={() => {
        if (aks.enabled && aksDependentPresetsEnabled) {
          if (!window.confirm('One or more Arc-enabled services (SQL MI, IoT Operations, etc.) require AKS. Disabling AKS will leave those presets without a runtime. Disable anyway?')) return
        }
        setAks({ enabled: !aks.enabled })
      }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SmallField label="Clusters">
            <input type="number" min={1} className="input w-full" value={aks.clusterCount}
              onChange={(e) => setAks({ clusterCount: num(e, aks.clusterCount) })} />
          </SmallField>
          <SmallField label="Control plane nodes / cluster" hint="1=dev, 3=HA">
            <input type="number" min={1} max={3} className="input w-full" value={aks.controlPlaneNodesPerCluster}
              onChange={(e) => setAks({ controlPlaneNodesPerCluster: num(e, aks.controlPlaneNodesPerCluster) })} />
          </SmallField>
          <SmallField label="Worker nodes / cluster">
            <input type="number" min={1} className="input w-full" value={aks.workerNodesPerCluster}
              onChange={(e) => setAks({ workerNodesPerCluster: num(e, aks.workerNodesPerCluster) })} />
          </SmallField>
          <SmallField label="vCPUs / worker">
            <input type="number" min={1} className="input w-full" value={aks.vCpusPerWorker}
              onChange={(e) => setAks({ vCpusPerWorker: num(e, aks.vCpusPerWorker) })} />
          </SmallField>
          <SmallField label="RAM / worker (GB)">
            <input type="number" min={1} className="input w-full" value={aks.memoryPerWorkerGB}
              onChange={(e) => setAks({ memoryPerWorkerGB: num(e, aks.memoryPerWorkerGB) })} />
          </SmallField>
          <SmallField label="OS disk / node (GB)" hint="default 200">
            <input type="number" min={100} className="input w-full" value={aks.osDiskPerNodeGB}
              onChange={(e) => setAks({ osDiskPerNodeGB: num(e, aks.osDiskPerNodeGB) })} />
          </SmallField>
          <SmallField label="Persistent volumes (TB)">
            <input type="number" min={0} step={0.1} className="input w-full" value={aks.persistentVolumesTB}
              onChange={(e) => setAks({ persistentVolumesTB: num(e, aks.persistentVolumesTB) })} />
          </SmallField>
          <SmallField label="Data services (TB)" hint="Arc SQL, etc.">
            <input type="number" min={0} step={0.1} className="input w-full" value={aks.dataServicesTB}
              onChange={(e) => setAks({ dataServicesTB: num(e, aks.dataServicesTB) })} />
          </SmallField>
          <SmallField label="Workload volume resiliency" hint="applies to persistent volumes and data services" className="col-span-2">
            <ResiliencySelect value={aks.resiliency} onChange={(r) => setAks({ resiliency: r })} />
            <p className="text-xs text-gray-400 mt-1">AKS node OS disks are always Three-Way Mirror regardless of this setting.</p>
          </SmallField>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 grid grid-cols-4 gap-2 text-xs text-gray-500">
          <span>Nodes: <strong className="text-gray-900 dark:text-white">{aksResult.totalNodes}</strong></span>
          <span>vCPUs: <strong className="text-gray-900 dark:text-white">{aksResult.totalVCpus}</strong></span>
          <span>RAM: <strong className="text-gray-900 dark:text-white">{aksResult.totalMemoryGB} GB</strong></span>
          <span>Storage: <strong className="text-gray-900 dark:text-white">{aksResult.totalStorageTB} TB</strong></span>
        </div>
      </ScenarioCard>

      {/* ── 4. SOFS ── */}
      <ScenarioCard label="Scale-Out File Server (SOFS)" subtitle="Scale-Out File Server" badge="separate page" enabled={sofsEnabled} onToggle={() => setSofsEnabled(!sofsEnabled)}>
        <div className="text-sm text-gray-500">
          SOFS is configured on the{' '}
          <Link to="/sofs" className="text-brand-600 hover:underline">SOFS Planning page</Link>.
          Enabling this includes its compute and storage in the totals below.
        </div>
        <SummaryRow label="Profile + redirected storage" value={`${sofsResult.totalStorageTB} TB`} />
        <SummaryRow label="SOFS vCPUs" value={String(sofsResult.sofsVCpusTotal)} />
        <SummaryRow label="SOFS memory" value={`${sofsResult.sofsMemoryTotalGB} GB`} />
      </ScenarioCard>

      {/* ── 5. MABS ── */}
      <ScenarioCard label="Azure Backup Server (MABS)" subtitle="Azure Backup Server" badge="separate page" enabled={mabsEnabled} onToggle={() => setMabsEnabled(!mabsEnabled)}>
        <div className="text-sm text-gray-500">
          MABS is configured on the{' '}
          <Link to="/mabs" className="text-brand-600 hover:underline">MABS Planning page</Link>.
          Enabling this includes the MABS VM compute and backup storage in the totals below.
        </div>
        <SummaryRow label="Protected data" value={`${mabs.protectedDataTB} TB`} />
        <SummaryRow label="On-prem backup storage" value={`${mabsResult.totalStorageTB} TB`} />
        <SummaryRow label="MABS VM vCPUs" value={String(mabsResult.mabsVCpus)} />
        <SummaryRow label="MABS VM memory" value={`${mabsResult.mabsMemoryGB} GB`} />
      </ScenarioCard>

      {/* ── 6. Service Presets ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Arc-Enabled Services</span>
            {servicePresets.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300">
                {servicePresets.filter((p) => p.enabled).length} enabled
              </span>
            )}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          {aksDependentPresetsEnabled && !aks.enabled && (
            <div className="mb-3 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 flex items-start justify-between gap-3">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>AKS required:</strong> one or more enabled Arc-enabled services (SQL MI, IoT Operations, etc.) run on AKS on Azure Local. Enable AKS to include the runtime infrastructure in your plan.
              </p>
              <button
                onClick={() => setAks({ enabled: true })}
                className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-600 hover:bg-amber-700 text-white transition-colors"
              >
                Enable AKS
              </button>
            </div>
          )}
          <p className="text-xs text-gray-500 mb-3">
            Pre-built resource templates for Arc-enabled services (SQL MI, IoT Operations, AI Foundry Local, Container Apps).
            Each enabled instance is included in the workload totals.
          </p>
          <ServicePresets />
        </div>
      </div>

      {/* ── 7. Custom Workloads ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Custom Workloads</span>
            {customWorkloads.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300">
                {customWorkloads.filter((w) => w.enabled).length} enabled
              </span>
            )}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 mb-3">
            Manually define any workload not covered by the built-in scenarios. Supports internal mirror compounding.
            Import from JSON or download a template to get started.
          </p>
          <CustomWorkloads />
        </div>
      </div>

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
