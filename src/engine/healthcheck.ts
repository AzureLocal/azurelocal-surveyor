import type {
  HardwareInputs,
  AdvancedSettings,
  VolumeSpec,
  CapacityResult,
  ComputeResult,
  WorkloadSummaryResult,
  HealthCheckResult,
  HealthIssue,
  VolumeHealthDetail,
  ResiliencyType,
} from './types'
import { getResiliencyFactor } from './capacity'

/**
 * Validate the full planned configuration and return all health issues.
 *
 * Mirrors the "Volume Health Check" sheet (52 formulas) plus additional
 * cross-sheet validation rules.
 */
export function runHealthCheck(params: {
  hardware: HardwareInputs
  settings: AdvancedSettings
  volumes: VolumeSpec[]
  capacity: CapacityResult
  compute: ComputeResult
  workloadSummary: WorkloadSummaryResult
}): HealthCheckResult {
  const issues: HealthIssue[] = []
  const { hardware, volumes, capacity, compute, workloadSummary } = params

  // ── Resiliency rules ────────────────────────────────────────────────────────

  for (const vol of volumes) {
    if (!isResiliencyAllowed(vol.resiliency, hardware.nodeCount)) {
      issues.push({
        code: 'HC_RESILIENCY_NODE_COUNT',
        severity: 'error',
        message: `Volume "${vol.name}": ${formatResiliency(vol.resiliency)} requires ${minNodesForResiliency(vol.resiliency)} nodes; cluster has ${hardware.nodeCount}.`,
      })
    }
  }

  // ── Per-volume 64 TB S2D hard limit (#60) ──────────────────────────────────

  for (const vol of volumes) {
    if (vol.plannedSizeTB > 64) {
      issues.push({
        code: 'HC_VOLUME_EXCEEDS_64TB',
        severity: 'error',
        message: `Volume "${vol.name}" is ${vol.plannedSizeTB} TB — exceeds the 64 TB S2D maximum. This volume cannot be created in WAC or PowerShell.`,
      })
    }
  }

  // ── Pool / capacity utilization ─────────────────────────────────────────────

  const totalVolumeTB = volumes.reduce((s, v) => s + v.plannedSizeTB, 0)
  const utilizationPct = capacity.effectiveUsableTB > 0
    ? (totalVolumeTB / capacity.effectiveUsableTB) * 100
    : 0

  if (utilizationPct > 100) {
    issues.push({
      code: 'HC_OVER_CAPACITY',
      severity: 'error',
      message: `Planned volumes (${totalVolumeTB.toFixed(2)} TB) exceed effective usable capacity (${capacity.effectiveUsableTB.toFixed(2)} TB).`,
    })
  } else if (utilizationPct > 70) {
    // Excel workbook warns at 70% — S2D needs rebuild headroom (#58)
    issues.push({
      code: 'HC_HIGH_UTILIZATION',
      severity: 'warning',
      message: `Storage utilization is ${utilizationPct.toFixed(1)}%. Microsoft recommends staying below 70% to maintain rebuild headroom after a drive failure.`,
    })
  }

  // ── Volume count: recommend multiples of node count (#61) ──────────────────

  const activeVolumeCount = volumes.filter((v) => v.plannedSizeTB > 0).length
  if (activeVolumeCount > 0 && hardware.nodeCount > 1 && activeVolumeCount % hardware.nodeCount !== 0) {
    const nextMultiple = Math.ceil(activeVolumeCount / hardware.nodeCount) * hardware.nodeCount
    issues.push({
      code: 'HC_VOLUME_COUNT_NOT_MULTIPLE',
      severity: 'info',
      message: `${activeVolumeCount} volumes on a ${hardware.nodeCount}-node cluster is not a multiple of ${hardware.nodeCount}. Consider ${nextMultiple} volumes for balanced slab distribution across nodes.`,
    })
  }

  // ── Compute: vCPU ──────────────────────────────────────────────────────────

  if (workloadSummary.totalVCpus > compute.usableVCpus) {
    issues.push({
      code: 'HC_VCPU_OVER_SUBSCRIBED',
      severity: 'error',
      message: `Workloads require ${workloadSummary.totalVCpus} vCPUs but only ${compute.usableVCpus} are available after system reservation.`,
    })
  } else if (workloadSummary.totalVCpus > compute.usableVCpus * 0.9) {
    issues.push({
      code: 'HC_VCPU_HIGH',
      severity: 'warning',
      message: `vCPU utilization is above 90% (${workloadSummary.totalVCpus}/${compute.usableVCpus}). Leave headroom for burst workloads.`,
    })
  }

  // ── Compute: memory ────────────────────────────────────────────────────────

  if (workloadSummary.totalMemoryGB > compute.usableMemoryGB) {
    issues.push({
      code: 'HC_MEMORY_EXCEEDED',
      severity: 'error',
      message: `Workloads require ${workloadSummary.totalMemoryGB} GB RAM but only ${compute.usableMemoryGB} GB is available after system reservation.`,
    })
  } else if (workloadSummary.totalMemoryGB > compute.usableMemoryGB * 0.9) {
    issues.push({
      code: 'HC_MEMORY_HIGH',
      severity: 'warning',
      message: `Memory utilization is above 90% (${workloadSummary.totalMemoryGB} GB/${compute.usableMemoryGB} GB).`,
    })
  }

  // ── Thin provisioning over-commit risk (#8) ────────────────────────────────

  if (hardware.volumeProvisioning === 'thin') {
    issues.push({
      code: 'HC_THIN_PROVISIONING',
      severity: 'warning',
      message: 'Thin provisioning is enabled. Monitor pool space regularly — if logical volume sizes exceed available pool capacity, VMs will crash without warning. Not recommended for production workloads.',
    })
  }

  // ── Sub-4-node dual-parity restriction ────────────────────────────────────

  if (hardware.nodeCount < 4) {
    const dpVolumes = volumes.filter((v) => v.resiliency === 'dual-parity')
    if (dpVolumes.length > 0) {
      issues.push({
        code: 'HC_DUAL_PARITY_REQUIRES_4_NODES',
        severity: 'error',
        message: `Dual Parity requires at least 4 nodes. Affected volumes: ${dpVolumes.map((v) => v.name).join(', ')}.`,
      })
    }
  }

  // ── Minimum node count (#20 expansion) ────────────────────────────────────

  if (hardware.nodeCount < 2) {
    issues.push({
      code: 'HC_MIN_NODES',
      severity: 'error',
      message: 'Azure Local requires at least 2 nodes. Single-node deployments are not supported with S2D.',
    })
  } else if (hardware.nodeCount === 2) {
    issues.push({
      code: 'HC_TWO_NODE_ADVISORY',
      severity: 'info',
      message: '2-node cluster: only Two-Way Mirror and Nested Two-Way Mirror resiliency are supported. Consider 3+ nodes for Three-Way Mirror protection in production.',
    })
  }

  // ── Drive count per node ───────────────────────────────────────────────────

  if (hardware.capacityDrivesPerNode < 2) {
    issues.push({
      code: 'HC_LOW_DRIVE_COUNT',
      severity: 'error',
      message: `Only ${hardware.capacityDrivesPerNode} capacity drive(s) per node. S2D requires at least 2 capacity drives per node for pool participation.`,
    })
  } else if (hardware.capacityDrivesPerNode < 4) {
    issues.push({
      code: 'HC_FEW_DRIVES',
      severity: 'warning',
      message: `${hardware.capacityDrivesPerNode} capacity drives per node is below the recommended minimum of 4 for balanced slab distribution. Consider more drives per node.`,
    })
  }

  // ── Drive symmetry (#20 expansion) ────────────────────────────────────────
  // All nodes should have the same drive count and size. Since this tool only
  // has one drive config, we can only check for obvious misconfigurations.
  if (hardware.capacityDriveSizeTB <= 0) {
    issues.push({
      code: 'HC_INVALID_DRIVE_SIZE',
      severity: 'error',
      message: 'Capacity drive size must be greater than 0 TB.',
    })
  }

  // ── Memory adequacy (#20 expansion) ───────────────────────────────────────

  if (hardware.memoryPerNodeGB < 64) {
    issues.push({
      code: 'HC_LOW_MEMORY',
      severity: 'warning',
      message: `${hardware.memoryPerNodeGB} GB RAM per node is below the recommended minimum of 64 GB for Azure Local production deployments.`,
    })
  }

  // ── CPU core count (#20 expansion) ────────────────────────────────────────

  if (hardware.coresPerNode < 8) {
    issues.push({
      code: 'HC_LOW_CORES',
      severity: 'warning',
      message: `${hardware.coresPerNode} cores per node is low. Azure Local production workloads typically require at least 16 physical cores per node.`,
    })
  }

  // ── All-Flash drive type check (#20 expansion) ─────────────────────────────

  if (hardware.capacityMediaType === 'hdd' && hardware.cacheMediaType === 'none') {
    issues.push({
      code: 'HC_HDD_NO_CACHE',
      severity: 'warning',
      message: 'All-HDD configuration without a cache tier will have significantly lower IOPS than recommended for VM workloads. Add NVMe or SSD cache drives.',
    })
  }

  // ── No workload vs capacity mismatch ─────────────────────────────────────

  if (volumes.length > 0 && workloadSummary.totalStorageTB === 0) {
    issues.push({
      code: 'HC_VOLUMES_NO_WORKLOADS',
      severity: 'info',
      message: 'Volumes are planned but no workloads are enabled. Enable workloads on the Workloads page to validate storage demand against planned volumes.',
    })
  }

  // #77: compute per-volume health details
  const TB_TO_TiB = 1e12 / Math.pow(1024, 4)
  const volumeDetails: VolumeHealthDetail[] = volumes.map((v) => {
    const factor = getResiliencyFactor(v.resiliency, hardware.nodeCount)
    const plannedSizeTiB = Math.round(v.plannedSizeTB * TB_TO_TiB * 100) / 100
    const poolFootprintTB = Math.round((v.plannedSizeTB / factor) * 100) / 100
    let status: 'pass' | 'fail' = 'pass'
    let failReason: string | undefined
    if (v.plannedSizeTB > 64) {
      status = 'fail'
      failReason = 'Exceeds 64 TB S2D limit'
    } else if (!isResiliencyAllowed(v.resiliency, hardware.nodeCount)) {
      status = 'fail'
      failReason = `${formatResiliency(v.resiliency)} requires ${minNodesForResiliency(v.resiliency)}+ nodes`
    }
    return { name: v.name, resiliency: v.resiliency, plannedSizeTiB, poolFootprintTB, status, failReason }
  })

  const totalPoolFootprintTB = Math.round(volumeDetails.reduce((s, v) => s + v.poolFootprintTB, 0) * 100) / 100
  const availablePoolTB = capacity.availableForVolumesTB

  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  const infoCount = issues.filter((i) => i.severity === 'info').length

  return {
    passed: errorCount === 0,
    issues,
    volumeDetails,
    totalPoolFootprintTB,
    availablePoolTB,
    utilizationPct: Math.round(utilizationPct * 10) / 10,
    errorCount,
    warningCount,
    infoCount,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isResiliencyAllowed(resiliency: ResiliencyType, nodeCount: number): boolean {
  switch (resiliency) {
    case 'two-way-mirror':    return nodeCount >= 2
    case 'three-way-mirror':  return nodeCount >= 3
    case 'dual-parity':       return nodeCount >= 4
    case 'nested-two-way':    return nodeCount >= 2
  }
}

function minNodesForResiliency(resiliency: ResiliencyType): number {
  switch (resiliency) {
    case 'two-way-mirror':    return 2
    case 'three-way-mirror':  return 3
    case 'dual-parity':       return 4
    case 'nested-two-way':    return 2
  }
}

function formatResiliency(r: ResiliencyType): string {
  const labels: Record<ResiliencyType, string> = {
    'two-way-mirror':   'Two-Way Mirror',
    'three-way-mirror': 'Three-Way Mirror',
    'dual-parity':      'Dual Parity',
    'nested-two-way':   'Nested Two-Way Mirror',
  }
  return labels[r]
}
