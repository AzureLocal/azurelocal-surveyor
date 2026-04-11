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
import { runHealthCheck } from '../engine/healthcheck'
import CapacityReport from './CapacityReport'
import ComputeReport from './ComputeReport'
import HealthCheck from './HealthCheck'
import { exportPdf } from '../exporters/pdf'
import { exportXlsx } from '../exporters/xlsx'
import { generatePowerShell } from '../exporters/powershell'
import { generateMarkdown } from '../exporters/markdown'
import { FileDown, Table2, Terminal, FileText } from 'lucide-react'

export default function FinalReport() {
  const state = useSurveyorStore()
  const capacity = computeCapacity(state.hardware, state.advanced)
  const volumeSummary = computeVolumeSummary(state.volumes, capacity)
  const compute = computeCompute(state.hardware, state.advanced)
  const avd = computeAvd(state.avd)
  const sofs = computeSofs(state.sofs)
  const aks = computeAks(state.aks)

  // Aggregate workload totals across all enabled scenarios — fixes #15
  // (previously used legacy WorkloadSpec[] which was always empty)
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
  if (state.infraVms.enabled) {
    totalVCpus    += state.infraVms.vmCount * state.infraVms.vCpusPerVm
    totalMemoryGB += state.infraVms.vmCount * state.infraVms.memoryPerVmGB
    totalStorageTB += (state.infraVms.vmCount * state.infraVms.storagePerVmGB) / 1024
  }
  if (state.devTestVms.enabled) {
    totalVCpus    += state.devTestVms.vmCount * state.devTestVms.vCpusPerVm
    totalMemoryGB += state.devTestVms.vmCount * state.devTestVms.memoryPerVmGB
    totalStorageTB += (state.devTestVms.vmCount * state.devTestVms.storagePerVmGB) / 1024
  }
  if (state.backupArchive.enabled) {
    totalStorageTB += state.backupArchive.storageTB
  }
  if (state.customVms.enabled) {
    totalVCpus    += state.customVms.vmCount * state.customVms.vCpusPerVm
    totalMemoryGB += state.customVms.vmCount * state.customVms.memoryPerVmGB
    totalStorageTB += (state.customVms.vmCount * state.customVms.storagePerVmGB) / 1024
  }
  // SOFS guest VMs consume compute from the main cluster — fixes #15
  if (state.sofsEnabled) {
    totalVCpus    += sofs.sofsVCpusTotal
    totalMemoryGB += sofs.sofsMemoryTotalGB
    totalStorageTB += sofs.totalStorageTB
  }

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

  const anyWorkloadEnabled = state.avdEnabled || state.aks.enabled || state.infraVms.enabled
    || state.devTestVms.enabled || state.backupArchive.enabled || state.customVms.enabled
    || state.sofsEnabled

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
        <CapacityReport result={capacity} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Compute</h2>
        <ComputeReport result={compute} />
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

      <section>
        <h2 className="text-lg font-semibold mb-3">Health Check</h2>
        <HealthCheck result={health} />
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
