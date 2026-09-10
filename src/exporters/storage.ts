import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { SurveyorState } from '../state/store'
import { storageSnapshot } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { computeVolumeSummary } from '../engine/volumes'
import { validateHardwareInputs } from '../engine/hardware'
import { computeCompute } from '../engine/compute'
import { runHealthCheck } from '../engine/healthcheck'
import { computePlanning } from '../engine/planning'

export function storageReportData(raw: SurveyorState) {
  const state = storageSnapshot(raw)
  const capacity = computeCapacity(state.hardware, state.advanced)
  const volumes = computeVolumeSummary(state.volumes, capacity)
  const validation = validateHardwareInputs(state.hardware)
  const health = runHealthCheck({ hardware: state.hardware, settings: state.advanced, volumes: state.volumes, capacity,
    compute: computeCompute(state.hardware, state.advanced), workloadSummary: computePlanning(state).workloadTotals })
  const checks = [...validation.issues, ...health.issues]
  const tables: { title: string; head: string[]; rows: (string | number)[][] }[] = [
    { title: 'Hardware', head: ['Input', 'Value'], rows: [
      ['Nodes', state.hardware.nodeCount], ['Capacity drives per node', state.hardware.capacityDrivesPerNode],
      ['Capacity drive size (decimal TB)', state.hardware.capacityDriveSizeTB], ['Capacity media', state.hardware.capacityMediaType],
      ['Cache drives per node', state.hardware.cacheDrivesPerNode], ['Cache drive size (TB)', state.hardware.cacheDriveSizeTB], ['Cache media', state.hardware.cacheMediaType],
    ] },
    { title: 'Capacity', head: ['Metric', 'Decimal TB'], rows: [
      ['Raw pool', capacity.rawPoolTB], ['Pool available for volumes', capacity.availableForVolumesTB],
      ['Planned volume footprint', volumes.totalPoolFootprintTB], ['Remaining pool', capacity.availableForVolumesTB - volumes.totalPoolFootprintTB],
      ['Usable with comparison resiliency', capacity.effectiveUsableTB],
    ] },
    { title: 'Volumes', head: ['Name', 'Logical TB', 'Resiliency', 'Provisioning', 'WAC GB'], rows: volumes.volumes.map(v => [v.name, v.calculatorSizeTB, v.resiliency, v.provisioning, v.wacSizeGB]) },
    { title: 'Assumptions', head: ['Setting', 'Value'], rows: [
      ['Comparison resiliency', state.advanced.defaultResiliency],
      ['Infrastructure volume logical TB', state.advanced.infraVolumeSizeTB],
      ['Scope', 'Standalone storage plan; no workload demand included.'],
      ['Review', 'Confirm hardware support, resiliency and operational headroom before deployment.'],
    ] },
    { title: 'Checks', head: ['Severity', 'Finding'], rows: checks.map(c => [c.severity, c.message]) },
  ]
  return { state, capacity, volumes, validation, health, tables }
}

export function storageMarkdown(state: SurveyorState) {
  const report = storageReportData(state)
  const escape = (value: string | number) => String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ')
  return ['# Azure Local Storage Plan', '', state.planName, '', ...report.tables.flatMap(t => [
    '## ' + t.title, '', '| ' + t.head.join(' | ') + ' |', '| ' + t.head.map(() => '---').join(' | ') + ' |',
    ...t.rows.map(row => '| ' + row.map(escape).join(' | ') + ' |'), '',
  ])].join('\n')
}

export function exportStoragePdf(state: SurveyorState) {
  const report = storageReportData(state)
  const doc = new jsPDF()
  doc.setFontSize(18); doc.text('Azure Local Storage Plan', 14, 18)
  doc.setFontSize(10); doc.text(doc.splitTextToSize(state.planName, 175).slice(0, 2), 14, 26)
  report.tables.forEach((table, index) => {
    if (index > 0) doc.addPage()
    doc.setFontSize(12); doc.text(table.title, 14, index === 0 ? 43 : 18)
    autoTable(doc, { startY: index === 0 ? 48 : 23, head: [table.head], body: table.rows, styles: { fontSize: 9 }, headStyles: { fillColor: [15, 48, 87] } })
  })
  doc.save('azurelocal-storage-plan.pdf')
}

export function exportStorageXlsx(state: SurveyorState) {
  const wb = XLSX.utils.book_new()
  storageReportData(state).tables.forEach(t => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([t.head, ...t.rows]), t.title))
  XLSX.writeFile(wb, 'azurelocal-storage-plan.xlsx')
}

export function downloadStorageMarkdown(state: SurveyorState) {
  const url = URL.createObjectURL(new Blob([storageMarkdown(state)], { type: 'text/markdown' }))
  const a = document.createElement('a'); a.href = url; a.download = 'azurelocal-storage-plan.md'; a.click(); URL.revokeObjectURL(url)
}
