/**
 * Spreadsheet library parity after replacing xlsx 0.18.5 (GHSA-4r6h-8v6p-xvw6 prototype pollution,
 * GHSA-5pgg-2g8v-p4x9 ReDoS) with the SheetJS 0.20.3 build pinned in package-lock.json.
 *
 * The workbook mimics a demo-style individual-VM RVTools export (vInfo + vPartition) that
 * contains AVD session hosts, a template, vCLS agent VMs and a powered-off VM.
 */
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseInventoryWorkbook } from '../inventory-import'
import { parseRvToolsWorkbook } from '../rvtools'

type Cell = string | number | boolean | null
const VINFO = ['VM', 'Powerstate', 'Template', 'CPUs', 'Memory', 'Provisioned MiB', 'In Use MiB', 'Cluster', 'Host']

function workbook(sheets: Record<string, Cell[][]>): Uint8Array {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name)
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}

const demo = () => workbook({
  vInfo: [
    VINFO,
    ['AVD-SH-01', 'poweredOn', false, 8, 32768, 262144, 131072, 'DemoCluster', 'host1'],
    ['AVD-SH-02', 'poweredOn', false, 8, 32768, 262144, 131072, 'DemoCluster', 'host1'],
    ['SQL-01', 'poweredOn', false, 16, 65536, 1048576, 524288, 'DemoCluster', 'host2'],
    ['DC-01', 'poweredOff', false, 2, 4096, 65536, 32768, 'DemoCluster', 'host2'],
    ['vCLS-1a2b', 'poweredOn', false, 1, 128, 2048, 1024, 'DemoCluster', 'host1'],
    ['vCLS (2)', 'poweredOn', false, 1, 128, 2048, 1024, 'DemoCluster', 'host2'],
    ['Win2025-template', 'poweredOff', true, 4, 8192, 131072, 65536, 'DemoCluster', 'host1'],
  ],
  vPartition: [
    ['VM', 'Consumed MiB'],
    ['AVD-SH-01', 100000],
    ['AVD-SH-02', 110000],
  ],
})

describe('SheetJS 0.20.3 parity on a demo-style RVTools workbook', () => {
  it('individual VM import: templates and vCLS skipped, powered-off retained', () => {
    const r = parseInventoryWorkbook(demo())
    // 7 rows: 1 template + 2 vCLS skipped = 3; 4 workload VMs remain
    expect(r.rows).toBe(7)
    expect(r.skipped).toBe(3)
    expect(r.vms.map(v => v.name)).toEqual(['AVD-SH-01', 'AVD-SH-02', 'SQL-01', 'DC-01'])
    expect(r.vms.filter(v => v.powerState === 'off').map(v => v.name)).toEqual(['DC-01'])
    expect(r.warnings.join(' ')).toMatch(/1 powered-off/)
  })
  it('tiers and unit conversions: MiB to GiB, partition consumption over In Use', () => {
    const { vms } = parseInventoryWorkbook(demo())
    const sh1 = vms.find(v => v.name === 'AVD-SH-01')!
    expect(sh1.tier).toBe('vdi')
    expect(sh1.vCpu).toBe(8)
    expect(sh1.memoryGiB).toBe(32) // 32768 MiB / 1024
    expect(sh1.provisionedGiB).toBe(256) // 262144 / 1024
    expect(sh1.consumedGiB).toBeCloseTo(100000 / 1024, 6) // vPartition wins over In Use (131072 / 1024 = 128)
    expect(vms.find(v => v.name === 'SQL-01')!.tier).toBe('database')
    expect(vms.find(v => v.name === 'DC-01')!.tier).toBe('infrastructure')
  })
  it('grouped import: 2 AVD hosts share a signature; template skipped', () => {
    const r = parseRvToolsWorkbook(demo())
    expect(r.error).toBeNull()
    expect(r.skippedTemplates).toBe(1)
    expect(r.skippedVcls).toBe(2)
    // 2 AVD + SQL + DC = 4 VMs
    expect(r.vmCount).toBe(4)
    const avd = r.workloads.find(w => w.vCpusPerVm === 8)!
    expect(avd.vmCount).toBe(2)
    expect(avd.memoryPerVmGB).toBe(32)
    expect(avd.storageTB).toBeCloseTo(2 * 262144 / 1024 ** 2, 2) // 0.5 TiB
    expect(r.poweredOff).toBe(1)
  })
  it('reads CSV exports of vInfo', () => {
    const csv = 'VM,Powerstate,CPUs,Memory,Provisioned MiB,In Use MiB\nweb01,poweredOn,4,8192,102400,51200\n'
    const r = parseInventoryWorkbook(new TextEncoder().encode(csv))
    expect(r.vms).toHaveLength(1)
    expect(r.vms[0].memoryGiB).toBe(8)
  })
})

describe('hostile workbook input', () => {
  it('does not pollute Object.prototype through proto or constructor headers', () => {
    const buf = workbook({ vInfo: [['VM', 'CPUs', 'Memory', 'Provisioned MiB', '__proto__', 'constructor', 'polluted'], ['vm1', 2, 2048, 1024, 'x', 'y', 'z']] })
    parseInventoryWorkbook(buf)
    parseRvToolsWorkbook(buf)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false)
  })
  it('reads a long-string worksheet quickly (no catastrophic backtracking)', () => {
    const long = 'a'.repeat(30000) // Excel cell limit is 32767 characters
    const buf = workbook({ vInfo: [VINFO, [long, 'poweredOn', false, 2, 2048, 1024, 512, long, long]] })
    const start = performance.now()
    const r = parseInventoryWorkbook(buf)
    expect(performance.now() - start).toBeLessThan(5000)
    expect(r.vms).toHaveLength(1)
  })
  it('rejects non-workbook bytes with a controlled message', () => {
    expect(parseRvToolsWorkbook(new Uint8Array([1, 2, 3, 4, 5])).error).not.toBeNull()
  })
})
