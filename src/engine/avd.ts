import type { AvdInputs, AvdResult, AvdWorkloadType } from './types'

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
export function computeAvd(inputs: AvdInputs): AvdResult {
  const profile = HOST_PROFILES[inputs.workloadType]
  const usersPerHost = inputs.multiSession
    ? profile.usersPerHostMulti
    : profile.usersPerHostSingle

  // #26: use concurrentUsers for session host sizing when set
  const sizingUsers = inputs.concurrentUsers > 0 ? inputs.concurrentUsers : inputs.totalUsers
  const sessionHostCount = Math.ceil(sizingUsers / usersPerHost)

  // #59: user type mix weighted average profile size
  let effectiveProfileSizeGB = inputs.profileSizeGB
  if (inputs.userTypeMixEnabled && inputs.userTypeMix) {
    const { taskPct, taskProfileGB, knowledgePct, knowledgeProfileGB, powerPct, powerProfileGB } = inputs.userTypeMix
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
  const dataDiskTB = inputs.dataDiskPerHostGB > 0
    ? round2((sessionHostCount * inputs.dataDiskPerHostGB) / 1024)
    : 0

  // Profile storage uses totalUsers (not sizingUsers) — profiles are always allocated for all users
  const baseProfileStorageTB = (inputs.totalUsers * effectiveProfileSizeGB) / 1024
  // #27: apply growth buffer to profile storage
  const growthMultiplier = 1 + (inputs.growthBufferPct / 100)
  const totalProfileStorageTB = round2(baseProfileStorageTB * growthMultiplier)
  const profileStorageWithGrowthTB = totalProfileStorageTB

  const totalOfficeContainerStorageTB = inputs.officeContainerEnabled
    ? round2((inputs.totalUsers * inputs.officeContainerSizeGB) / 1024)
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
    dataDiskPerHostGB: inputs.dataDiskPerHostGB,
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
