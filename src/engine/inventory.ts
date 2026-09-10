/** Individual VM evidence. GiB is binary; conversion to the capacity engine's decimal TB happens once. */
export const WORKLOAD_TIERS = ['general', 'database', 'vdi', 'infrastructure'] as const
export type WorkloadTier = typeof WORKLOAD_TIERS[number]
export interface VmMeasurement {
  cpuP95Pct?: number
  memoryP95Pct?: number
  iopsP95?: number
  throughputMBpsP95?: number
  observationDays?: number
}
export interface InventoryVm {
  id: string
  name: string
  tier: WorkloadTier
  include: boolean
  vCpu: number
  memoryGiB: number
  consumedGiB: number
  provisionedGiB: number
  powerState: 'on' | 'off' | 'suspended' | 'unknown'
  sourceCluster: string
  sourceHost: string
  guestOs: string
  reviewed: boolean
  measurement?: VmMeasurement
}
export interface InventorySettings {
  sizingBasis: 'allocation' | 'measured-p95'
  storageBasis: 'provisioned' | 'consumed'
  comfortFactor: number
  growthPct: number
}
export const DEFAULT_INVENTORY_SETTINGS: InventorySettings = {
  sizingBasis: 'allocation', storageBasis: 'provisioned', comfortFactor: 1.25, growthPct: 0,
}
export interface InventorySource {
  kind: 'rvtools' | 'performance'
  fileName: string
  importedAt: string
  rows: number
}
export const gibToDecimalTb = (gib: number) => gib * 2 ** 30 / 1e12
const present = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0

export function normalizeInventorySettings(value: Partial<InventorySettings> = {}): InventorySettings {
  return {
    sizingBasis: value.sizingBasis === 'measured-p95' ? 'measured-p95' : 'allocation',
    storageBasis: value.storageBasis === 'consumed' ? 'consumed' : 'provisioned',
    comfortFactor: Number.isFinite(value.comfortFactor) ? Math.min(3, Math.max(1, value.comfortFactor!)) : 1.25,
    growthPct: Number.isFinite(value.growthPct) ? Math.min(500, Math.max(0, value.growthPct!)) : 0,
  }
}

export function computeInventory(vms: InventoryVm[] = [], options: Partial<InventorySettings> = {}) {
  const settings = normalizeInventorySettings(options)
  const included = vms.filter(vm => vm.include)
  const growth = 1 + settings.growthPct / 100
  let totalVCpus = 0, totalMemoryGB = 0, storageGiB = 0
  let cpuMeasured = 0, memoryMeasured = 0, storageMeasured = 0, observed = 0
  let allocatedVCpus = 0, allocatedMemoryGiB = 0, consumedGiB = 0, provisionedGiB = 0
  let iopsP95 = 0, throughputMBpsP95 = 0
  const storageByTier = Object.fromEntries(WORKLOAD_TIERS.map(tier => [tier, 0])) as Record<WorkloadTier, number>
  for (const vm of included) {
    const m = vm.measurement
    const cpu = present(m?.cpuP95Pct)
    const memory = present(m?.memoryP95Pct)
    if (cpu) cpuMeasured++
    if (memory) memoryMeasured++
    if (present(m?.iopsP95) && present(m?.throughputMBpsP95)) storageMeasured++
    if ((m?.observationDays ?? 0) >= 7) observed++
    // Missing metrics fall back independently. No additional overcommit is applied to VM demand.
    const factor = (pct: number) => Math.max(0.05, pct / 100 * settings.comfortFactor)
    totalVCpus += vm.vCpu * (settings.sizingBasis === 'measured-p95' && cpu ? factor(m!.cpuP95Pct!) : 1)
    totalMemoryGB += vm.memoryGiB * (settings.sizingBasis === 'measured-p95' && memory ? factor(m!.memoryP95Pct!) : 1)
    const storage = settings.storageBasis === 'consumed' ? vm.consumedGiB : vm.provisionedGiB
    storageGiB += storage
    storageByTier[vm.tier] += gibToDecimalTb(storage * growth)
    allocatedVCpus += vm.vCpu
    allocatedMemoryGiB += vm.memoryGiB
    consumedGiB += vm.consumedGiB
    provisionedGiB += vm.provisionedGiB
    iopsP95 += m?.iopsP95 ?? 0
    throughputMBpsP95 += m?.throughputMBpsP95 ?? 0
  }
  const count = included.length
  const pct = (n: number) => count ? n / count * 100 : 0
  const score = Math.round(pct(cpuMeasured) * .35 + pct(memoryMeasured) * .35 + pct(storageMeasured) * .15 + pct(observed) * .15)
  return {
    includedCount: count, totalCount: vms.length,
    totalVCpus: totalVCpus * growth, totalMemoryGB: totalMemoryGB * growth,
    totalStorageTB: gibToDecimalTb(storageGiB * growth), storageByTier,
    allocatedVCpus, allocatedMemoryGiB, consumedGiB, provisionedGiB,
    cpuCoveragePct: pct(cpuMeasured), memoryCoveragePct: pct(memoryMeasured),
    storageCoveragePct: pct(storageMeasured), observationCoveragePct: pct(observed),
    cpuFallbackCount: count - cpuMeasured, memoryFallbackCount: count - memoryMeasured,
    confidence: cpuMeasured + memoryMeasured === 0 ? 'allocation-only' : score >= 85 ? 'high' : score >= 60 ? 'medium' : 'low',
    confidenceScore: score, iopsP95, throughputMBpsP95,
  }
}

