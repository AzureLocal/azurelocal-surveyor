/**
 * PDF exporter — jsPDF + jsPDF-autotable (#18: richer PDF export).
 * Branded header, per-section page breaks, utilization bars, health check summary.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { SurveyorState } from '../state/store'
import { computeCapacity, round2 } from '../engine/capacity'
import { computeVolumeSummary } from '../engine/volumes'
import { computeCompute } from '../engine/compute'
import { computeAvd } from '../engine/avd'
import { computeSofs } from '../engine/sofs'
import { computeAks } from '../engine/aks'
import { computeMabs } from '../engine/mabs'
import { runHealthCheck } from '../engine/healthcheck'

type Doc = jsPDF & { lastAutoTable: { finalY: number } }

// Brand colors (Azure Local / Microsoft Azure blue)
const BRAND_NAVY: [number, number, number] = [15, 48, 87]    // #0F3057
const BRAND_BLUE: [number, number, number] = [0, 120, 212]   // #0078d4
const BRAND_LIGHT: [number, number, number] = [229, 239, 252] // soft blue bg

function section(doc: Doc, title: string, y: number): number {
  // Section header bar
  doc.setFillColor(...BRAND_NAVY)
  doc.rect(14, y, doc.internal.pageSize.getWidth() - 28, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text(title.toUpperCase(), 17, y + 4.8)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  return y + 10
}

function utilizationBar(
  doc: Doc,
  label: string,
  used: number,
  total: number,
  unit: string,
  x: number,
  y: number,
  width: number,
): number {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  const over = used > total
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(label, x, y)
  doc.setFont('helvetica', 'normal')
  const labelW = 55
  const barX = x + labelW
  const barW = width - labelW - 35
  const barH = 4

  // Bar background
  doc.setFillColor(220, 220, 220)
  doc.roundedRect(barX, y - 3, barW, barH, 1, 1, 'F')

  // Bar fill
  if (over) {
    doc.setFillColor(220, 53, 69) // red
  } else if (pct > 90) {
    doc.setFillColor(255, 153, 0) // amber
  } else {
    doc.setFillColor(...BRAND_BLUE)
  }
  doc.roundedRect(barX, y - 3, barW * (pct / 100), barH, 1, 1, 'F')

  // Label
  doc.setFontSize(8)
  doc.text(
    `${Math.round(used).toLocaleString()} / ${Math.round(total).toLocaleString()} ${unit} (${pct.toFixed(1)}%)`,
    barX + barW + 4,
    y,
  )

  return y + 7
}

export function exportPdf(state: Pick<SurveyorState, 'hardware' | 'advanced' | 'volumes' | 'workloads' | 'avd' | 'sofs' | 'aks' | 'virtualMachines' | 'mabs' | 'avdEnabled' | 'sofsEnabled' | 'mabsEnabled'>): void {
  const capacity = computeCapacity(state.hardware, state.advanced)
  const volumeSummary = computeVolumeSummary(state.volumes, capacity)
  const compute = computeCompute(state.hardware, state.advanced)
  const avd = computeAvd(state.avd, state.advanced.overrides)
  const sofs = computeSofs(state.sofs, state.advanced.overrides)
  const aks = computeAks(state.aks)
  const mabsResult = computeMabs(state.mabs)
  const workloadSummary = {
    totalVCpus: 0,
    totalMemoryGB: 0,
    totalStorageTB: 0,
  }
  if (state.avdEnabled) { workloadSummary.totalVCpus += avd.totalVCpus; workloadSummary.totalMemoryGB += avd.totalMemoryGB; workloadSummary.totalStorageTB += avd.totalStorageTB }
  if (state.aks.enabled) { workloadSummary.totalVCpus += aks.totalVCpus; workloadSummary.totalMemoryGB += aks.totalMemoryGB; workloadSummary.totalStorageTB += aks.totalStorageTB }
  if (state.virtualMachines?.enabled) {
    const vm = state.virtualMachines
    let rawVCpus = 0
    for (const group of vm.groups) {
      rawVCpus += group.vmCount * group.vCpusPerVm
      workloadSummary.totalMemoryGB += group.vmCount * group.memoryPerVmGB
      workloadSummary.totalStorageTB += (group.vmCount * group.storagePerVmGB) / 1024
    }
    workloadSummary.totalVCpus += rawVCpus / vm.vCpuOvercommitRatio
  }
  if (state.sofsEnabled) { workloadSummary.totalVCpus += sofs.sofsVCpusTotal; workloadSummary.totalMemoryGB += sofs.sofsMemoryTotalGB; workloadSummary.totalStorageTB += sofs.totalStorageTB }
  if (state.mabsEnabled) { workloadSummary.totalVCpus += mabsResult.mabsVCpus; workloadSummary.totalMemoryGB += mabsResult.mabsMemoryGB; workloadSummary.totalStorageTB += mabsResult.totalStorageTB + mabsResult.mabsOsDiskTB }

  const health = runHealthCheck({
    hardware: state.hardware,
    settings: state.advanced,
    volumes: state.volumes,
    capacity,
    compute,
    workloadSummary,
  })

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as Doc
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14

  // ── Cover / Header ────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND_NAVY)
  doc.rect(0, 0, pageW, 38, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text('Azure Local Surveyor', margin, 15)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Cluster Capacity Planning Report', margin, 23)
  doc.setFontSize(9)
  doc.setTextColor(180, 210, 240)
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, 31)
  doc.setTextColor(0, 0, 0)

  let y = 46

  // ── Cluster Summary Stats ─────────────────────────────────────────────────
  const stats = [
    { label: 'Nodes', value: String(state.hardware.nodeCount) },
    { label: 'Raw Pool', value: `${capacity.rawPoolTB} TB` },
    { label: 'Effective Usable', value: `${round2(capacity.effectiveUsableTB)} TB` },
    { label: 'vCPUs Available', value: String(compute.usableVCpus) },
    { label: 'Memory Available', value: `${compute.usableMemoryGB} GB` },
    { label: 'Health', value: health.passed ? 'PASSED' : 'FAILED' },
  ]
  const statW = (pageW - margin * 2) / stats.length
  stats.forEach(({ label, value }, i) => {
    const sx = margin + i * statW
    doc.setFillColor(...BRAND_LIGHT)
    doc.roundedRect(sx, y, statW - 2, 14, 1, 1, 'F')
    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    doc.text(label.toUpperCase(), sx + 3, y + 4.5)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    if (label === 'Health') {
      doc.setTextColor(health.passed ? 34 : 220, health.passed ? 160 : 53, health.passed ? 34 : 69)
    } else {
      doc.setTextColor(...BRAND_NAVY)
    }
    doc.text(value, sx + 3, y + 11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
  })
  y += 20

  // ── Hardware ──────────────────────────────────────────────────────────────
  y = section(doc, 'Hardware Inputs', y)
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Parameter', 'Value']],
    body: [
      ['Nodes', String(state.hardware.nodeCount)],
      ['Capacity drives/node', `${state.hardware.capacityDrivesPerNode} × ${state.hardware.capacityDriveSizeTB} TB (${state.hardware.capacityMediaType.toUpperCase()})`],
      ['Cache drives/node', state.hardware.cacheDrivesPerNode > 0 ? `${state.hardware.cacheDrivesPerNode} × ${state.hardware.cacheDriveSizeTB} TB (${state.hardware.cacheMediaType.toUpperCase()})` : 'None (all-flash)'],
      ['CPU per node', `${state.hardware.coresPerNode} cores${state.hardware.hyperthreadingEnabled ? ' (HT enabled)' : ''}`],
      ['RAM per node', `${state.hardware.memoryPerNodeGB} GB`],
    ],
    theme: 'striped',
    headStyles: { fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontSize: 9 },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 248, 255] },
  })
  y = doc.lastAutoTable.finalY + 6

  // ── Capacity ──────────────────────────────────────────────────────────────
  y = section(doc, 'Capacity Report', y)
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Metric', 'Value', 'Notes']],
    body: [
      ['Raw pool', `${capacity.rawPoolTB} TB`, 'All capacity drives × drive size'],
      [`Reserve (${capacity.reserveDrives} drives)`, `${capacity.reserveTB} TB`, 'S2D rebuild reserve'],
      ['Infra volume', `${round2(capacity.infraVolumeTB)} TB`, 'System CSV pool footprint'],
      ['Available for volumes', `${round2(capacity.availableForVolumesTB)} TB`, 'Pool space for user volumes'],
      ['Available (TiB)', `${round2(capacity.availableForVolumesTiB)} TiB`, 'Windows Admin Center display'],
      ['Resiliency', capacity.resiliencyType, `${(capacity.resiliencyFactor * 100).toFixed(0)}% efficiency`],
      ['Effective usable', `${round2(capacity.effectiveUsableTB)} TB`, 'Size your workloads against this'],
    ],
    theme: 'striped',
    headStyles: { fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontSize: 9 },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 248, 255] },
  })
  y = doc.lastAutoTable.finalY + 4

  // Storage utilization bar
  if (volumeSummary.totalPlannedTB > 0 && capacity.effectiveUsableTB > 0) {
    y = utilizationBar(doc, 'Storage utilization:', volumeSummary.totalPlannedTB, capacity.effectiveUsableTB, 'TB', margin, y + 5, pageW - margin * 2)
  }
  y += 4

  // ── Compute ──────────────────────────────────────────────────────────────
  // Check if we need a new page
  if (y > pageH - 80) { doc.addPage(); y = 20 }
  y = section(doc, 'Compute Report', y)
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Metric', 'All Nodes', 'N+1 (one node down)']],
    body: [
      ['Physical cores', String(compute.physicalCores), '—'],
      ['Usable vCPUs', String(compute.usableVCpus), String(compute.usableVCpusN1)],
      ['Physical memory', `${compute.physicalMemoryGB} GB`, '—'],
      ['Usable memory', `${compute.usableMemoryGB} GB`, `${compute.usableMemoryGBN1} GB`],
    ],
    theme: 'striped',
    headStyles: { fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontSize: 9 },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 248, 255] },
  })
  y = doc.lastAutoTable.finalY + 4

  // Compute utilization bars
  if (workloadSummary.totalVCpus > 0) {
    y = utilizationBar(doc, 'vCPU utilization:', workloadSummary.totalVCpus, compute.usableVCpus, 'vCPUs', margin, y + 5, pageW - margin * 2)
    y = utilizationBar(doc, 'Memory utilization:', workloadSummary.totalMemoryGB, compute.usableMemoryGB, 'GB', margin, y + 2, pageW - margin * 2)
  }
  y += 4

  // ── Volumes ──────────────────────────────────────────────────────────────
  if (volumeSummary.volumes.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 20 }
    y = section(doc, 'Volume Detail', y)
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Name', 'Resiliency', 'Planned (TB)', 'WAC Size (GB)', 'WAC Size (TB)']],
      body: [
        ...volumeSummary.volumes.map((v) => [
          v.name, v.resiliency, String(v.calculatorSizeTB), String(v.wacSizeGB), String(v.wacSizeTB),
        ]),
        ['', 'TOTAL', String(round2(volumeSummary.totalPlannedTB)), '', ''],
        ['', 'Remaining', String(round2(volumeSummary.remainingUsableTB)), '', ''],
        ['', 'Utilization', `${round2(volumeSummary.utilizationPct)}%`, '', ''],
      ],
      theme: 'striped',
      headStyles: { fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontSize: 9 },
      styles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // ── Workloads ─────────────────────────────────────────────────────────────
  const enabledWorkloads: [string, string, string, string][] = []
  if (state.avdEnabled) enabledWorkloads.push(['AVD', String(avd.totalVCpus), `${avd.totalMemoryGB} GB`, `${round2(avd.totalStorageTB)} TB`])
  if (state.aks.enabled) enabledWorkloads.push(['AKS', String(aks.totalVCpus), `${aks.totalMemoryGB} GB`, `${round2(aks.totalStorageTB)} TB`])
  if (state.virtualMachines?.enabled) {
    const vm = state.virtualMachines
    const vmVCpus = Math.round(vm.groups.reduce((s, g) => s + g.vmCount * g.vCpusPerVm, 0) / vm.vCpuOvercommitRatio)
    const vmMemory = vm.groups.reduce((s, g) => s + g.vmCount * g.memoryPerVmGB, 0)
    const vmStorage = round2(vm.groups.reduce((s, g) => s + (g.vmCount * g.storagePerVmGB) / 1024, 0))
    enabledWorkloads.push(['Virtual Machines', String(vmVCpus), `${vmMemory} GB`, `${vmStorage} TB`])
  }
  if (state.sofsEnabled) enabledWorkloads.push(['SOFS', String(sofs.sofsVCpusTotal), `${sofs.sofsMemoryTotalGB} GB`, `${round2(sofs.totalStorageTB)} TB`])
  if (state.mabsEnabled) enabledWorkloads.push(['MABS', String(mabsResult.mabsVCpus), `${mabsResult.mabsMemoryGB} GB`, `${round2(mabsResult.totalStorageTB + mabsResult.mabsOsDiskTB)} TB`])

  if (enabledWorkloads.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 20 }
    y = section(doc, 'Workload Summary', y)
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Scenario', 'vCPUs', 'Memory', 'Storage']],
      body: enabledWorkloads,
      theme: 'striped',
      headStyles: { fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontSize: 9 },
      styles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      foot: [[
        'TOTAL',
        String(Math.round(workloadSummary.totalVCpus)),
        `${Math.round(workloadSummary.totalMemoryGB)} GB`,
        `${round2(workloadSummary.totalStorageTB)} TB`,
      ]],
      footStyles: { fillColor: BRAND_NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // ── SOFS Detail ──────────────────────────────────────────────────────────
  if (state.sofsEnabled) {
    if (y > pageH - 80) { doc.addPage(); y = 20 }
    y = section(doc, 'SOFS Solution Report', y)
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Parameter', 'Value']],
      body: [
        ['Total users', String(state.sofs.userCount)],
        ['FSLogix profile size / user', `${state.sofs.profileSizeGB} GB`],
        ['Redirected folder size / user', `${state.sofs.redirectedFolderSizeGB} GB`],
        ['Total logical storage', `${sofs.totalStorageTB} TB`],
        ['Guest cluster internal mirror', `${state.sofs.internalMirror} (${sofs.internalMirrorFactor}×)`],
        ['Internal footprint (virtual disks)', `${sofs.internalFootprintTB} TB`],
        ['SOFS guest VMs', String(state.sofs.sofsGuestVmCount)],
        ['Total SOFS vCPUs', String(sofs.sofsVCpusTotal)],
        ['Total SOFS memory', `${sofs.sofsMemoryTotalGB} GB`],
        ['Steady-state IOPS', sofs.totalSteadyStateIops.toLocaleString()],
        ['Login storm peak IOPS', sofs.totalLoginStormIops.toLocaleString()],
        ['Min. Azure Local CSV capacity needed', `${sofs.internalFootprintTB} TB`],
      ],
      theme: 'striped',
      headStyles: { fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontSize: 9 },
      styles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
    })
    y = doc.lastAutoTable.finalY + 4
    if (sofs.internalMirrorFactor > 1) {
      doc.setFontSize(8)
      doc.setTextColor(180, 100, 0)
      const note = `Resiliency compounding: ${sofs.totalStorageTB} TB logical x ${sofs.internalMirrorFactor}x guest mirror = ${sofs.internalFootprintTB} TB virtual disk footprint. ` +
        `Apply the Azure Local host resiliency factor on top (e.g. 3x for three-way mirror = up to ${(sofs.internalFootprintTB * 3).toFixed(2)} TB raw pool consumption).`
      const lines = doc.splitTextToSize(note, pageW - margin * 2)
      doc.text(lines, margin, y + 3)
      doc.setTextColor(0, 0, 0)
      y += lines.length * 4 + 4
    }
    y += 2
  }

  // ── Health Check — always last page ──────────────────────────────────────
  if (y > pageH - 70) { doc.addPage(); y = 20 }
  y = section(doc, `Health Check — ${health.passed ? '✓ PASSED' : '✗ FAILED'} (${health.errorCount}E/${health.warningCount}W/${health.infoCount}I)`, y)

  // Per-volume health detail
  if (health.volumeDetails.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Volume', 'Resiliency', 'Size (TiB)', 'Pool Footprint (TB)', 'Status']],
      body: health.volumeDetails.map((vd) => [
        vd.name,
        vd.resiliency,
        String(vd.plannedSizeTiB),
        String(vd.poolFootprintTB),
        vd.status === 'pass' ? 'PASS' : `FAIL: ${vd.failReason}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
    })
    y = doc.lastAutoTable.finalY + 4

    // Pool utilization
    if (health.availablePoolTB > 0) {
      y = utilizationBar(doc, 'Pool utilization:', health.totalPoolFootprintTB, health.availablePoolTB, 'TB', margin, y + 3, pageW - margin * 2)
      y += 4
    }
  }

  if (health.issues.length === 0) {
    doc.setFontSize(9)
    doc.setTextColor(34, 160, 34)
    doc.text('All health checks passed. No issues found.', margin, y + 5)
    doc.setTextColor(0, 0, 0)
  } else {
    if (y > pageH - 50) { doc.addPage(); y = 20 }
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Severity', 'Code', 'Message']],
      body: health.issues.map((i) => [
        i.severity.toUpperCase(),
        i.code,
        i.message,
      ]),
      theme: 'striped',
      headStyles: {
        fillColor: health.passed ? [34, 160, 34] : [220, 53, 69],
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold' },
        1: { cellWidth: 40 },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const sev = health.issues[data.row.index]?.severity
          if (sev === 'error') data.cell.styles.textColor = [220, 53, 69]
          else if (sev === 'warning') data.cell.styles.textColor = [204, 122, 0]
          else data.cell.styles.textColor = [0, 100, 200]
        }
      },
    })
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Azure Local Surveyor — azure local capacity planning tool | Page ${p} of ${totalPages}`,
      pageW / 2,
      pageH - 8,
      { align: 'center' },
    )
    doc.setTextColor(0, 0, 0)
  }

  doc.save('azure-local-surveyor-plan.pdf')
}
