import type { AvdHostPool, AvdInputs } from './types'

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function createDefaultAvdPool(index = 1): AvdHostPool {
  return {
    id: `avd-pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `Host Pool ${index}`,
    totalUsers: 100,
    concurrentUsers: 0,
    workloadType: 'medium',
    multiSession: true,
    fslogixEnabled: true,
    profileSizeGB: 40,
    officeContainerEnabled: true,
    officeContainerSizeGB: 20,
    dataDiskPerHostGB: 0,
    profileStorageLocation: 'sofs',
  }
}

export function getEffectiveAvdProfileSizeGB(inputs: AvdInputs, pool: AvdHostPool): number {
  if (!inputs.userTypeMixEnabled) return pool.profileSizeGB

  const mix = inputs.userTypeMix
  const totalPct = mix.taskPct + mix.knowledgePct + mix.powerPct
  if (totalPct <= 0) return pool.profileSizeGB

  return Math.round(
    (mix.taskPct * mix.taskProfileGB + mix.knowledgePct * mix.knowledgeProfileGB + mix.powerPct * mix.powerProfileGB) / totalPct
  )
}

export function getSizingUsers(pool: AvdHostPool): number {
  return pool.concurrentUsers > 0 ? pool.concurrentUsers : pool.totalUsers
}

export function getPoolsUsingSofs(inputs: AvdInputs): AvdHostPool[] {
  return inputs.pools.filter((pool) => pool.profileStorageLocation === 'sofs')
}

export function buildLinkedSofsInputsFromAvd(inputs: AvdInputs): { userCount: number; concurrentUsers: number; profileSizeGB: number } | null {
  const sofsPools = getPoolsUsingSofs(inputs)
  if (sofsPools.length === 0) return null

  const userCount = sofsPools.reduce((sum, pool) => sum + Math.max(0, pool.totalUsers), 0)
  const concurrentUsers = sofsPools.reduce((sum, pool) => sum + Math.max(0, getSizingUsers(pool)), 0)
  const weightedProfile = userCount > 0
    ? sofsPools.reduce((sum, pool) => sum + (Math.max(0, pool.totalUsers) * getEffectiveAvdProfileSizeGB(inputs, pool)), 0) / userCount
    : 0

  return {
    userCount,
    concurrentUsers,
    profileSizeGB: round2(weightedProfile),
  }
}