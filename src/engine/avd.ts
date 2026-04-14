import { buildLinkedSofsInputsFromAvd, getEffectiveAvdProfileSizeGB, getSizingUsers } from './avd-pools'
import type { AdvancedSettingsOverrides, AvdInputs, AvdPoolResult, AvdResult, AvdWorkloadType } from './types'

/**
 * Per-session-host specs indexed by workload type.
 * Source: Microsoft AVD sizing guidance + the 80 formulas in the AVD Planning sheet.
 *
 * Multi-session values represent Windows 11 multi-session host capacity.
 * Single-session values represent dedicated VDI (1 user per VM).
 */
interface HostProfile {
  vCpus: number
  memoryGB: number
  usersPerHostMulti: number   // multi-session (Windows 11 Enterprise multi-session)
  usersPerHostSingle: number  // single-session VDI (always 1)
  osDiskGB: number
  vCpusPerUser: number        // typical vCPU need per concurrent user (#29)
  memGBPerUser: number        // typical RAM need per concurrent user (#29)
  bandwidthMbps: number       // typical bandwidth per user (#35)
}

const HOST_PROFILES: Record<AvdWorkloadType, HostProfile> = {
  light: {
    vCpus: 2,
    memoryGB: 8,
    usersPerHostMulti: 16,
    usersPerHostSingle: 1,
    osDiskGB: 128,
    vCpusPerUser: 0.125,
    memGBPerUser: 0.5,
    bandwidthMbps: 0.25,
  },
  medium: {
    vCpus: 4,
    memoryGB: 16,
    usersPerHostMulti: 8,
    usersPerHostSingle: 1,
    osDiskGB: 128,
    vCpusPerUser: 0.5,
    memGBPerUser: 2,
    bandwidthMbps: 0.35,
  },
  heavy: {
    vCpus: 8,
    memoryGB: 32,
    usersPerHostMulti: 4,
    usersPerHostSingle: 1,
    osDiskGB: 128,
    vCpusPerUser: 2,
    memGBPerUser: 8,
    bandwidthMbps: 1.5,
  },
  power: {
    vCpus: 16,
    memoryGB: 64,
    usersPerHostMulti: 2,
    usersPerHostSingle: 1,
    osDiskGB: 256,
    vCpusPerUser: 8,
    memGBPerUser: 32,
    bandwidthMbps: 15,
  },
}

/**
 * Compute AVD session host count, vCPU, memory, and storage requirements.
 *
 * Data flow mirrors the "AVD Planning" sheet (80 formulas):
 *   totalUsers + workloadType → usersPerHost → sessionHostCount
 *   → vCPU/memory totals → storage totals
 */
/** Sanitize a number — replace NaN/Infinity/negative with a safe fallback. */
function safe(n: number, fallback = 0): number {
  return isFinite(n) && !isNaN(n) ? n : fallback
}

