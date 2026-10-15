import type { HardwareInputs, DriveMedia, ResiliencyType, HealthCheckResult, HealthSeverity } from './types'
import type { FactId } from './facts'

/**
 * Derive the combined drive media type label from hardware inputs.
 * Used for display and for preset matching.
 */
export function getDriveMediaType(inputs: HardwareInputs): DriveMedia {
  const { cacheMediaType, capacityMediaType } = inputs
  if (cacheMediaType === 'none') {
    if (capacityMediaType === 'nvme') return 'all-nvme'
    if (capacityMediaType === 'ssd') return 'all-ssd'
    return 'all-hdd'
  }
  // NVMe cache tier
  if (cacheMediaType === 'nvme') {
    if (capacityMediaType === 'ssd') return 'nvme-ssd'
    return 'nvme-hdd'
  }
  // SSD cache + HDD capacity
  return 'nvme-hdd'
}

/** Node counts a rack aware cluster can have: two equal zones of 1 to 4 machines. */
export const RACK_AWARE_NODE_COUNTS = [2, 4, 6, 8] as const
export const HCI_MAX_NODES = 16

/**
 * Recommend the safest resiliency type given node count.
 * Azure Local rules (Learn plan-volumes, rack-aware-cluster-requirements):
 *   1 node   -> two-way mirror (only option)
 *   2 nodes  -> two-way mirror or nested two-way mirror (nested recommended for production)
 *   3 nodes  -> three-way mirror
 *   4+ nodes -> three-way mirror or dual parity
 *   rack aware: 1+1 two-way mirror; 2+2 and larger four-way mirror (only option)
 */
export function getRecommendedResiliency(inputs: HardwareInputs): ResiliencyType {
  if (inputs.rackAware) return inputs.nodeCount >= 4 ? 'four-way-mirror' : 'two-way-mirror'
  if (inputs.nodeCount <= 1) return 'two-way-mirror'
  if (inputs.nodeCount === 2) return 'nested-two-way'
  return 'three-way-mirror' // conservative default; user can override to dual-parity
}

/** One platform rule outcome, shared by the Hardware page and the health check. */
export interface PlatformRuleIssue {
  code: string
  severity: HealthSeverity
  message: string
  factId: FactId
  calculation: string
  threshold: string
  /** True when the health check should surface this rule too (others are already covered by older HC_ checks). */
  inHealthCheck: boolean
}

/**
 * Evaluate the Azure Local platform rules for a hardware profile. Each issue cites a fact
 * in src/engine/facts.ts so the rule can be traced to its Learn page.
 */
