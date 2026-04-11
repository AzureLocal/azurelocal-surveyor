import type { HardwareInputs, DriveMedia, ResiliencyType, HealthCheckResult } from './types'

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

/**
 * Recommend the safest resiliency type given node count.
 * Azure Local rules:
 *   2 nodes  → 2-way mirror (only option)
 *   3 nodes  → 3-way mirror (only option)
 *   4+ nodes → three-way mirror or dual-parity
 */
export function getRecommendedResiliency(inputs: HardwareInputs): ResiliencyType {
  if (inputs.nodeCount <= 2) return 'two-way-mirror'
  if (inputs.nodeCount === 3) return 'three-way-mirror'
  return 'three-way-mirror' // conservative default; user can override to dual-parity
}

/**
 * Validate hardware inputs and return any issues.
 * Mirrors the validation rules embedded in the Excel workbook.
 */
export function validateHardwareInputs(inputs: HardwareInputs): HealthCheckResult {
  const issues: HealthCheckResult['issues'] = []

  if (inputs.nodeCount < 2) {
    issues.push({
      code: 'HW_MIN_NODES',
      severity: 'error',
      message: 'Azure Local requires a minimum of 2 nodes.',
    })
  }

  if (inputs.nodeCount > 16) {
    issues.push({
      code: 'HW_MAX_NODES',
      severity: 'warning',
      message: 'Node counts above 16 are uncommon; validate with your OEM.',
    })
  }

  if (inputs.capacityDrivesPerNode < 1) {
    issues.push({
      code: 'HW_NO_CAPACITY_DRIVES',
      severity: 'error',
      message: 'At least one capacity drive per node is required.',
    })
  }

  if (inputs.capacityDriveSizeTB <= 0) {
    issues.push({
      code: 'HW_INVALID_CAPACITY_DRIVE_SIZE',
      severity: 'error',
      message: 'Capacity drive size must be greater than 0 TB.',
    })
  }

  // Cache ratio check: cache should be roughly 10% of raw capacity for NVMe+HDD configs
  if (inputs.cacheMediaType !== 'none' && inputs.cacheDrivesPerNode > 0) {
    const rawCapacityTB = inputs.capacityDriveSizeTB * inputs.capacityDrivesPerNode
    const rawCacheTB = inputs.cacheDriveSizeTB * inputs.cacheDrivesPerNode
    const cacheRatio = rawCacheTB / rawCapacityTB
    if (cacheRatio < 0.05) {
      issues.push({
        code: 'HW_LOW_CACHE_RATIO',
        severity: 'warning',
        message: `Cache-to-capacity ratio is ${(cacheRatio * 100).toFixed(1)}% — below the recommended 10%. Performance may be suboptimal.`,
      })
    }
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
      message: 'Less than 32 GB RAM per node may limit workload density.',
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