export function computeAvd(inputs: AvdInputs, overrides?: AdvancedSettingsOverrides): AvdResult {
  const growthBufferPct  = Math.max(0, safe(inputs.growthBufferPct, 0))
  const pools = inputs.pools.length > 0 ? inputs.pools : []
  const growthMultiplier = 1 + (growthBufferPct / 100)
  const singlePool = pools.length === 1

  const poolResults: AvdPoolResult[] = pools.map((pool) => {
    const profile = HOST_PROFILES[pool.workloadType] ?? HOST_PROFILES.medium
    const totalUsers = Math.max(0, safe(pool.totalUsers, 0))
    const concurrentUsers = Math.max(0, safe(pool.concurrentUsers, 0))
    const officeContainerSizeGB = Math.max(0, safe(pool.officeContainerSizeGB, 0))
    const dataDiskPerHostGB = Math.max(0, safe(pool.dataDiskPerHostGB, 0))
    const usersPerHost = pool.multiSession ? profile.usersPerHostMulti : profile.usersPerHostSingle
    const sizingUsers = getSizingUsers(pool)
    const sessionHostCount =
      singlePool && overrides?.avdSessionHostsNeeded && overrides.avdSessionHostsNeeded > 0
        ? overrides.avdSessionHostsNeeded
        : usersPerHost > 0 ? Math.ceil(sizingUsers / usersPerHost) : 0

    const effectiveProfileSizeGB = Math.max(0, safe(getEffectiveAvdProfileSizeGB(inputs, pool), 40))
    const cpuLimitedUsersPerHost = profile.vCpusPerUser > 0
      ? Math.floor(profile.vCpus / profile.vCpusPerUser)
      : usersPerHost
    const ramLimitedUsersPerHost = profile.memGBPerUser > 0
      ? Math.floor(profile.memoryGB / profile.memGBPerUser)
      : usersPerHost
    let limitingFactor: 'cpu' | 'ram' | 'preset' = 'preset'
    if (cpuLimitedUsersPerHost < usersPerHost) limitingFactor = 'cpu'
    else if (ramLimitedUsersPerHost < usersPerHost) limitingFactor = 'ram'

    const totalVCpus = sessionHostCount * profile.vCpus
    const totalMemoryGB = sessionHostCount * profile.memoryGB
    const totalOsStorageTB = round2((sessionHostCount * profile.osDiskGB) / 1024)
    const totalDataDiskStorageTB = dataDiskPerHostGB > 0
      ? round2((sessionHostCount * dataDiskPerHostGB) / 1024)
      : 0

    const baseProfileStorageTB =
      singlePool && overrides?.avdProfileLogicalTb && overrides.avdProfileLogicalTb > 0
        ? overrides.avdProfileLogicalTb
        : (totalUsers * effectiveProfileSizeGB) / 1024
    const totalProfileStorageTB = round2(baseProfileStorageTB * growthMultiplier)
    const profileStorageWithGrowthTB = totalProfileStorageTB
    const totalOfficeContainerStorageTB = pool.officeContainerEnabled
      ? round2((totalUsers * officeContainerSizeGB) / 1024)
      : 0
    const profileAndOfficeTB = round2(totalProfileStorageTB + totalOfficeContainerStorageTB)
    const totalStorageTB = round2(
      totalOsStorageTB + totalDataDiskStorageTB + (pool.profileStorageLocation === 's2d' ? profileAndOfficeTB : 0)
    )
    const externalizedStorageTB = pool.profileStorageLocation === 's2d' ? 0 : profileAndOfficeTB
    const bandwidthPerUserMbps = profile.bandwidthMbps
    const totalBandwidthMbps = round2(sizingUsers * bandwidthPerUserMbps)

    return {
      id: pool.id,
      name: pool.name,
      totalUsers,
      concurrentUsers,
      workloadType: pool.workloadType,
      multiSession: pool.multiSession,
      profileStorageLocation: pool.profileStorageLocation,
      usersPerHost,
      sessionHostCount,
      sizingUsers,
      vCpusPerHost: profile.vCpus,
      memoryPerHostGB: profile.memoryGB,
      cpuLimitedUsersPerHost,
      ramLimitedUsersPerHost,
      limitingFactor,
      effectiveProfileSizeGB,
      osDiskPerHostGB: profile.osDiskGB,
      dataDiskPerHostGB,
      totalVCpus,
      totalMemoryGB,
      totalOsStorageTB,
      totalDataDiskStorageTB,
      totalProfileStorageTB,
      profileStorageWithGrowthTB,
      totalOfficeContainerStorageTB,
      totalStorageTB,
      externalizedStorageTB,
      bandwidthPerUserMbps,
      totalBandwidthMbps,
    }
  })

  const totals = poolResults.reduce(
    (aggregate, pool) => ({
      totalUsers: aggregate.totalUsers + pool.totalUsers,
      totalConcurrentUsers: aggregate.totalConcurrentUsers + pool.concurrentUsers,
      sessionHostCount: aggregate.sessionHostCount + pool.sessionHostCount,
      sizingUsers: aggregate.sizingUsers + pool.sizingUsers,
      totalVCpus: aggregate.totalVCpus + pool.totalVCpus,
      totalMemoryGB: aggregate.totalMemoryGB + pool.totalMemoryGB,
      totalOsStorageTB: aggregate.totalOsStorageTB + pool.totalOsStorageTB,
      totalDataDiskStorageTB: aggregate.totalDataDiskStorageTB + pool.totalDataDiskStorageTB,
      totalProfileStorageTB: aggregate.totalProfileStorageTB + pool.totalProfileStorageTB,
      totalOfficeContainerStorageTB: aggregate.totalOfficeContainerStorageTB + pool.totalOfficeContainerStorageTB,
      totalStorageTB: aggregate.totalStorageTB + pool.totalStorageTB,
      totalExternalStorageTB: aggregate.totalExternalStorageTB + pool.externalizedStorageTB,
      totalBandwidthMbps: aggregate.totalBandwidthMbps + pool.totalBandwidthMbps,
    }),
    {
      totalUsers: 0,
      totalConcurrentUsers: 0,
      sessionHostCount: 0,
      sizingUsers: 0,
      totalVCpus: 0,
      totalMemoryGB: 0,
      totalOsStorageTB: 0,
      totalDataDiskStorageTB: 0,
      totalProfileStorageTB: 0,
      totalOfficeContainerStorageTB: 0,
      totalStorageTB: 0,
      totalExternalStorageTB: 0,
      totalBandwidthMbps: 0,
    }
  )

  const sofsLink = buildLinkedSofsInputsFromAvd(inputs)
  const firstPool = poolResults[0]
  const weightedBandwidthPerUser = totals.sizingUsers > 0 ? round2(totals.totalBandwidthMbps / totals.sizingUsers) : 0
  const weightedProfileSize = totals.totalUsers > 0
    ? Math.round(poolResults.reduce((sum, pool) => sum + (pool.totalUsers * pool.effectiveProfileSizeGB), 0) / totals.totalUsers)
    : 0

  return {
    poolCount: poolResults.length,
    totalUsers: totals.totalUsers,
    totalConcurrentUsers: totals.totalConcurrentUsers,
    pools: poolResults,
    usersPerHost: poolResults.length === 1 && firstPool ? firstPool.usersPerHost : 0,
    sessionHostCount: totals.sessionHostCount,
    sizingUsers: totals.sizingUsers,
    vCpusPerHost: poolResults.length === 1 && firstPool ? firstPool.vCpusPerHost : 0,
    memoryPerHostGB: poolResults.length === 1 && firstPool ? firstPool.memoryPerHostGB : 0,
    cpuLimitedUsersPerHost: poolResults.length === 1 && firstPool ? firstPool.cpuLimitedUsersPerHost : 0,
    ramLimitedUsersPerHost: poolResults.length === 1 && firstPool ? firstPool.ramLimitedUsersPerHost : 0,
    limitingFactor: poolResults.length === 1 && firstPool ? firstPool.limitingFactor : 'preset',
    totalVCpus: totals.totalVCpus,
    totalMemoryGB: totals.totalMemoryGB,
    effectiveProfileSizeGB: poolResults.length === 1 && firstPool ? firstPool.effectiveProfileSizeGB : weightedProfileSize,
    osDiskPerHostGB: poolResults.length === 1 && firstPool ? firstPool.osDiskPerHostGB : 0,
    dataDiskPerHostGB: poolResults.length === 1 && firstPool ? firstPool.dataDiskPerHostGB : 0,
    totalOsStorageTB: round2(totals.totalOsStorageTB),
    totalDataDiskStorageTB: round2(totals.totalDataDiskStorageTB),
    totalProfileStorageTB: round2(totals.totalProfileStorageTB),
    profileStorageWithGrowthTB: round2(totals.totalProfileStorageTB),
    totalOfficeContainerStorageTB: round2(totals.totalOfficeContainerStorageTB),
    totalStorageTB: round2(totals.totalStorageTB),
    totalExternalStorageTB: round2(totals.totalExternalStorageTB),
    bandwidthPerUserMbps: poolResults.length === 1 && firstPool ? firstPool.bandwidthPerUserMbps : weightedBandwidthPerUser,
    totalBandwidthMbps: round2(totals.totalBandwidthMbps),
    sofsLinkedUserCount: sofsLink?.userCount ?? 0,
    sofsLinkedConcurrentUsers: sofsLink?.concurrentUsers ?? 0,
    sofsLinkedProfileSizeGB: sofsLink?.profileSizeGB ?? 0,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
