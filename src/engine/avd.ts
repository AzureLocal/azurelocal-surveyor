import type { AdvancedSettingsOverrides, AvdInputs, AvdResult, AvdWorkloadType } from './types'

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
  const profile = HOST_PROFILES[inputs.workloadType] ?? HOST_PROFILES.medium
  const totalUsers      = Math.max(0, safe(inputs.totalUsers, 0))
  const concurrentUsers = Math.max(0, safe(inputs.concurrentUsers, 0))
  const profileSizeGB   = Math.max(0, safe(inputs.profileSizeGB, 40))
  const growthBufferPct  = Math.max(0, safe(inputs.growthBufferPct, 0))
  const officeContainerSizeGB = Math.max(0, safe(inputs.officeContainerSizeGB, 0))
  const dataDiskPerHostGB = Math.max(0, safe(inputs.dataDiskPerHostGB, 0))

  const usersPerHost = inputs.multiSession
    ? profile.usersPerHostMulti
    : profile.usersPerHostSingle

  // #26: use concurrentUsers for session host sizing when set
  const sizingUsers = concurrentUsers > 0 ? concurrentUsers : totalUsers
  // #64: override session host count if set
  const sessionHostCount =
    overrides?.avdSessionHostsNeeded && overrides.avdSessionHostsNeeded > 0
      ? overrides.avdSessionHostsNeeded
      : usersPerHost > 0 ? Math.ceil(sizingUsers / usersPerHost) : 0

  // #59: user type mix weighted average profile size
  let effectiveProfileSizeGB = profileSizeGB
  if (inputs.userTypeMixEnabled && inputs.userTypeMix) {
    const taskPct = safe(inputs.userTypeMix.taskPct, 0)
    const taskProfileGB = safe(inputs.userTypeMix.taskProfileGB, 15)
    const knowledgePct = safe(inputs.userTypeMix.knowledgePct, 0)
    const knowledgeProfileGB = safe(inputs.userTypeMix.knowledgeProfileGB, 40)
    const powerPct = safe(inputs.userTypeMix.powerPct, 0)
    const powerProfileGB = safe(inputs.userTypeMix.powerProfileGB, 80)
    const totalPct = taskPct + knowledgePct + powerPct
    if (totalPct > 0) {
      effectiveProfileSizeGB = Math.round(
        (taskPct * taskProfileGB + knowledgePct * knowledgeProfileGB + powerPct * powerProfileGB) / totalPct
      )
    }
  }

  const totalVCpus = sessionHostCount * profile.vCpus
  const totalMemoryGB = sessionHostCount * profile.memoryGB

  // #29: density analysis — CPU-limited vs RAM-limited
  const cpuLimitedUsersPerHost = profile.vCpusPerUser > 0
    ? Math.floor(profile.vCpus / profile.vCpusPerUser)
    : usersPerHost
  const ramLimitedUsersPerHost = profile.memGBPerUser > 0
    ? Math.floor(profile.memoryGB / profile.memGBPerUser)
    : usersPerHost
  let limitingFactor: 'cpu' | 'ram' | 'preset' = 'preset'
  if (cpuLimitedUsersPerHost < usersPerHost) limitingFactor = 'cpu'
  else if (ramLimitedUsersPerHost < usersPerHost) limitingFactor = 'ram'

  // Storage
  const totalOsStorageTB = round2((sessionHostCount * profile.osDiskGB) / 1024)

  // #31: data/temp disk per host
  const dataDiskTB = dataDiskPerHostGB > 0
    ? round2((sessionHostCount * dataDiskPerHostGB) / 1024)
    : 0

  // Profile storage uses totalUsers (not sizingUsers) — profiles are always allocated for all users
  // #64: override profile logical TB if set
  const baseProfileStorageTB =
    overrides?.avdProfileLogicalTb && overrides.avdProfileLogicalTb > 0
      ? overrides.avdProfileLogicalTb
      : (totalUsers * effectiveProfileSizeGB) / 1024
  // #27: apply growth buffer to profile storage
  const growthMultiplier = 1 + (growthBufferPct / 100)
  const totalProfileStorageTB = round2(baseProfileStorageTB * growthMultiplier)
  const profileStorageWithGrowthTB = totalProfileStorageTB

  const totalOfficeContainerStorageTB = inputs.officeContainerEnabled
    ? round2((totalUsers * officeContainerSizeGB) / 1024)
    : 0

  const totalStorageTB = round2(
    totalOsStorageTB + dataDiskTB + totalProfileStorageTB + totalOfficeContainerStorageTB
  )

  // #35: network bandwidth
  const bandwidthPerUserMbps = profile.bandwidthMbps
  const totalBandwidthMbps = round2(sizingUsers * bandwidthPerUserMbps)

  return {
    usersPerHost,
    sessionHostCount,
    sizingUsers,
    vCpusPerHost: profile.vCpus,
    memoryPerHostGB: profile.memoryGB,
    cpuLimitedUsersPerHost,
    ramLimitedUsersPerHost,
    limitingFactor,
    totalVCpus,
    totalMemoryGB,
    effectiveProfileSizeGB,
    osDiskPerHostGB: profile.osDiskGB,
    dataDiskPerHostGB,
    totalOsStorageTB,
    totalDataDiskStorageTB: dataDiskTB,
    totalProfileStorageTB,
    profileStorageWithGrowthTB,
    totalOfficeContainerStorageTB,
    totalStorageTB,
    bandwidthPerUserMbps,
    totalBandwidthMbps,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