export function platformRuleIssues(hw: HardwareInputs): PlatformRuleIssue[] {
  const out: PlatformRuleIssue[] = []
  const n = hw.nodeCount
  const cacheInUse = hw.cacheMediaType !== 'none'
  const single = n === 1 && !hw.rackAware
  const add = (i: PlatformRuleIssue) => out.push(i)

  if (!Number.isInteger(n) || n < 1) {
    add({ code: 'HW_MIN_NODES', severity: 'error', factId: 'nodes-hci-1-16', inHealthCheck: false,
      message: 'Hyperconverged Azure Local supports 1 to 16 machines; enter a whole number of at least 1.',
      calculation: `${n} node(s) configured.`, threshold: '1 to 16 machines.' })
  }
  if (n > HCI_MAX_NODES) {
    add({ code: 'HW_MAX_NODES', severity: 'error', factId: 'nodes-hci-1-16', inHealthCheck: true,
      message: `Hyperconverged Azure Local supports at most ${HCI_MAX_NODES} machines (8 when rack aware). Disaggregated deployments on an external SAN scale to 64 machines but are outside what Surveyor models.`,
      calculation: `${n} node(s) configured.`, threshold: `1 to ${HCI_MAX_NODES} machines.` })
  }

  if (single) {
    add({ code: 'HW_SINGLE_NODE', severity: 'warning', factId: 'single-node-two-way', inHealthCheck: true,
      message: 'Single-node design: volumes are two-way mirror across drives only, so a node failure or restart takes all workloads offline. There is no target for live migration, no N+1 headroom, and updates that restart the host interrupt workloads. Plan backup and recovery accordingly.',
      calculation: '1 node configured.', threshold: 'N+1 needs at least 2 nodes.' })
    if (cacheInUse || hw.cacheDrivesPerNode > 0) {
      add({ code: 'HW_SINGLE_NODE_CACHE', severity: 'error', factId: 'single-node-no-cache', inHealthCheck: true,
        message: 'The storage pool cache is not supported on a single node. Use a flat all-NVMe or all-SSD design with cache set to none and 0 cache drives.',
        calculation: `Cache media ${hw.cacheMediaType}, ${hw.cacheDrivesPerNode} cache drive(s) per node.`, threshold: 'No cache tier in a single-node deployment.' })
    }
    if (hw.capacityMediaType === 'hdd') {
      add({ code: 'HW_SINGLE_NODE_HDD', severity: 'error', factId: 'single-node-no-cache', inHealthCheck: true,
        message: 'A single node supports only one flash drive type (NVMe or SSD) with uniform performance; HDD capacity needs a cache tier, which a single node does not support.',
        calculation: 'HDD capacity media on a single node.', threshold: 'All-NVMe or all-SSD only.' })
    }
  }

  if (hw.rackAware) {
    if (!(RACK_AWARE_NODE_COUNTS as readonly number[]).includes(n)) {
      add({ code: 'HW_RACK_ZONES', severity: 'error', factId: 'rack-aware-zones', inHealthCheck: true,
        message: `Rack aware clusters have two equal zones of 1 to 4 machines (1+1, 2+2, 3+3, 4+4), so the node count must be 2, 4, 6 or 8; ${n} is not valid.`,
        calculation: `${n} node(s) split across two zones.`, threshold: 'Equal zones, at most 4 machines per zone.' })
    }
    if (hw.capacityMediaType === 'hdd') {
      add({ code: 'HW_RACK_ALL_FLASH', severity: 'error', factId: 'rack-aware-drives', inHealthCheck: true,
        message: 'Rack aware clusters require all-flash data drives (NVMe or SSD); HDD capacity is not supported.',
        calculation: 'HDD capacity media with rack aware enabled.', threshold: 'NVMe or SSD data drives.' })
    }
    add({ code: 'HW_RACK_NOTES', severity: 'info', factId: 'rack-aware-identity', inHealthCheck: true,
      message: 'Rack aware prerequisites: new deployments only, Active Directory identity only (no local identity with Key Vault), a cloud witness, a dedicated storage network and 1 ms or less round-trip latency between racks.' + (n === 2 ? ' A 1+1 cluster cannot be expanded in this release.' : ''),
      calculation: `${n / 2}+${n / 2} zones.`, threshold: 'See the rack aware requirements on Learn.' })
  }

  if (!(hw.capacityDrivesPerNode >= 1)) {
    add({ code: 'HW_NO_CAPACITY_DRIVES', severity: 'error', factId: 'min-capacity-drives', inHealthCheck: false,
      message: 'At least two capacity drives per node are required.',
      calculation: `${hw.capacityDrivesPerNode} capacity drive(s).`, threshold: '2 or more.' })
  } else if (hw.capacityDrivesPerNode < 2) {
    add({ code: 'HW_MIN_CAPACITY_DRIVES', severity: 'error', factId: 'min-capacity-drives', inHealthCheck: false,
      message: 'Azure Local needs at least 2 capacity drives per node (the all-NVMe and all-SSD minimum); 1 is below the minimum.',
      calculation: '1 capacity drive per node.', threshold: '2 or more.' })
  }

  if (cacheInUse && !single) {
    if (hw.cacheDrivesPerNode < 2) {
      add({ code: 'HW_CACHE_MIN_DRIVES', severity: 'error', factId: 'cache-min-drives', inHealthCheck: true,
        message: `A cache tier needs at least 2 cache drives per node; ${hw.cacheDrivesPerNode} configured.`,
        calculation: `${hw.cacheDrivesPerNode} cache drive(s) per node.`, threshold: '2 or more cache drives.' })
    }
    if (hw.capacityDrivesPerNode < 4) {
      add({ code: 'HW_CACHE_MIN_CAPACITY', severity: 'error', factId: 'cache-min-drives', inHealthCheck: true,
        message: `With a cache tier Azure Local needs at least 4 capacity drives per node (for example 2 NVMe + 4 HDD); ${hw.capacityDrivesPerNode} configured. Without cache, use a single flash type with at least 2 drives.`,
        calculation: `${hw.capacityDrivesPerNode} capacity drive(s) per node with cache.`, threshold: '4 or more capacity drives with a cache tier.' })
    }
  }

  if (hw.capacityMediaType === 'hdd' && !cacheInUse && !single) {
    add({ code: 'HW_HDD_NO_CACHE', severity: 'error', factId: 'hybrid-rules', inHealthCheck: false,
      message: 'All-HDD without a flash cache tier is not supported. Add NVMe or SSD cache drives, or use all-flash capacity.',
      calculation: 'HDD capacity, no cache.', threshold: 'HDD capacity requires an NVMe or SSD cache.' })
  }

  if (cacheInUse && hw.cacheDrivesPerNode > 0 && hw.capacityDrivesPerNode > 0 && hw.capacityDriveSizeTB > 0) {
    const ratio = (hw.cacheDriveSizeTB * hw.cacheDrivesPerNode) / (hw.capacityDriveSizeTB * hw.capacityDrivesPerNode)
    const hybrid = hw.capacityMediaType === 'hdd'
    const floor = hybrid ? 0.15 : 0.05
    if (ratio < floor) {
      add({ code: 'HW_LOW_CACHE_RATIO', severity: 'warning', factId: hybrid ? 'hybrid-rules' : 'no-cache-same-type', inHealthCheck: true,
        message: hybrid
          ? `Cache-to-capacity ratio is ${(ratio * 100).toFixed(1)}%; Learn requires 15% or more for hybrid (HDD) designs.`
          : `Cache-to-capacity ratio is ${(ratio * 100).toFixed(1)}%, below the ~5% starting point Learn suggests for all-flash caching. Performance may be suboptimal.`,
        calculation: `${hw.cacheDrivesPerNode} x ${hw.cacheDriveSizeTB} TB cache / (${hw.capacityDrivesPerNode} x ${hw.capacityDriveSizeTB} TB capacity) = ${(ratio * 100).toFixed(1)}%.`,
        threshold: hybrid ? '15% or more (hybrid requirement).' : 'About 5% or more (guidance).' })
    }
    if (hw.capacityMediaType === 'hdd') {
      if (hw.cacheDriveSizeTB < 0.032) {
        add({ code: 'HW_HYBRID_CACHE_SIZE', severity: 'error', factId: 'hybrid-rules', inHealthCheck: true,
          message: 'Hybrid cache devices must be at least 32 GB.', calculation: `${hw.cacheDriveSizeTB} TB cache drive.`, threshold: '32 GB or more.' })
      }
      if (hw.capacityDrivesPerNode % hw.cacheDrivesPerNode !== 0) {
        add({ code: 'HW_HYBRID_CACHE_MULTIPLE', severity: 'warning', factId: 'hybrid-rules', inHealthCheck: true,
          message: `Capacity drives (${hw.capacityDrivesPerNode}) should be a whole multiple of cache drives (${hw.cacheDrivesPerNode}) so every cache drive binds the same number of capacity drives.`,
          calculation: `${hw.capacityDrivesPerNode} mod ${hw.cacheDrivesPerNode} = ${hw.capacityDrivesPerNode % hw.cacheDrivesPerNode}.`, threshold: 'Whole multiple.' })
      }
    }
  }
  return out
}

