/**
 * FinalReport — master output view with all sections rolled up.
 * Ports the "Final Report" sheet (238 formulas).
 * Also hosts the export buttons: PDF, XLSX, PowerShell, Markdown.
 */
import { useSurveyorStore } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { computeVolumeSummary } from '../engine/volumes'
import { computeCompute } from '../engine/compute'
import { computeAvd } from '../engine/avd'
import { computeSofs } from '../engine/sofs'
import { computeAks } from '../engine/aks'
import { computeMabs } from '../engine/mabs'
import { computeAllServicePresets } from '../engine/service-presets'
import { computeAllCustomWorkloads } from './CustomWorkloads'
import { runHealthCheck } from '../engine/healthcheck'
import CapacityReport from './CapacityReport'
import ComputeReport from './ComputeReport'
import HealthCheck from './HealthCheck'
import { exportPdf } from '../exporters/pdf'
import { exportXlsx } from '../exporters/xlsx'
import { generatePowerShell } from '../exporters/powershell'
import { generateMarkdown } from '../exporters/markdown'
import { FileDown, Table2, Terminal, FileText, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { HardwareInputs, CapacityResult, ComputeResult, VolumeSpec, WorkloadSummaryResult } from '../engine/types'

export default function FinalReport() {
  const state = useSurveyorStore()
  const capacity = computeCapacity(state.hardware, state.advanced)
  const volumeSummary = computeVolumeSummary(state.volumes, capacity)
  const compute = computeCompute(state.hardware, state.advanced)
  const avd = computeAvd(state.avd, state.advanced.overrides)
  const sofs = computeSofs(state.sofs, state.advanced.overrides)
  const aks = computeAks(state.aks)
  const mabsResult = computeMabs(state.mabs)

  // Aggregate workload totals across all enabled scenarios — fixes #15
  let totalVCpus = 0
  let totalMemoryGB = 0
  let totalStorageTB = 0

  if (state.avdEnabled) {
    totalVCpus    += avd.totalVCpus
    totalMemoryGB += avd.totalMemoryGB
    totalStorageTB += avd.totalStorageTB
  }
  if (state.aks.enabled) {
    totalVCpus    += aks.totalVCpus
    totalMemoryGB += aks.totalMemoryGB
    totalStorageTB += aks.totalStorageTB
  }
  if (state.virtualMachines?.enabled) {
    const vm = state.virtualMachines
    totalVCpus    += (vm.vmCount * vm.vCpusPerVm) / vm.vCpuOvercommitRatio
    totalMemoryGB += vm.vmCount * vm.memoryPerVmGB
    totalStorageTB += (vm.vmCount * vm.storagePerVmGB) / 1024
  }
  if (state.sofsEnabled) {
    totalVCpus    += sofs.sofsVCpusTotal
    totalMemoryGB += sofs.sofsMemoryTotalGB
    totalStorageTB += sofs.totalStorageTB
  }
  if (state.mabsEnabled) {
    totalVCpus    += mabsResult.mabsVCpus
    totalMemoryGB += mabsResult.mabsMemoryGB
    totalStorageTB += mabsResult.totalStorageTB + mabsResult.mabsOsDiskTB
  }
  const presetTotals = computeAllServicePresets(state.servicePresets)
  totalVCpus    += presetTotals.totalVCpus
  totalMemoryGB += presetTotals.totalMemoryGB
  totalStorageTB += presetTotals.totalStorageTB
  const customTotals = computeAllCustomWorkloads(state.customWorkloads)
  totalVCpus    += customTotals.totalVCpus
  totalMemoryGB += customTotals.totalMemoryGB
  totalStorageTB += customTotals.totalStorageTB

  const workloadSummary = {
    totalVCpus: Math.round(totalVCpus),
    totalMemoryGB: Math.round(totalMemoryGB),
    totalStorageTB: Math.round(totalStorageTB * 100) / 100,
  }

  const health = runHealthCheck({
    hardware: state.hardware,
    settings: state.advanced,
    volumes: state.volumes,
    capacity,
    compute,
    workloadSummary,
  })

  const anyWorkloadEnabled = state.avdEnabled || state.aks.enabled
    || state.virtualMachines?.enabled || state.sofsEnabled || state.mabsEnabled
    || presetTotals.totalVCpus > 0 || customTotals.totalVCpus > 0

  function copyPowerShell() {
    navigator.clipboard.writeText(generatePowerShell(state))
  }
  function copyMarkdown() {
    navigator.clipboard.writeText(generateMarkdown(state))
  }

  return (
    <div className="space-y-8">
      {/* Export bar */}
      <div className="flex flex-wrap gap-2 no-print">
        <ExportBtn icon={<FileDown className="w-4 h-4" />} label="Export PDF" onClick={() => exportPdf(state)} />
        <ExportBtn icon={<Table2 className="w-4 h-4" />} label="Export XLSX" onClick={() => exportXlsx(state)} />
        <ExportBtn icon={<Terminal className="w-4 h-4" />} label="Copy PowerShell" onClick={copyPowerShell} />
        <ExportBtn icon={<FileText className="w-4 h-4" />} label="Copy Markdown" onClick={copyMarkdown} />
      </div>

      {/* Cluster summary */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Cluster Hardware</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden text-sm">
          <Stat label="Nodes" value={String(state.hardware.nodeCount)} />
          <Stat label="Raw pool" value={`${capacity.rawPoolTB} TB`} />
          <Stat label="Effective usable" value={`${capacity.effectiveUsableTB} TB`} />
          <Stat label="Utilization" value={`${volumeSummary.utilizationPct}%`} />
        </dl>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Capacity</h2>
        <CapacityReport result={capacity} volumesUsedTB={volumeSummary.totalPlannedTB} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Compute</h2>
        <ComputeReport result={compute} totalVCpus={workloadSummary.totalVCpus} totalMemoryGB={workloadSummary.totalMemoryGB} />
      </section>

      {state.volumes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Volumes</h2>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Resiliency</th>
                  <th className="px-4 py-2 text-right">Calculator TB</th>
                  <th className="px-4 py-2 text-right">WAC GB</th>
                </tr>
              </thead>
              <tbody>
                {volumeSummary.volumes.map((v) => (
                  <tr key={v.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2">{v.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{v.resiliency}</td>
                    <td className="px-4 py-2 text-right">{v.calculatorSizeTB}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-brand-700 dark:text-brand-300">{v.wacSizeGB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {anyWorkloadEnabled && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Workloads</h2>
          <dl className="grid grid-cols-3 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden text-sm">
            <Stat label="Total vCPUs" value={String(workloadSummary.totalVCpus)} />
            <Stat label="Total memory" value={`${workloadSummary.totalMemoryGB} GB`} />
            <Stat label="Total storage" value={`${workloadSummary.totalStorageTB} TB`} />
          </dl>
        </section>
      )}

      {/* AVD section — only shown when enabled, fixes #12 */}
      {state.avdEnabled && (
        <section>
          <h2 className="text-lg font-semibold mb-3">AVD</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden text-sm">
            <Stat label="Session hosts" value={String(avd.sessionHostCount)} />
            <Stat label="Total vCPUs" value={String(avd.totalVCpus)} />
            <Stat label="Total RAM" value={`${avd.totalMemoryGB} GB`} />
            <Stat label="Total storage" value={`${avd.totalStorageTB} TB`} />
          </dl>
        </section>
      )}

      {/* SOFS section — only shown when enabled, fixes #12 */}
      {state.sofsEnabled && (
        <section>
          <h2 className="text-lg font-semibold mb-3">SOFS</h2>
          <dl className="grid grid-cols-3 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden text-sm">
            <Stat label="Profile storage" value={`${sofs.totalProfileStorageTB} TB`} />
            <Stat label="Redirected storage" value={`${sofs.totalRedirectedStorageTB} TB`} />
            <Stat label="Total storage" value={`${sofs.totalStorageTB} TB`} />
          </dl>
        </section>
      )}

      {/* Service presets section — only shown when at least one preset is enabled */}
      {presetTotals.totalVCpus > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Arc-Enabled Services</h2>
          <dl className="grid grid-cols-3 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden text-sm">
            <Stat label="Total vCPUs" value={String(presetTotals.totalVCpus)} />
            <Stat label="Total memory" value={`${presetTotals.totalMemoryGB} GB`} />
            <Stat label="Total storage" value={`${presetTotals.totalStorageTB} TB`} />
          </dl>
        </section>
      )}

      {/* Custom workloads section — only shown when at least one is enabled */}
      {customTotals.totalVCpus > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Custom Workloads</h2>
          <dl className="grid grid-cols-3 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden text-sm">
            <Stat label="Total vCPUs" value={String(customTotals.totalVCpus)} />
            <Stat label="Total memory" value={`${customTotals.totalMemoryGB} GB`} />
            <Stat label="Total storage" value={`${customTotals.totalStorageTB} TB`} />
          </dl>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Health Check</h2>
        <HealthCheck result={health} />
      </section>

      {/* Best Practice Notes — #51 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Best Practice Notes</h2>
        <BestPracticeNotes
          hardware={state.hardware}
          capacity={capacity}
          compute={compute}
          volumes={state.volumes}
          workloadSummary={workloadSummary}
        />
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 px-4 py-3">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-semibold mt-0.5">{value}</dd>
    </div>
  )
}

function ExportBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      {icon}{label}
    </button>
  )
}

// ─── Best Practice Notes (#51) ────────────────────────────────────────────────

type BPStatus = 'pass' | 'warn' | 'fail'

interface BPCheck {
  label: string
  status: BPStatus
  detail: string
}

function BestPracticeNotes({ hardware, capacity, compute, volumes, workloadSummary }: {
  hardware: HardwareInputs
  capacity: CapacityResult
  compute: ComputeResult
  volumes: VolumeSpec[]
  workloadSummary: WorkloadSummaryResult
}) {
  const totalVolumeTB = volumes.reduce((s, v) => s + v.plannedSizeTB, 0)
  const utilizationPct = capacity.effectiveUsableTB > 0
    ? (totalVolumeTB / capacity.effectiveUsableTB) * 100
    : 0

  const activeVolumeCount = volumes.filter((v) => v.plannedSizeTB > 0).length
  const volumesAreMultiple = activeVolumeCount === 0 || activeVolumeCount % hardware.nodeCount === 0

  // N+1: can remaining (nodeCount-1) nodes host the full workload?
  const vCpusPerNode = compute.usableVCpus / hardware.nodeCount
  const memPerNode = compute.usableMemoryGB / hardware.nodeCount
  const vCpusWithoutOneNode = compute.usableVCpus - vCpusPerNode
  const memWithoutOneNode = compute.usableMemoryGB - memPerNode
  const nPlusOneCapable = workloadSummary.totalVCpus <= vCpusWithoutOneNode
    && workloadSummary.totalMemoryGB <= memWithoutOneNode

  const hasOsVolume = volumes.some((v) =>
    v.name.toLowerCase().includes('os') ||
    v.name.toLowerCase().includes('system') ||
    v.name.toLowerCase().includes('infra')
  )
  const osVolumesMirrored = volumes
    .filter((v) => v.name.toLowerCase().includes('os') || v.name.toLowerCase().includes('system') || v.name.toLowerCase().includes('infra'))
    .every((v) => v.resiliency === 'three-way-mirror' || v.resiliency === 'two-way-mirror')

  const hasThinVolumes = hardware.volumeProvisioning === 'thin'

  const checks: BPCheck[] = [
    {
      label: 'Pool utilization below 70%',
      status: utilizationPct === 0 ? 'pass' : utilizationPct <= 70 ? 'pass' : utilizationPct <= 85 ? 'warn' : 'fail',
      detail: utilizationPct === 0
        ? 'No volumes planned yet.'
        : `Current utilization: ${utilizationPct.toFixed(1)}%. S2D needs at least 30% free space to auto-repair after a drive failure.`,
    },
    {
      label: 'Volume count is a multiple of node count',
      status: volumesAreMultiple ? 'pass' : 'warn',
      detail: volumesAreMultiple
        ? `${activeVolumeCount} volumes on ${hardware.nodeCount} nodes — balanced slab distribution.`
        : `${activeVolumeCount} volumes is not a multiple of ${hardware.nodeCount}. Slab distribution may be uneven across nodes.`,
    },
    {
      label: 'N+1 failover compute headroom',
      status: workloadSummary.totalVCpus === 0
        ? 'pass'
        : nPlusOneCapable ? 'pass' : 'warn',
      detail: workloadSummary.totalVCpus === 0
        ? 'No workloads planned.'
        : nPlusOneCapable
          ? `All workloads fit on ${hardware.nodeCount - 1} nodes (${Math.round(vCpusWithoutOneNode)} vCPUs, ${Math.round(memWithoutOneNode)} GB RAM available).`
          : `Workloads require ${workloadSummary.totalVCpus} vCPUs / ${workloadSummary.totalMemoryGB} GB RAM but only ${Math.round(vCpusWithoutOneNode)} vCPUs / ${Math.round(memWithoutOneNode)} GB RAM available with one node down.`,
    },
    {
      label: 'OS/infrastructure volumes use mirror resiliency',
      status: !hasOsVolume ? 'pass' : osVolumesMirrored ? 'pass' : 'warn',
      detail: !hasOsVolume
        ? 'No OS/system volumes detected. Ensure infrastructure volumes use Two-Way or Three-Way Mirror for VM availability during disk failures.'
        : osVolumesMirrored
          ? 'OS/system volumes are using mirror resiliency.'
          : 'One or more OS/system volumes use parity resiliency. Mirror is strongly recommended for OS workloads due to write latency.',
    },
    {
      label: 'Thin provisioning not used for production workloads',
      status: hasThinVolumes ? 'warn' : 'pass',
      detail: hasThinVolumes
        ? 'Thin provisioning is enabled. If logical volume sizes exceed pool capacity, VMs crash without warning. Monitor pool space continuously in production.'
        : 'Thick provisioning in use — each volume reserves its full pool footprint. Safer for production.',
    },
  ]

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-semibold">Deployment Best Practices</div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 shrink-0">
              {c.status === 'pass' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              {c.status === 'warn' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
              {c.status === 'fail' && <XCircle className="w-4 h-4 text-red-500" />}
            </span>
            <div>
              <div className="text-sm font-medium">{c.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{c.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
