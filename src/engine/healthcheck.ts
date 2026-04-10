import type {
  HardwareInputs,
  AdvancedSettings,
  VolumeSpec,
  CapacityResult,
  ComputeResult,
  WorkloadSummaryResult,
  HealthCheckResult,
  HealthIssue,
  ResiliencyType,
} from './types'

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
  } else if (utilizationPct > 80) {
    issues.push({
      code: 'HC_HIGH_UTILIZATION',
      severity: 'warning',
      message: `Storage utilization is ${utilizationPct.toFixed(1)}%. Microsoft recommends staying below 80% to allow for rebuild headroom.`,
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

  return {
    passed: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
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