/**
 * Validate hardware inputs and return any issues.
 * Mirrors the validation rules embedded in the Excel workbook plus the Azure Local platform
 * rules in facts.ts.
 */
export function validateHardwareInputs(inputs: HardwareInputs): HealthCheckResult {
  const issues: HealthCheckResult['issues'] = platformRuleIssues(inputs).map((r) => ({
    code: r.code,
    severity: r.severity,
    message: r.message,
  }))

  if (inputs.capacityDriveSizeTB <= 0) {
    issues.push({
      code: 'HW_INVALID_CAPACITY_DRIVE_SIZE',
      severity: 'error',
      message: 'Capacity drive size must be greater than 0 TB.',
    })
  }

  if (inputs.coresPerNode < 4) {
    issues.push({
      code: 'HW_LOW_CORE_COUNT',
      severity: 'warning',
      message: 'Fewer than 4 cores per node may limit workload density.',
    })
  }

  if (inputs.memoryPerNodeGB < 32) {
    issues.push({
      code: 'HW_LOW_MEMORY',
      severity: 'warning',
      message: 'Azure Local requires at least 32 GB RAM per machine (ECC); fewer than 32 GB also limits workload density.',
    })
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  const infoCount = issues.filter((i) => i.severity === 'info').length

  return {
    passed: errorCount === 0,
    issues,
    volumeDetails: [],
    totalPoolFootprintTB: 0,
    availablePoolTB: 0,
    utilizationPct: 0,
    errorCount,
    warningCount,
    infoCount,
  }
}
