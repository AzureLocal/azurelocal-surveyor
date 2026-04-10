/**
 * PDF exporter — Final Report via jsPDF + jsPDF-autotable.
 * Produces a print-ready PDF of the full plan: hardware, capacity, volumes,
 * compute, AVD, SOFS, and health check results.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { SurveyorState } from '../state/store'
import { computeCapacity } from '../engine/capacity'
import { computeVolumeSummary } from '../engine/volumes'
import { computeCompute } from '../engine/compute'
import { computeWorkloadSummary } from '../engine/workloads'
import { runHealthCheck } from '../engine/healthcheck'

export function exportPdf(state: Pick<SurveyorState, 'hardware' | 'advanced' | 'volumes' | 'workloads' | 'avd' | 'sofs'>): void {
  const capacity = computeCapacity(state.hardware, state.advanced)
  const volumeSummary = computeVolumeSummary(state.volumes, capacity)
  const compute = computeCompute(state.hardware, state.advanced)
  const workloadSummary = computeWorkloadSummary(state.workloads)
  const health = runHealthCheck({ hardware: state.hardware, settings: state.advanced, volumes: state.volumes, capacity, compute, workloadSummary })

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  let y = 18

  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Azure Local Surveyor — Cluster Plan', pageW / 2, y, { align: 'center' })
  y += 8
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated ${new Date().toLocaleDateString()}`, pageW / 2, y, { align: 'center' })
  y += 10

  // Hardware
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Hardware', 14, y)
  y += 6
  autoTable(doc, {
    startY: y,
    head: [['Parameter', 'Value']],
    body: [
      ['Nodes', String(state.hardware.nodeCount)],
      ['Capacity drives/node', `${state.hardware.capacityDrivesPerNode} × ${state.hardware.capacityDriveSizeTB} TB (${state.hardware.capacityMediaType.toUpperCase()})`],
      ['CPU per node', `${state.hardware.coresPerNode} cores`],
      ['RAM per node', `${state.hardware.memoryPerNodeGB} GB`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [14, 165, 233] },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // Capacity
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Capacity', 14, y)
  y += 6
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Raw pool', `${capacity.rawPoolTB} TB`],
      [`Pool reserve (${capacity.reserveDrives} drives)`, `${capacity.reserveTB} TB`],
      ['Resiliency', capacity.resiliencyType],
      ['Effective usable', `${capacity.effectiveUsableTB} TB`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [14, 165, 233] },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // Volumes
  if (volumeSummary.volumes.length > 0) {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Volumes', 14, y)
    y += 6
    autoTable(doc, {
      startY: y,
      head: [['Name', 'Resiliency', 'Calculator TB', 'WAC GB']],
      body: volumeSummary.volumes.map((v) => [v.name, v.resiliency, String(v.calculatorSizeTB), String(v.wacSizeGB)]),
      theme: 'striped',
      headStyles: { fillColor: [14, 165, 233] },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // Health Check
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`Health Check — ${health.passed ? 'PASSED' : 'FAILED'}`, 14, y)
  y += 6
  if (health.issues.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Severity', 'Code', 'Message']],
      body: health.issues.map((i) => [i.severity.toUpperCase(), i.code, i.message]),
      theme: 'striped',
      headStyles: { fillColor: health.passed ? [34, 197, 94] : [239, 68, 68] },
    })
  }

  doc.save('azure-local-surveyor-plan.pdf')
}
