/**
 * RVTools import — parser tests (AB#414).
 *
 * Fixtures are built in-memory with SheetJS (aoa_to_sheet → write to a byte
 * array) so the tests exercise the same XLSX.read path the browser uses, with
 * full control over headers, units, and edge-case rows.
 */

import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseRvToolsWorkbook } from '../rvtools'
import { computeAllCustomWorkloads } from '../custom-workloads'

type Cell = string | number | boolean | null

/** Build a single-sheet workbook from a header row + data rows. */
function buildWorkbook(headers: string[], rows: Cell[][], sheetName = 'vInfo'): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}

/** Build a multi-sheet workbook (sheet name → [headers, ...rows]). */
function buildMultiSheet(sheets: Record<string, { headers: string[]; rows: Cell[][] }>): Uint8Array {
  const wb = XLSX.utils.book_new()
  for (const [name, { headers, rows }] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}

const VINFO_HEADERS = ['VM', 'Powerstate', 'Template', 'CPUs', 'Memory', 'Provisioned MiB', 'In Use MiB']

// ─── Happy path: grouping by (vCPU, memory) signature ─────────────────────────

describe('parseRvToolsWorkbook — grouping', () => {
  it('groups identical VMs and keeps distinct specs separate', () => {
    const buf = buildWorkbook(VINFO_HEADERS, [
      ['web01', 'poweredOn', false, 8, 16384, 2097152, 1048576], // 8 vCPU / 16 GB / 2 TiB
      ['web02', 'poweredOn', false, 8, 16384, 2097152, 1048576], // identical → same group
      ['db01',  'poweredOn', false, 4, 8192, 1048576, 524288],   // 4 vCPU / 8 GB / 1 TiB
    ])
    const r = parseRvToolsWorkbook(buf)

    expect(r.error).toBeNull()
    expect(r.vmCount).toBe(3)
    expect(r.imported).toBe(2) // two distinct (vCPU, memory) signatures

    // Largest fleet first
    expect(r.workloads[0].vmCount).toBe(2)
    expect(r.workloads[0].vCpusPerVm).toBe(8)
    expect(r.workloads[0].memoryPerVmGB).toBe(16) // 16384 MiB ÷ 1024
    expect(r.workloads[0].storageTB).toBe(4)      // 2 × (2097152 ÷ 1024²)

    expect(r.workloads[1].vmCount).toBe(1)
    expect(r.workloads[1].vCpusPerVm).toBe(4)
    expect(r.workloads[1].memoryPerVmGB).toBe(8)
    expect(r.workloads[1].storageTB).toBe(1)
  })

  it('reports aggregate totals across all VMs', () => {
    const buf = buildWorkbook(VINFO_HEADERS, [
      ['a', 'poweredOn', false, 8, 16384, 2097152, 0],
      ['b', 'poweredOn', false, 8, 16384, 2097152, 0],
      ['c', 'poweredOn', false, 4, 8192, 1048576, 0],
    ])
    const r = parseRvToolsWorkbook(buf)
    expect(r.totalVCpus).toBe(20)     // 2×8 + 1×4
    expect(r.totalMemoryGB).toBe(40)  // 2×16 + 1×8
    expect(r.totalStorageTB).toBe(5)  // 4 + 1
  })

  it('emits CustomWorkload-shaped rows that the workload engine can consume', () => {
    const buf = buildWorkbook(VINFO_HEADERS, [
      ['a', 'poweredOn', false, 8, 16384, 2097152, 0],
      ['b', 'poweredOn', false, 8, 16384, 2097152, 0],
    ])
    const r = parseRvToolsWorkbook(buf)
    const wl = r.workloads[0]
    expect(wl.id).toMatch(/^cw-rvtools-/)
    expect(wl.enabled).toBe(true)
    expect(wl.osDiskPerVmGB).toBe(0)        // storage folded into storageTB, not double-counted
    expect(wl.internalMirrorFactor).toBe(1) // provisioned figure is a single allocation

    // Round-trip: engine totals match the parser's reported totals.
    const totals = computeAllCustomWorkloads(r.workloads)
    expect(totals.totalVCpus).toBe(r.totalVCpus)
    expect(totals.totalMemoryGB).toBe(r.totalMemoryGB)
    expect(totals.totalStorageTB).toBeCloseTo(r.totalStorageTB, 2)
  })
})

// ─── Filtering: templates and power state ─────────────────────────────────────

describe('parseRvToolsWorkbook — filtering', () => {
  it('skips template VMs and counts them separately', () => {
    const buf = buildWorkbook(VINFO_HEADERS, [
      ['gold', 'poweredOff', true, 2, 4096, 524288, 0],   // template → skipped
      ['live', 'poweredOn', false, 4, 8192, 1048576, 0],
    ])
    const r = parseRvToolsWorkbook(buf)
    expect(r.skippedTemplates).toBe(1)
    expect(r.vmCount).toBe(1)
    expect(r.workloads).toHaveLength(1)
  })

  it('treats a string "TRUE" template flag as a template', () => {
    const buf = buildWorkbook(VINFO_HEADERS, [
      ['gold', 'poweredOff', 'True', 2, 4096, 524288, 0],
      ['live', 'poweredOn', 'False', 4, 8192, 1048576, 0],
    ])
    const r = parseRvToolsWorkbook(buf)
    expect(r.skippedTemplates).toBe(1)
    expect(r.vmCount).toBe(1)
  })

  it('includes powered-off VMs but reports the count', () => {
    const buf = buildWorkbook(VINFO_HEADERS, [
      ['on',  'poweredOn', false, 4, 8192, 1048576, 0],
      ['off', 'poweredOff', false, 4, 8192, 1048576, 0],
    ])
    const r = parseRvToolsWorkbook(buf)
    expect(r.vmCount).toBe(2)
    expect(r.poweredOff).toBe(1)
  })

  it('skips fully blank rows', () => {
    const buf = buildWorkbook(VINFO_HEADERS, [
      ['real', 'poweredOn', false, 4, 8192, 1048576, 0],
      [null, null, null, 0, 0, 0, 0], // no signal → ignored
    ])
    const r = parseRvToolsWorkbook(buf)
    expect(r.vmCount).toBe(1)
  })
})

// ─── Storage source selection ─────────────────────────────────────────────────

describe('parseRvToolsWorkbook — storage source', () => {
  it('prefers the Provisioned column', () => {
    const buf = buildWorkbook(VINFO_HEADERS, [
      ['a', 'poweredOn', false, 4, 8192, 2097152, 1048576], // prov 2 TiB, in-use 1 TiB
    ])
    const r = parseRvToolsWorkbook(buf)
    expect(r.storageSource).toBe('provisioned')
    expect(r.totalStorageTB).toBe(2)
  })

  it('falls back to In Use when Provisioned is absent', () => {
    const buf = buildWorkbook(['VM', 'CPUs', 'Memory', 'In Use MiB'], [
      ['a', 4, 8192, 1048576],
    ])
    const r = parseRvToolsWorkbook(buf)
    expect(r.storageSource).toBe('in-use')
    expect(r.totalStorageTB).toBe(1)
  })

  it('reports "none" when no storage column exists', () => {
    const buf = buildWorkbook(['VM', 'CPUs', 'Memory'], [['a', 4, 8192]])
    const r = parseRvToolsWorkbook(buf)
    expect(r.storageSource).toBe('none')
    expect(r.totalStorageTB).toBe(0)
  })

  it('reads "Provisioned MB" columns as MiB (RVTools labels MB but means MiB)', () => {
    const buf = buildWorkbook(['VM', 'CPUs', 'Memory', 'Provisioned MB'], [
      ['a', 4, 8192, 1048576],
    ])
    const r = parseRvToolsWorkbook(buf)
    expect(r.storageSource).toBe('provisioned')
    expect(r.totalStorageTB).toBe(1)
  })
})

// ─── CSV / single-sheet fallback ──────────────────────────────────────────────

describe('parseRvToolsWorkbook — sheet selection', () => {
  it('uses the only sheet when it is not named vInfo (CSV export)', () => {
    const buf = buildWorkbook(['VM', 'CPUs', 'Memory', 'Provisioned MiB'], [
      ['a', 4, 8192, 1048576],
    ], 'Sheet1')
    const r = parseRvToolsWorkbook(buf)
    expect(r.error).toBeNull()
    expect(r.vmCount).toBe(1)
  })

  it('finds vInfo among many sheets in a full RVTools export', () => {
    const buf = buildMultiSheet({
      vCPU: { headers: ['VM', 'CPUs'], rows: [['a', 4]] },
      vInfo: { headers: ['VM', 'CPUs', 'Memory', 'Provisioned MiB'], rows: [['a', 4, 8192, 1048576]] },
      vDisk: { headers: ['VM', 'Disk'], rows: [['a', 'scsi0:0']] },
    })
    const r = parseRvToolsWorkbook(buf)
    expect(r.error).toBeNull()
    expect(r.vmCount).toBe(1)
    expect(r.workloads[0].memoryPerVmGB).toBe(8)
  })

  it('errors when no vInfo sheet exists among multiple sheets', () => {
    const buf = buildMultiSheet({
      vCPU: { headers: ['VM', 'CPUs'], rows: [['a', 4]] },
      vDisk: { headers: ['VM', 'Disk'], rows: [['a', 'scsi0:0']] },
    })
    const r = parseRvToolsWorkbook(buf)
    expect(r.error).toMatch(/no "vInfo" sheet/i)
    expect(r.workloads).toHaveLength(0)
  })
})

// ─── Error handling ───────────────────────────────────────────────────────────

describe('parseRvToolsWorkbook — errors', () => {
  it('errors when CPU/Memory columns are missing', () => {
    const buf = buildWorkbook(['VM', 'Powerstate', 'OS'], [['a', 'poweredOn', 'Linux']])
    const r = parseRvToolsWorkbook(buf)
    expect(r.error).toMatch(/does not look like an RVTools/i)
  })

  it('errors when the sheet has no data rows', () => {
    const buf = buildWorkbook(VINFO_HEADERS, [])
    const r = parseRvToolsWorkbook(buf)
    expect(r.error).toBeTruthy()
    expect(r.workloads).toHaveLength(0)
  })

  it('errors on unreadable bytes', () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5])
    const r = parseRvToolsWorkbook(garbage)
    expect(r.error).toBeTruthy()
    expect(r.workloads).toHaveLength(0)
  })
})

// ─── Unit conversion + tolerant parsing ───────────────────────────────────────

describe('parseRvToolsWorkbook — unit conversion', () => {
  it('converts memory MiB → GB and rounds to the nearest GB', () => {
    const buf = buildWorkbook(['VM', 'CPUs', 'Memory'], [
      ['a', 2, 10240], // 10240 MiB = 10 GB
    ])
    const r = parseRvToolsWorkbook(buf)
    expect(r.workloads[0].memoryPerVmGB).toBe(10)
  })

  it('tolerates thousands separators in string cells (CSV)', () => {
    const buf = buildWorkbook(['VM', 'CPUs', 'Memory', 'Provisioned MiB'], [
      ['a', '4', '8,192', '1,048,576'],
    ])
    const r = parseRvToolsWorkbook(buf)
    expect(r.workloads[0].vCpusPerVm).toBe(4)
    expect(r.workloads[0].memoryPerVmGB).toBe(8)
    expect(r.workloads[0].storageTB).toBe(1)
  })
})