/** Reject malformed project evidence instead of silently dropping workloads and understating demand. */
export function validateInventory(value: unknown): InventoryVm[] {
  if (!Array.isArray(value)) throw new Error('VM inventory must be an array.')
  const ids = new Set<string>()
  for (const item of value) {
    const vm = item as InventoryVm | null
    if (!vm || typeof vm.id !== 'string' || !vm.id || ids.has(vm.id) || typeof vm.name !== 'string' || !vm.name.trim()) throw new Error('Every VM needs a name and a unique ID.')
    ids.add(vm.id)
    if (!WORKLOAD_TIERS.includes(vm.tier) || typeof vm.include !== 'boolean') throw new Error(`Invalid tier or inclusion flag for ${vm.name}.`)
    for (const key of ['vCpu', 'memoryGiB', 'consumedGiB', 'provisionedGiB'] as const) {
      if (!Number.isFinite(vm[key]) || vm[key] < 0 || ((key === 'vCpu' || key === 'memoryGiB') && vm[key] === 0)) throw new Error(`Invalid ${key} for ${vm.name}.`)
    }
    if (vm.provisionedGiB < vm.consumedGiB) throw new Error(`Provisioned storage is smaller than consumed storage for ${vm.name}.`)
    if (!['on', 'off', 'suspended', 'unknown'].includes(vm.powerState) || typeof vm.reviewed !== 'boolean' || [vm.sourceHost, vm.sourceCluster, vm.guestOs].some(v => typeof v !== 'string')) throw new Error(`Invalid metadata for ${vm.name}.`)
    if (vm.measurement !== undefined) {
      if (!vm.measurement || typeof vm.measurement !== 'object' || Array.isArray(vm.measurement)) throw new Error(`Invalid performance data for ${vm.name}.`)
      for (const key of ['cpuP95Pct', 'memoryP95Pct', 'iopsP95', 'throughputMBpsP95', 'observationDays'] as const) {
        const n = vm.measurement[key]
        if (n !== undefined && (!present(n) || ((key === 'cpuP95Pct' || key === 'memoryP95Pct') && n > 100))) throw new Error(`Invalid ${key} for ${vm.name}.`)
      }
    }
  }
  return value as InventoryVm[]
}
