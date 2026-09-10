import * as XLSX from 'xlsx'
import { validateInventory, type InventoryVm, type VmMeasurement, type WorkloadTier } from './inventory'

type Row = Record<string, unknown>
const normalized = (value: unknown) => String(value ?? '').trim().toLowerCase()
function pick(row: Row, ...names: string[]): unknown {
  for (const name of names) {
    const key = Object.keys(row).find(k => normalized(k) === normalized(name))
    if (key !== undefined && row[key] !== null && row[key] !== '') return row[key]
  }
  return undefined
}
function number(value: unknown, label: string, fallback?: number): number {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback
    throw new Error(`Missing ${label}. Review the source file before importing.`)
  }
  const n = Number(typeof value === 'string' ? value.replace(/,/g, '').trim() : value)
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid ${label}: expected a non-negative number.`)
  return n
}
function sheet(wb: XLSX.WorkBook, name: string): Row[] {
  const key = wb.SheetNames.find(n => normalized(n) === normalized(name))
  return key ? XLSX.utils.sheet_to_json<Row>(wb.Sheets[key], { defval: null }) : []
}
function classify(name: string): WorkloadTier {
  if (/(^|[-_])(sql|db|oracle)([-_\d]|$)/i.test(name)) return 'database'
  if (/(^|[-_])(vdi|avd|rds)([-_\d]|$)/i.test(name)) return 'vdi'
  if (/(^|[-_])(dc|dns|ad)([-_\d]|$)/i.test(name)) return 'infrastructure'
  return 'general'
}

export function parseInventoryWorkbook(data: ArrayBuffer | Uint8Array) {
  const wb = XLSX.read(data, { type: 'array' })
  const rows = sheet(wb, 'vInfo')
  if (!rows.length && wb.SheetNames.length === 1) rows.push(...XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]], { defval: null }))
  if (!rows.length) throw new Error('No VM rows found. Import an RVTools workbook or vInfo CSV.')
  const warnings: string[] = []
  const consumed = new Map<string, number>()
  const nameCounts = new Map<string, number>()
  rows.forEach(row => { const name = normalized(pick(row, 'VM')); nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1) })
  for (const row of sheet(wb, 'vPartition')) {
    const name = normalized(pick(row, 'VM'))
    const raw = pick(row, 'Consumed MiB', 'Consumed MB')
    if (name && raw !== undefined && nameCounts.get(name) === 1) consumed.set(name, (consumed.get(name) ?? 0) + number(raw, `${name} partition storage`) / 1024)
  }
  let skipped = 0, poweredOff = 0
  const vms: InventoryVm[] = []
  for (const [index, row] of rows.entries()) {
    const name = String(pick(row, 'VM') ?? '').trim()
    if (!name) continue
    if (normalized(pick(row, 'Template')) === 'true' || normalized(pick(row, 'SRM Placeholder')) === 'true' || /^vcls(?:-|$)/i.test(name)) { skipped++; continue }
    const prov = pick(row, 'Provisioned MiB', 'Provisioned MB', 'Provisioned')
    const used = pick(row, 'In Use MiB', 'In Use MB', 'In Use')
    const partition = consumed.get(normalized(name))
    if (prov === undefined && used === undefined && partition === undefined) throw new Error(`No storage evidence for ${name}. Include Provisioned or In Use columns.`)
    const usedGiB = partition ?? (used !== undefined ? number(used, `${name} used storage`) / 1024 : number(prov, `${name} provisioned storage`) / 1024)
    const provisionedGiB = prov !== undefined ? number(prov, `${name} provisioned storage`) / 1024 : usedGiB
    if (partition === undefined && used === undefined) warnings.push(`${name}: consumed storage unavailable; using provisioned storage for both values.`)
    if (prov === undefined) warnings.push(`${name}: provisioned storage unavailable; using consumed storage for both values.`)
    const power = normalized(pick(row, 'Powerstate', 'Power state'))
    const powerState = power.includes('off') ? 'off' : power.includes('suspend') ? 'suspended' : power.includes('on') ? 'on' : 'unknown'
    if (powerState === 'off' || powerState === 'suspended') poweredOff++
    vms.push({
      id: `inventory-${index}-${normalized(pick(row, 'VM UUID', 'VM ID') ?? name)}`,
      name, tier: classify(name), include: true,
      vCpu: number(pick(row, 'CPUs', 'CPU'), `${name} CPU`),
      memoryGiB: number(pick(row, 'Memory'), `${name} memory`) / 1024,
      consumedGiB: usedGiB, provisionedGiB: Math.max(usedGiB, provisionedGiB),
      powerState, sourceCluster: String(pick(row, 'Cluster') ?? ''),
      sourceHost: String(pick(row, 'Host') ?? ''),
      guestOs: String(pick(row, 'OS according to the VMware Tools', 'OS according to the configuration file', 'Guest OS') ?? ''),
      reviewed: false,
    })
    if (provisionedGiB < usedGiB) warnings.push(`${name}: provisioned storage was below consumed storage and was raised to the consumed value.`)
  }
  if (!vms.length) throw new Error('No workload VMs remained after excluding templates and platform placeholders.')
  if ([...nameCounts.values()].some(n => n > 1)) warnings.push('Duplicate VM names found. Partition data was not joined for ambiguous names; performance files must include Source Cluster or VM ID to distinguish them.')
  if (poweredOff) warnings.push(`${poweredOff} powered-off or suspended VMs remain included. Review their inclusion before sizing.`)
  warnings.push('RVTools contains allocation evidence, not CPU or memory utilization history. Review suggested tiers.')
  return { vms: validateInventory(vms), warnings, skipped, rows: rows.length }
}

export function attachPerformanceWorkbook(vms: InventoryVm[], data: ArrayBuffer | Uint8Array) {
  const wb = XLSX.read(data, { type: 'array' })
  if (!wb.SheetNames.length) throw new Error('The performance file has no worksheet.')
  const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]], { defval: null })
  if (!rows.length) throw new Error('The performance file is empty.')
  const changes = new Map<string, VmMeasurement>()
  const byId = new Map(vms.map(vm => [vm.id, vm]))
  const byName = new Map<string, InventoryVm[]>()
  for (const vm of vms) {
    const key = normalized(vm.name)
    byName.set(key, [...(byName.get(key) ?? []), vm])
  }
  const warnings: string[] = []
  const keys: [keyof VmMeasurement, string[]][] = [
    ['cpuP95Pct', ['CPU P95 %', 'cpuP95Pct']], ['memoryP95Pct', ['Memory P95 %', 'memoryP95Pct']],
    ['iopsP95', ['IOPS P95', 'iopsP95']], ['throughputMBpsP95', ['Throughput MBps P95', 'throughputMBpsP95']],
    ['observationDays', ['Observation Days', 'observationDays']],
  ]
  for (const row of rows) {
    const id = pick(row, 'VM ID')
    const name = normalized(pick(row, 'VM', 'VM Name', 'Name'))
    const cluster = pick(row, 'Source Cluster', 'Cluster')
    const idMatch = id === undefined ? undefined : byId.get(String(id))
    const matches = id !== undefined ? (idMatch ? [idMatch] : []) : (byName.get(name) ?? []).filter(vm => cluster === undefined || normalized(vm.sourceCluster) === normalized(cluster))
    if (matches.length !== 1) { warnings.push(`${name || String(id ?? 'Unnamed row')}: ${matches.length ? 'ambiguous VM name' : 'no matching VM'}; skipped.`); continue }
    const vm = matches[0]
    if (changes.has(vm.id)) throw new Error(`Duplicate performance rows for ${vm.name}. Keep one aggregate P95 row per VM.`)
    const measurement: VmMeasurement = {}
    for (const [key, aliases] of keys) {
      const raw = pick(row, ...aliases)
      if (raw !== undefined) measurement[key] = number(raw, `${vm.name} ${key}`)
    }
    if (!Object.keys(measurement).length) { warnings.push(`${vm.name}: no recognized performance columns; skipped.`); continue }
    changes.set(vm.id, measurement)
  }
  const updated = validateInventory(vms.map(vm => changes.has(vm.id) ? { ...vm, measurement: { ...vm.measurement, ...changes.get(vm.id) } } : vm))
  return { vms: updated, matched: changes.size, rows: rows.length, warnings }
}

export function performanceTemplate(vms: InventoryVm[]): string {
  const ws = XLSX.utils.json_to_sheet(vms.map(vm => ({
    'VM ID': vm.id, VM: vm.name, 'Source Cluster': vm.sourceCluster,
    'CPU P95 %': '', 'Memory P95 %': '', 'IOPS P95': '', 'Throughput MBps P95': '', 'Observation Days': '',
  })))
  return XLSX.utils.sheet_to_csv(ws)
}
