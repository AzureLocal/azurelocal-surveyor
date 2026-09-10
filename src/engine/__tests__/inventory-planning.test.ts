import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { computeInventory, DEFAULT_INVENTORY_SETTINGS, gibToDecimalTb, validateInventory, type InventoryVm } from '../inventory'
import { parseInventoryWorkbook, attachPerformanceWorkbook, performanceTemplate } from '../inventory-import'
import { assessHardwareFit } from '../fit'
import { computePlanning, suggestPlanningVolumes } from '../planning'
import { normalizePersistedState } from '../../state/store'
import { computeCapacity } from '../capacity'

export const vm = (change: Partial<InventoryVm> = {}): InventoryVm => ({
  id: 'vm-1', name: 'IIC-SQL-01', tier: 'database', include: true,
  vCpu: 8, memoryGiB: 32, consumedGiB: 100, provisionedGiB: 200,
  powerState: 'on', sourceCluster: 'IIC-Cluster', sourceHost: 'IIC-Host', guestOs: 'Windows Server', reviewed: true, ...change,
})
const workbook = (sheets: Record<string, Record<string, unknown>[]>) => {
  const wb = XLSX.utils.book_new()
  Object.entries(sheets).forEach(([name, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name))
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
const row = { VM: 'IIC-SQL-01', CPUs: 8, Memory: 32768, 'Provisioned MiB': 204800, 'In Use MiB': 102400, Powerstate: 'poweredOn' }

describe('Individual inventory demand', () => {
  it('keeps allocation, consumed and provisioned evidence distinct', () => {
    const r = computeInventory([vm()])
    expect(r.totalVCpus).toBe(8)
    expect(r.totalMemoryGB).toBe(32)
    expect(r.totalStorageTB).toBeCloseTo(200 * 2 ** 30 / 1e12, 10)
    expect(r.consumedGiB).toBe(100)
    expect(r.provisionedGiB).toBe(200)
  })
  it('uses independent allocation fallback for partial measurements', () => {
    const r = computeInventory([vm({ measurement: { cpuP95Pct: 20 } })], { sizingBasis: 'measured-p95', comfortFactor: 1.25 })
    expect(r.totalVCpus).toBe(2)
    expect(r.totalMemoryGB).toBe(32)
    expect(r.cpuFallbackCount).toBe(0)
    expect(r.memoryFallbackCount).toBe(1)
  })
  it('does not change allocation demand when measurements are informational', () => {
    expect(computeInventory([vm({ measurement: { cpuP95Pct: 1, memoryP95Pct: 1 } })]).totalVCpus).toBe(8)
  })
  it('keeps zero utilization as evidence and applies the documented minimum floor', () => {
    const r = computeInventory([vm({ measurement: { cpuP95Pct: 0 } })], { sizingBasis: 'measured-p95' })
    expect(r.totalVCpus).toBe(.4)
    expect(r.cpuCoveragePct).toBe(100)
  })
  it('applies growth once to selected inventory demand only', () => {
    const r = computeInventory([vm()], { growthPct: 50, storageBasis: 'consumed' })
    expect(r.totalVCpus).toBe(12)
    expect(r.totalStorageTB).toBeCloseTo(gibToDecimalTb(150))
    expect(r.storageByTier.database).toBeCloseTo(r.totalStorageTB)
  })
  it('excludes disabled VMs from demand and confidence coverage', () => {
    const r = computeInventory([vm({ include: false, measurement: { cpuP95Pct: 90 } })])
    expect(r.totalVCpus).toBe(0)
    expect(r.confidence).toBe('allocation-only')
  })
  it('requires coverage and observation history for high confidence', () => {
    const r = computeInventory([vm({ measurement: { cpuP95Pct: 50, memoryP95Pct: 50, iopsP95: 10, throughputMBpsP95: 1, observationDays: 7 } })])
    expect(r.confidence).toBe('high')
    expect(r.confidenceScore).toBe(100)
  })
  it.each([NaN, Infinity, -1])('rejects invalid VM resources (%s)', n => {
    expect(() => validateInventory([vm({ memoryGiB: n })])).toThrow()
  })
  it('rejects duplicate IDs and invalid measurements', () => {
    expect(() => validateInventory([vm(), vm()])).toThrow(/unique/)
    expect(() => validateInventory([vm({ measurement: { memoryP95Pct: 101 } })])).toThrow(/memoryP95Pct/)
  })
})

describe('RVTools inventory and performance import', () => {
  it('retains distinct VMs with the same CPU and memory signature', () => {
    const imported = parseInventoryWorkbook(workbook({ vInfo: [row, { ...row, VM: 'IIC-SQL-02' }] }))
    expect(imported.vms).toHaveLength(2)
    expect(imported.vms[0].memoryGiB).toBe(32)
    expect(imported.vms[0].tier).toBe('database')
    expect(imported.vms[0].reviewed).toBe(false)
  })
  it('retains powered-off VMs but excludes templates and placeholders', () => {
    const imported = parseInventoryWorkbook(workbook({ vInfo: [{ ...row, Powerstate: 'poweredOff' }, { ...row, VM: 'template', Template: true }, { ...row, VM: 'placeholder', 'SRM Placeholder': true }] }))
    expect(imported.vms).toHaveLength(1)
    expect(imported.vms[0].include).toBe(true)
    expect(imported.skipped).toBe(2)
  })
  it('uses partition consumption while preserving provisioned capacity', () => {
    const imported = parseInventoryWorkbook(workbook({ vInfo: [row], vPartition: [{ VM: row.VM, 'Consumed MiB': 51200 }] }))
    expect(imported.vms[0].consumedGiB).toBe(50)
    expect(imported.vms[0].provisionedGiB).toBe(200)
  })
  it('does not join ambiguous partition names across source clusters', () => {
    const imported = parseInventoryWorkbook(workbook({ vInfo: [{ ...row, Cluster: 'a' }, { ...row, Cluster: 'b' }], vPartition: [{ VM: row.VM, 'Consumed MiB': 51200 }] }))
    expect(imported.vms.map(v => v.consumedGiB)).toEqual([100, 100])
    expect(imported.warnings.join(' ')).toMatch(/Duplicate/)
  })
  it('rejects missing resource evidence instead of importing zero demand', () => {
    expect(() => parseInventoryWorkbook(workbook({ vInfo: [{ VM: 'bad', CPUs: 4, Memory: 8192 }] }))).toThrow(/storage evidence/)
    expect(() => parseInventoryWorkbook(workbook({ vInfo: [{ ...row, Memory: 'invalid' }] }))).toThrow(/memory/)
  })
  it('imports vInfo CSV as well as workbooks', () => {
    const data = new TextEncoder().encode(XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet([row])))
    expect(parseInventoryWorkbook(data).vms[0].vCpu).toBe(8)
  })
  it('refuses ambiguous performance matching and allows source-cluster qualification', () => {
    const vms = [vm(), vm({ id: 'vm-2', sourceCluster: 'other' })]
    const ambiguous = attachPerformanceWorkbook(vms, workbook({ Metrics: [{ VM: row.VM, 'CPU P95 %': 20 }] }))
    expect(ambiguous.matched).toBe(0)
    const qualified = attachPerformanceWorkbook(vms, workbook({ Metrics: [{ VM: row.VM, 'Source Cluster': 'other', 'CPU P95 %': 20 }] }))
    expect(qualified.vms[0].measurement).toBeUndefined()
    expect(qualified.vms[1].measurement?.cpuP95Pct).toBe(20)
  })
  it('rejects duplicate measurement rows atomically', () => {
    const rows = [{ VM: row.VM, 'CPU P95 %': 20 }, { VM: row.VM, 'CPU P95 %': 30 }]
    const original = [vm()]
    expect(() => attachPerformanceWorkbook(original, workbook({ Metrics: rows }))).toThrow(/Duplicate/)
    expect(original[0].measurement).toBeUndefined()
  })
  it('produces a template with stable VM IDs', () => {
    expect(performanceTemplate([vm()])).toContain('VM ID')
    expect(performanceTemplate([vm()])).toContain('vm-1')
  })
})

describe('Integrated workload sizing and fit', () => {
  const state = () => ({ ...normalizePersistedState({}), inventory: [vm()], inventorySettings: { ...DEFAULT_INVENTORY_SETTINGS } })
  it('combines inventory and specialized groups once', () => {
    const s = state()
    s.virtualMachines = { enabled: true, vCpuOvercommitRatio: 1, groups: [{ id: 'g', name: 'Group', vmCount: 2, vCpusPerVm: 4, memoryPerVmGB: 8, storagePerVmGB: 100 }] }
    const totals = computePlanning(s).workloadTotals
    expect(totals.totalVCpus).toBe(16)
    expect(totals.totalMemoryGB).toBe(48)
    expect(totals.totalStorageTB).toBe(.41)
  })
  it('generates inventory volumes with decimal storage units and no under-allocation', () => {
    const s = state()
    const volumes = suggestPlanningVolumes(s)
    expect(volumes).toHaveLength(1)
    expect(volumes[0].name).toContain('database')
    expect(volumes[0].plannedSizeTB).toBeGreaterThanOrEqual(gibToDecimalTb(200))
  })
  it('splits large inventory storage into bounded volumes', () => {
    const s = state(); s.inventory = [vm({ provisionedGiB: 200000 })]
    const volumes = suggestPlanningVolumes(s)
    expect(volumes.length).toBeGreaterThan(1)
    expect(volumes.every(v => v.plannedSizeTB <= 64)).toBe(true)
    expect(volumes.reduce((sum, v) => sum + v.plannedSizeTB, 0)).toBeGreaterThanOrEqual(gibToDecimalTb(200000))
  })
  it('reserves compute nodes without removing their storage', () => {
    const s = state()
    const baseline = assessHardwareFit(s)
    s.advanced.maintenanceReserveMode = 'n+1'
    const reserved = assessHardwareFit(s)
    expect(reserved.current.cpu).toBeLessThan(baseline.current.cpu)
    expect(reserved.current.poolTB).toBe(baseline.current.poolTB)
    expect(reserved.current.poolTB).toBe(computeCapacity(s.hardware, s.advanced).availableForVolumesTB)
  })
  it('reports a memory deficit and finds the smallest larger same-spec design', () => {
    const s = state(); s.hardware.nodeCount = 3; s.hardware.memoryPerNodeGB = 64; s.advanced.maintenanceReserveMode = 'n+1'
    s.inventory = Array.from({ length: 5 }, (_, i) => vm({ id: String(i) }))
    const fit = assessHardwareFit(s)
    expect(fit.fits).toBe(false)
    expect(fit.current.deficits.memoryGB).toBe(48)
    expect(fit.requiredNodes).toBe(4)
    expect(fit.additionalNodes).toBe(1)
  })
  it('does not double-count generated volumes when added to the layout', () => {
    const s = state(); const before = assessHardwareFit(s)
    s.volumes = suggestPlanningVolumes(s)
    const after = assessHardwareFit(s)
    expect(after.current.requiredFootprintTB).toBe(before.current.requiredFootprintTB)
  })
  it('checks full consumption of thin volumes', () => {
    const s = state(); s.volumes = Array.from({ length: 5 }, (_, i) => ({ id: String(i), name: `Thin${i}`, plannedSizeTB: 60, provisioning: 'thin' as const, resiliency: 'three-way-mirror' as const }))
    const fit = assessHardwareFit(s)
    expect(fit.fits).toBe(false)
    expect(fit.current.deficits.poolTB).toBeGreaterThan(0)
  })
  it('does not call an empty plan a successful fit', () => {
    expect(assessHardwareFit(normalizePersistedState({})).fits).toBeNull()
  })
  it('returns no recommendation for workloads that exceed the modeled range', () => {
    const s = state(); s.inventory = [vm({ memoryGiB: 100000 })]
    expect(assessHardwareFit(s).requiredNodes).toBeNull()
  })
  it('does not quietly expand nested resiliency past two nodes', () => {
    const s = state(); s.hardware.nodeCount = 2; s.advanced.defaultResiliency = 'nested-two-way'; s.inventory = [vm({ memoryGiB: 600 })]
    expect(assessHardwareFit(s).requiredNodes).toBeNull()
  })
})
