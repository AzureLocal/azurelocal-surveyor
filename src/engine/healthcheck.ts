import type {
  HardwareInputs,
  AdvancedSettings,
  VolumeSpec,
  CapacityResult,
  ComputeResult,
  WorkloadSummaryResult,
  HealthCheckResult,
  HealthDetail,
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
  const { hardware, volumes, capacity, workloadSummary } = params
  const addIssue = (issue: HealthIssue) => issues.push(issue)

  // ── Resiliency rules ────────────────────────────────────────────────────────

  for (const vol of volumes) {
    if (!isResiliencyAllowed(vol.resiliency, hardware.nodeCount)) {
      addIssue({
        code: 'HC_RESILIENCY_NODE_COUNT',
        severity: 'error',
        message: `Volume "${vol.name}": ${formatResiliency(vol.resiliency)} requires ${minNodesForResiliency(vol.resiliency)} nodes; cluster has ${hardware.nodeCount}.`,
        details: [
          detail({
            label: 'Node count vs resiliency',
            status: 'fail',
            calculation: `${hardware.nodeCount} cluster node(s) selected with ${formatResiliency(vol.resiliency)} on volume "${vol.name}".`,
            threshold: `${formatResiliency(vol.resiliency)} requires at least ${minNodesForResiliency(vol.resiliency)} node(s).`,
            outcome: `${formatResiliency(vol.resiliency)} is not supported on the current cluster size.`,
            ruleSource: 'Azure Local / Storage Spaces Direct resiliency requirements',
          }),
        ],
      })
    }
  }

  // ── Per-volume 64 TB S2D hard limit (#60) ──────────────────────────────────

  for (const vol of volumes) {
    if (vol.plannedSizeTB > 64) {
      addIssue({
        code: 'HC_VOLUME_EXCEEDS_64TB',
        severity: 'error',
        message: `Volume "${vol.name}" is ${vol.plannedSizeTB} TB — exceeds the 64 TB S2D maximum. This volume cannot be created in WAC or PowerShell.`,
        details: [
          detail({
            label: 'Per-volume size limit',
            status: 'fail',
            calculation: `${vol.plannedSizeTB.toFixed(2)} TB requested for volume "${vol.name}".`,
            threshold: 'Each Azure Local volume must be 64 TB or smaller.',
            outcome: `The requested size exceeds the supported 64 TB limit by ${(vol.plannedSizeTB - 64).toFixed(2)} TB.`,
            ruleSource: 'Windows Admin Center / New-Volume practical limit on Azure Local',
          }),
        ],
      })
    }
  }

  // ── Pool / capacity utilization ─────────────────────────────────────────────

  const totalVolumeTB = volumes.reduce((s, v) => s + v.plannedSizeTB, 0)
  const hasThinVolumes = volumes.some((v) => v.provisioning === 'thin')
  // Pool-footprint based utilization (12G/12I): pool footprint / available raw pool
  const aggPoolFootprintTB = volumes.reduce((sum, v) => {
    const factor = getResiliencyFactor(v.resiliency, hardware.nodeCount)
    return sum + v.plannedSizeTB / factor
  }, 0)
  const fixedPoolFootprintTB = volumes
    .filter((v) => v.provisioning === 'fixed')
    .reduce((sum, v) => {
      const factor = getResiliencyFactor(v.resiliency, hardware.nodeCount)
      return sum + v.plannedSizeTB / factor
    }, 0)
  const utilizationPct = capacity.availableForVolumesTB > 0
    ? (aggPoolFootprintTB / capacity.availableForVolumesTB) * 100
    : 0

  // Fixed volumes must physically fit in the pool (12H)
  if (fixedPoolFootprintTB > capacity.availableForVolumesTB) {
    addIssue({
      code: 'HC_OVER_CAPACITY',
      severity: 'error',
      message: `Fixed volumes require ${fixedPoolFootprintTB.toFixed(2)} TB pool footprint but only ${capacity.availableForVolumesTB.toFixed(2)} TB is available.`,
      details: [
        detail({
          label: 'Fixed volume pool capacity',
          status: 'fail',
          calculation: `${fixedPoolFootprintTB.toFixed(2)} TB pool footprint from fixed volumes vs ${capacity.availableForVolumesTB.toFixed(2)} TB available pool.`,
          threshold: 'Fixed volumes\' pool footprint must stay at or below available raw pool space.',
          outcome: `Fixed volumes exceed available pool by ${(fixedPoolFootprintTB - capacity.availableForVolumesTB).toFixed(2)} TB.`,
          ruleSource: 'Azure Local volume pool capacity — fixed provisioning requires physical space up front',
        }),
      ],
    })
  } else if (utilizationPct > 70) {
    // S2D needs rebuild headroom (#58)
    addIssue({
      code: 'HC_HIGH_UTILIZATION',
      severity: 'warning',
      message: `Pool utilization is ${utilizationPct.toFixed(1)}%. Microsoft recommends staying below 70% to maintain rebuild headroom after a drive failure.`,
      details: [
        detail({
          label: 'Rebuild headroom guardrail',
          status: 'warning',
          calculation: `${aggPoolFootprintTB.toFixed(2)} TB pool footprint ÷ ${capacity.availableForVolumesTB.toFixed(2)} TB available pool = ${utilizationPct.toFixed(1)}% utilization.`,
          threshold: 'Stay at or below 70% pool utilization for healthier rebuild headroom.',
          outcome: `The plan is ${(utilizationPct - 70).toFixed(1)} percentage points above the recommended headroom threshold.`,
          ruleSource: 'Microsoft Azure Local rebuild-headroom guidance',
        }),
      ],
    })
  }

  // Thin over-provisioning INFO check (12H): logical allocation can exceed physical capacity
  if (hasThinVolumes && totalVolumeTB > capacity.effectiveUsableTB) {
    addIssue({
      code: 'HC_THIN_OVER_PROVISIONED',
      severity: 'info',
      message: `You are thin-provisioned by ${(totalVolumeTB - capacity.effectiveUsableTB).toFixed(2)} TB over physical capacity. This is expected with thin provisioning but requires monitoring.`,
      details: [
        detail({
          label: 'Thin provisioning logical over-subscription',
          status: 'info',
          calculation: `${totalVolumeTB.toFixed(2)} TB logical planned vs ${capacity.effectiveUsableTB.toFixed(2)} TB effective usable physical capacity.`,
          threshold: 'Thin volumes do not consume physical space immediately; logical allocation can exceed physical capacity.',
          outcome: `Logical volumes exceed physical capacity by ${(totalVolumeTB - capacity.effectiveUsableTB).toFixed(2)} TB. Monitor actual consumption to prevent running out of physical space.`,
          ruleSource: 'Storage Spaces Direct thin provisioning behavior',
        }),
      ],
    })
  }

  // ── Volume count: recommend multiples of node count (#61) ──────────────────

  const activeVolumeCount = volumes.filter((v) => v.plannedSizeTB > 0).length
  if (activeVolumeCount > 0 && hardware.nodeCount > 1 && activeVolumeCount % hardware.nodeCount !== 0) {
    const nextMultiple = Math.ceil(activeVolumeCount / hardware.nodeCount) * hardware.nodeCount
    addIssue({
      code: 'HC_VOLUME_COUNT_NOT_MULTIPLE',
      severity: 'info',
      message: `${activeVolumeCount} volumes on a ${hardware.nodeCount}-node cluster is not a multiple of ${hardware.nodeCount}. Consider ${nextMultiple} volumes for balanced slab distribution across nodes.`,
      details: [
        detail({
          label: 'Balanced slab distribution check',
          status: 'info',
          calculation: `${activeVolumeCount} active volume(s) across ${hardware.nodeCount} node(s).`,
          threshold: `A balanced count is typically a multiple of ${hardware.nodeCount}; next multiple is ${nextMultiple}.`,
          outcome: 'The plan is still valid, but a node-aligned volume count generally distributes slabs more evenly.',
          ruleSource: 'Operational best practice for balanced slab distribution',
        }),
      ],
    })
  }

  // ── Sub-4-node dual-parity restriction ────────────────────────────────────
  // Note: compute checks (HC_VCPU_*, HC_MEMORY_*) moved to Phase 13 Compute Report.

  if (hardware.nodeCount < 4) {
    const dpVolumes = volumes.filter((v) => v.resiliency === 'dual-parity')
    if (dpVolumes.length > 0) {
      addIssue({
        code: 'HC_DUAL_PARITY_REQUIRES_4_NODES',
        severity: 'error',
        message: `Dual Parity requires at least 4 nodes. Affected volumes: ${dpVolumes.map((v) => v.name).join(', ')}.`,
        details: [
          detail({
            label: 'Dual parity minimum nodes',
            status: 'fail',
            calculation: `${hardware.nodeCount} cluster node(s) with dual-parity volumes: ${dpVolumes.map((v) => v.name).join(', ')}.`,
            threshold: 'Dual parity requires at least 4 nodes.',
            outcome: 'The cluster does not meet the minimum node count for dual parity.',
            ruleSource: 'Azure Local / Storage Spaces Direct parity resiliency requirements',
          }),
        ],
      })
    }
  }

  // ── Minimum node count (#20 expansion) ────────────────────────────────────

  if (hardware.nodeCount < 2) {
    addIssue({
      code: 'HC_MIN_NODES',
      severity: 'error',
      message: 'Azure Local requires at least 2 nodes. Single-node deployments are not supported with S2D.',
      details: [
        detail({
          label: 'Minimum Azure Local node count',
          status: 'fail',
          calculation: `${hardware.nodeCount} node(s) configured.`,
          threshold: 'Azure Local with S2D requires at least 2 nodes.',
          outcome: 'The selected cluster size is below the supported minimum.',
          ruleSource: 'Azure Local minimum deployment requirement',
        }),
      ],
    })
  } else if (hardware.nodeCount === 2) {
    addIssue({
      code: 'HC_TWO_NODE_ADVISORY',
      severity: 'info',
      message: '2-node cluster: only Two-Way Mirror and Nested Two-Way Mirror resiliency are supported. Consider 3+ nodes for Three-Way Mirror protection in production.',
      details: [
        detail({
          label: 'Two-node resiliency advisory',
          status: 'info',
          calculation: '2-node cluster selected.',
          threshold: 'Three-way mirror requires 3 nodes; dual parity requires 4 nodes.',
          outcome: 'The configuration is supported, but production resiliency options are limited.',
          ruleSource: 'Azure Local resiliency support matrix',
        }),
      ],
    })
  }

  // ── Drive count per node ───────────────────────────────────────────────────

  if (hardware.capacityDrivesPerNode < 2) {
    addIssue({
      code: 'HC_LOW_DRIVE_COUNT',
      severity: 'error',
      message: `Only ${hardware.capacityDrivesPerNode} capacity drive(s) per node. S2D requires at least 2 capacity drives per node for pool participation.`,
      details: [
        detail({
          label: 'Minimum capacity drives per node',
          status: 'fail',
          calculation: `${hardware.capacityDrivesPerNode} capacity drive(s) per node configured.`,
          threshold: 'At least 2 capacity drives per node are required for S2D pool participation.',
          outcome: 'The drive count is below the supported minimum.',
          ruleSource: 'Storage Spaces Direct minimum drive-count requirement',
        }),
      ],
    })
  } else if (hardware.capacityDrivesPerNode < 4) {
    addIssue({
      code: 'HC_FEW_DRIVES',
      severity: 'warning',
      message: `${hardware.capacityDrivesPerNode} capacity drives per node is below the recommended minimum of 4 for balanced slab distribution. Consider more drives per node.`,
      details: [
        detail({
          label: 'Recommended drive count per node',
          status: 'warning',
          calculation: `${hardware.capacityDrivesPerNode} capacity drive(s) per node configured.`,
          threshold: '4 or more capacity drives per node is the preferred baseline for better balance and reserve behavior.',
          outcome: 'The configuration is valid, but storage distribution and reserve behavior may be less balanced.',
          ruleSource: 'Operational best practice for S2D slab balance',
        }),
      ],
    })
  }

  // ── Drive symmetry (#20 expansion) ────────────────────────────────────────
  // All nodes should have the same drive count and size. Since this tool only
  // has one drive config, we can only check for obvious misconfigurations.
  if (hardware.capacityDriveSizeTB <= 0) {
    addIssue({
      code: 'HC_INVALID_DRIVE_SIZE',
      severity: 'error',
      message: 'Capacity drive size must be greater than 0 TB.',
      details: [
        detail({
          label: 'Capacity drive size',
          status: 'fail',
          calculation: `${hardware.capacityDriveSizeTB} TB configured for capacity drive size.`,
          threshold: 'Capacity drive size must be greater than 0 TB.',
          outcome: 'The hardware profile cannot be evaluated with a non-positive drive size.',
          ruleSource: 'Input validation',
        }),
      ],
    })
  }

  // ── Memory adequacy (#20 expansion) ───────────────────────────────────────

  if (hardware.memoryPerNodeGB < 64) {
    addIssue({
      code: 'HC_LOW_MEMORY',
      severity: 'warning',
      message: `${hardware.memoryPerNodeGB} GB RAM per node is below the recommended minimum of 64 GB for Azure Local production deployments.`,
      details: [
        detail({
          label: 'Memory per node baseline',
          status: 'warning',
          calculation: `${hardware.memoryPerNodeGB} GB RAM configured per node.`,
          threshold: '64 GB RAM per node is the recommended floor for production Azure Local deployments.',
          outcome: 'The cluster can still run, but production headroom is likely constrained.',
          ruleSource: 'Azure Local production sizing baseline',
        }),
      ],
    })
  }

  // ── CPU core count (#20 expansion) ────────────────────────────────────────

  if (hardware.coresPerNode < 8) {
    addIssue({
      code: 'HC_LOW_CORES',
      severity: 'warning',
      message: `${hardware.coresPerNode} cores per node is low. Azure Local production workloads typically require at least 16 physical cores per node.`,
      details: [
        detail({
          label: 'CPU cores per node baseline',
          status: 'warning',
          calculation: `${hardware.coresPerNode} physical cores configured per node.`,
          threshold: 'Production Azure Local deployments typically target at least 16 physical cores per node.',
          outcome: 'The cluster may be valid for light usage, but workload density will be constrained.',
          ruleSource: 'Azure Local production sizing baseline',
        }),
      ],
    })
  }

  // ── All-Flash drive type check (#20 expansion) ─────────────────────────────

  if (hardware.capacityMediaType === 'hdd' && hardware.cacheMediaType === 'none') {
    addIssue({
      code: 'HC_HDD_NO_CACHE',
      severity: 'warning',
      message: 'All-HDD configuration without a cache tier will have significantly lower IOPS than recommended for VM workloads. Add NVMe or SSD cache drives.',
      details: [
        detail({
          label: 'Cache tier check',
          status: 'warning',
          calculation: `Capacity media is ${hardware.capacityMediaType.toUpperCase()} and cache media is ${hardware.cacheMediaType}.`,
          threshold: 'HDD capacity tiers should be paired with an SSD or NVMe cache tier for VM workloads.',
          outcome: 'The design will work, but storage performance will fall well below modern VM workload expectations.',
          ruleSource: 'Storage tiering best practice for VM-centric Azure Local clusters',
        }),
      ],
    })
  }

  // ── No workload vs capacity mismatch ─────────────────────────────────────

  if (volumes.length > 0 && workloadSummary.totalStorageTB === 0) {
    addIssue({
      code: 'HC_VOLUMES_NO_WORKLOADS',
      severity: 'info',
      message: 'Volumes are planned but no workloads are enabled. Enable workloads on the Workloads page to validate storage demand against planned volumes.',
      details: [
        detail({
          label: 'Volume plan without workload demand',
          status: 'info',
          calculation: `${volumes.length} planned volume(s) with ${workloadSummary.totalStorageTB.toFixed(2)} TB of workload demand.`,
          threshold: 'Workload-driven validation is strongest when at least one workload contributes storage demand.',
          outcome: 'The volume plan is valid, but the tool cannot compare it against a modeled workload footprint yet.',
          ruleSource: 'Surveyor workload-vs-volume validation model',
        }),
      ],
    })
  }

  // #77: compute per-volume health details
  const TB_TO_TiB = 1e12 / Math.pow(1024, 4)
  const totalPoolFootprintTB = Math.round(volumes.reduce((sum, volume) => {
    const factor = getResiliencyFactor(volume.resiliency, hardware.nodeCount)
    return sum + (volume.plannedSizeTB / factor)
  }, 0) * 100) / 100
  const availablePoolTB = capacity.availableForVolumesTB
  const volumeDetails: VolumeHealthDetail[] = volumes.map((v) => {
    const factor = getResiliencyFactor(v.resiliency, hardware.nodeCount)
    const plannedSizeTiB = Math.round(v.plannedSizeTB * TB_TO_TiB * 100) / 100
    const poolFootprintTB = Math.round((v.plannedSizeTB / factor) * 100) / 100
    const nodeCountAllowed = isResiliencyAllowed(v.resiliency, hardware.nodeCount)
    const poolCheckStatus = totalPoolFootprintTB > availablePoolTB ? 'fail' : utilizationPct > 70 ? 'warning' : 'pass'
    const checks: HealthDetail[] = [
      detail({
        label: 'Per-volume size limit',
        status: v.plannedSizeTB > 64 ? 'fail' : 'pass',
        calculation: `${v.plannedSizeTB.toFixed(2)} TB planned for volume "${v.name}" (${plannedSizeTiB.toFixed(2)} TiB in WAC terms).`,
        threshold: 'Each Azure Local volume must stay at or below 64 TB.',
        outcome: v.plannedSizeTB > 64
          ? `The requested size exceeds the 64 TB limit by ${(v.plannedSizeTB - 64).toFixed(2)} TB.`
          : 'The planned size stays within the supported per-volume limit.',
        ruleSource: 'Windows Admin Center / New-Volume practical limit on Azure Local',
      }),
      detail({
        label: 'Resiliency node requirement',
        status: nodeCountAllowed ? 'pass' : 'fail',
        calculation: `${hardware.nodeCount} cluster node(s) selected with ${formatResiliency(v.resiliency)}.`,
        threshold: `${formatResiliency(v.resiliency)} requires at least ${minNodesForResiliency(v.resiliency)} node(s).`,
        outcome: nodeCountAllowed
          ? 'The selected cluster size supports this resiliency mode.'
          : 'The selected cluster size does not support this resiliency mode.',
        ruleSource: 'Azure Local / Storage Spaces Direct resiliency requirements',
      }),
      detail({
        label: 'Pool footprint for this volume',
        status: poolCheckStatus,
        calculation: `${v.plannedSizeTB.toFixed(2)} TB logical ÷ ${factor.toFixed(2)} efficiency = ${poolFootprintTB.toFixed(2)} TB pool footprint. Full plan footprint is ${totalPoolFootprintTB.toFixed(2)} TB.`,
        threshold: `${availablePoolTB.toFixed(2)} TB is available for Azure Local volumes before the effective-usable guardrail is exceeded.`,
        outcome: poolCheckStatus === 'fail'
          ? `The full plan exceeds available pool space by ${(totalPoolFootprintTB - availablePoolTB).toFixed(2)} TB.`
          : poolCheckStatus === 'warning'
            ? `The plan still fits, but total utilization is ${utilizationPct.toFixed(1)}%, which is above the 70% rebuild-headroom recommendation.`
            : 'The full plan fits within available pool space and stays inside the rebuild-headroom guardrail.',
        ruleSource: 'Azure Local available volume pool and rebuild-headroom guidance',
      }),
    ]
    let status: 'pass' | 'fail' = 'pass'
    let failReason: string | undefined
    if (v.plannedSizeTB > 64) {
      status = 'fail'
      failReason = 'Exceeds 64 TB S2D limit'
    } else if (!nodeCountAllowed) {
      status = 'fail'
      failReason = `${formatResiliency(v.resiliency)} requires ${minNodesForResiliency(v.resiliency)}+ nodes`
    }
    return { name: v.name, resiliency: v.resiliency, plannedSizeTiB, poolFootprintTB, status, failReason, checks }
  })

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

// ─── Compute Health Check (Phase 13D) ────────────────────────────────────────
// Separate from runHealthCheck so the Compute Report tab can render these
// without re-running all volume checks. Checks were removed from runHealthCheck
// in Phase 12H and now live here exclusively.

export function runComputeHealthCheck(params: {
  compute: ComputeResult
  totalVCpus: number
  totalMemoryGB: number
}): HealthIssue[] {
  const { compute, totalVCpus, totalMemoryGB } = params
  const issues: HealthIssue[] = []
  if (totalVCpus === 0 && totalMemoryGB === 0) return issues

  const vCpuPct = compute.usableVCpus > 0 ? (totalVCpus / compute.usableVCpus) * 100 : 0
  const memPct  = compute.usableMemoryGB > 0 ? (totalMemoryGB / compute.usableMemoryGB) * 100 : 0

  if (totalVCpus > compute.usableVCpus) {
    issues.push({
      code: 'HC_VCPU_OVER_SUBSCRIBED',
      severity: 'error',
      message: `Workloads require ${totalVCpus} vCPUs but the cluster provides only ${compute.usableVCpus} usable vCPUs (${vCpuPct.toFixed(1)}% utilization).`,
      details: [
        detail({
          label: 'vCPU capacity check',
          status: 'fail',
          calculation: `${totalVCpus} vCPUs required ÷ ${compute.usableVCpus} usable vCPUs = ${vCpuPct.toFixed(1)}% utilization.`,
          threshold: 'Total workload vCPU demand must not exceed cluster usable vCPUs.',
          outcome: `The plan exceeds vCPU capacity by ${totalVCpus - compute.usableVCpus} vCPUs. Add nodes, enable hyperthreading, or reduce workload density.`,
          ruleSource: 'Azure Local compute capacity planning',
        }),
      ],
    })
  } else if (vCpuPct > 80) {
    issues.push({
      code: 'HC_VCPU_HIGH',
      severity: 'warning',
      message: `Workloads consume ${vCpuPct.toFixed(1)}% of usable vCPUs (${totalVCpus} of ${compute.usableVCpus}). Consider leaving at least 20% headroom for burst and OS overhead.`,
      details: [
        detail({
          label: 'vCPU utilization headroom',
          status: 'warning',
          calculation: `${totalVCpus} vCPUs required ÷ ${compute.usableVCpus} usable vCPUs = ${vCpuPct.toFixed(1)}% utilization.`,
          threshold: 'Stay at or below 80% vCPU utilization for burst headroom.',
          outcome: `vCPU utilization is ${(vCpuPct - 80).toFixed(1)} percentage points above the 80% headroom guideline.`,
          ruleSource: 'Azure Local compute headroom best practice',
        }),
      ],
    })
  }

  if (totalMemoryGB > compute.usableMemoryGB) {
    issues.push({
      code: 'HC_MEMORY_EXCEEDED',
      severity: 'error',
      message: `Workloads require ${totalMemoryGB} GB RAM but the cluster provides only ${compute.usableMemoryGB} GB usable memory (${memPct.toFixed(1)}% utilization).`,
      details: [
        detail({
          label: 'Memory capacity check',
          status: 'fail',
          calculation: `${totalMemoryGB} GB required ÷ ${compute.usableMemoryGB} GB usable = ${memPct.toFixed(1)}% utilization.`,
          threshold: 'Total workload memory demand must not exceed cluster usable memory.',
          outcome: `The plan exceeds memory capacity by ${totalMemoryGB - compute.usableMemoryGB} GB. Add nodes or increase per-node RAM.`,
          ruleSource: 'Azure Local compute capacity planning',
        }),
      ],
    })
  } else if (memPct > 80) {
    issues.push({
      code: 'HC_MEMORY_HIGH',
      severity: 'warning',
      message: `Workloads consume ${memPct.toFixed(1)}% of usable memory (${totalMemoryGB} of ${compute.usableMemoryGB} GB). Consider leaving at least 20% headroom for burst and OS overhead.`,
      details: [
        detail({
          label: 'Memory utilization headroom',
          status: 'warning',
          calculation: `${totalMemoryGB} GB required ÷ ${compute.usableMemoryGB} GB usable = ${memPct.toFixed(1)}% utilization.`,
          threshold: 'Stay at or below 80% memory utilization for burst headroom.',
          outcome: `Memory utilization is ${(memPct - 80).toFixed(1)} percentage points above the 80% headroom guideline.`,
          ruleSource: 'Azure Local compute headroom best practice',
        }),
      ],
    })
  }

  return issues
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

function detail(input: HealthDetail): HealthDetail {
  return input
}
