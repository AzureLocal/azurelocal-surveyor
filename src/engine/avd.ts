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
}

const HOST_PROFILES: Record<AvdWorkloadType, HostProfile> = {
  light: {
    vCpus: 2,
    memoryGB: 8,
    usersPerHostMulti: 16,
    usersPerHostSingle: 1,
    osDiskGB: 128,
  },
  medium: {
    vCpus: 4,
    memoryGB: 16,
    usersPerHostMulti: 8,
    usersPerHostSingle: 1,
    osDiskGB: 128,
  },
  heavy: {
    vCpus: 8,
    memoryGB: 32,
    usersPerHostMulti: 4,
    usersPerHostSingle: 1,
    osDiskGB: 128,
  },
  power: {
    vCpus: 16,
    memoryGB: 64,
    usersPerHostMulti: 2,
    usersPerHostSingle: 1,
    osDiskGB: 256,
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

  const sessionHostCount = Math.ceil(inputs.totalUsers / usersPerHost)

  const totalVCpus = sessionHostCount * profile.vCpus
  const totalMemoryGB = sessionHostCount * profile.memoryGB

  // Storage
  const totalOsStorageTB = round2((sessionHostCount * profile.osDiskGB) / 1024)
  const totalProfileStorageTB = round2((inputs.totalUsers * inputs.profileSizeGB) / 1024)
  const totalOfficeContainerStorageTB = inputs.officeContainerEnabled
    ? round2((inputs.totalUsers * inputs.officeContainerSizeGB) / 1024)
    : 0
  const totalStorageTB = round2(
    totalOsStorageTB + totalProfileStorageTB + totalOfficeContainerStorageTB
  )

  return {
    usersPerHost,
    sessionHostCount,
    vCpusPerHost: profile.vCpus,
    memoryPerHostGB: profile.memoryGB,
    totalVCpus,
    totalMemoryGB,
    osDiskPerHostGB: profile.osDiskGB,
    totalOsStorageTB,
    totalProfileStorageTB,
    totalOfficeContainerStorageTB,
    totalStorageTB,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
