/**
 * Workload-based volume suggestions (#68).
 *
 * Each enabled workload generates one or more suggested volumes
 * that the user can review and add to their volume plan.
 * SOFS and MABS volumes account for internal mirror compounding (#69, #70).
 */
import type {
  VolumeSpec,
  ResiliencyType,
  AdvancedSettings,
} from './types'
import type { AvdResult } from './types'
import type { AksResult } from './types'
import type { SofsResult, SofsInputs } from './types'
import type { MabsResult, MabsInputs } from './types'
import type { VmScenario } from './types'

export interface SuggestedVolume extends VolumeSpec {
  source: string      // which workload generated this suggestion
  description: string // brief explanation
}

interface WorkloadVolumeInputs {
  advanced: AdvancedSettings
  // AVD
  avdEnabled: boolean
  avdResult: AvdResult
  // AKS
  aksEnabled: boolean
  aksResult: AksResult
  // Virtual Machines
  virtualMachines: VmScenario
  // SOFS
  sofsEnabled: boolean
  sofsInputs: SofsInputs
  sofsResult: SofsResult
  // MABS
  mabsEnabled: boolean
  mabsInputs: MabsInputs
  mabsResult: MabsResult
}

let _sugId = 1000

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function generateWorkloadVolumes(inputs: WorkloadVolumeInputs): SuggestedVolume[] {
  const suggestions: SuggestedVolume[] = []
  const defaultRes = inputs.advanced.defaultResiliency

  // ── AVD ──────────────────────────────────────────────────────────────────
  if (inputs.avdEnabled) {
    const avd = inputs.avdResult
    if (avd.totalOsStorageTB > 0) {
      suggestions.push({
        id: `sug-${_sugId++}`,
        name: 'AVD-SessionHosts-OS',
        resiliency: 'three-way-mirror' as ResiliencyType,
        plannedSizeTB: round2(avd.totalOsStorageTB),
        source: 'AVD',
        description: `${avd.sessionHostCount} session hosts × ${avd.osDiskPerHostGB} GB OS disk`,
      })
    }
    if (avd.profileStorageWithGrowthTB > 0) {
      suggestions.push({
        id: `sug-${_sugId++}`,
        name: 'AVD-Profiles',
        resiliency: defaultRes,
        plannedSizeTB: round2(avd.profileStorageWithGrowthTB),
        source: 'AVD',
        description: `FSLogix profiles for ${avd.sizingUsers} users (with growth buffer)`,
      })
    }
    if (avd.totalOfficeContainerStorageTB > 0) {
      suggestions.push({
        id: `sug-${_sugId++}`,
        name: 'AVD-OfficeContainers',
        resiliency: defaultRes,
        plannedSizeTB: round2(avd.totalOfficeContainerStorageTB),
        source: 'AVD',
        description: 'FSLogix Office Container VHDXs',
      })
    }
    if (avd.totalDataDiskStorageTB > 0) {
      suggestions.push({
        id: `sug-${_sugId++}`,
        name: 'AVD-DataDisks',
        resiliency: defaultRes,
        plannedSizeTB: round2(avd.totalDataDiskStorageTB),
        source: 'AVD',
        description: `Data/temp disks for ${avd.sessionHostCount} session hosts`,
      })
    }
  }

  // ── AKS ──────────────────────────────────────────────────────────────────
  if (inputs.aksEnabled) {
    const aks = inputs.aksResult
    if (aks.osDiskTB > 0) {
      suggestions.push({
        id: `sug-${_sugId++}`,
        name: 'AKS-OsDisks',
        resiliency: 'three-way-mirror',
        plannedSizeTB: round2(aks.osDiskTB),
        source: 'AKS',
        description: `OS disks for ${aks.totalNodes} AKS nodes`,
      })
    }
    const pvcTB = round2(aks.totalStorageTB - aks.osDiskTB)
    if (pvcTB > 0) {
      suggestions.push({
        id: `sug-${_sugId++}`,
        name: 'AKS-PersistentVolumes',
        resiliency: defaultRes,
        plannedSizeTB: pvcTB,
        source: 'AKS',
        description: 'Persistent volume claims + data services',
      })
    }
  }

  // ── Virtual Machines ─────────────────────────────────────────────────────
  if (inputs.virtualMachines?.enabled) {
    const vm = inputs.virtualMachines
    const storageTB = round2((vm.vmCount * vm.storagePerVmGB) / 1024)
    if (storageTB > 0) {
      suggestions.push({
        id: `sug-${_sugId++}`,
        name: 'VM-Storage',
        resiliency: vm.resiliency,
        plannedSizeTB: storageTB,
        source: 'Virtual Machines',
        description: `${vm.vmCount} VMs × ${vm.storagePerVmGB} GB storage`,
      })
    }
  }

  // ── SOFS ─────────────────────────────────────────────────────────────────
  // SOFS internal mirror compounds: the Azure Local volume must hold the
  // internal footprint (logical × mirror factor), not just logical data.
  if (inputs.sofsEnabled) {
    const sofs = inputs.sofsResult
    if (sofs.internalFootprintTB > 0) {
      const mirrorLabel = inputs.sofsInputs.internalMirror === 'simple'
        ? '' : ` (includes ${sofs.internalMirrorFactor}× internal mirror)`
      suggestions.push({
        id: `sug-${_sugId++}`,
        name: 'SOFS-ProfileData',
        resiliency: defaultRes,
        plannedSizeTB: round2(sofs.internalFootprintTB),
        source: 'SOFS',
        description: `${sofs.totalStorageTB} TB logical data${mirrorLabel}`,
      })
    }
  }

  // ── MABS ─────────────────────────────────────────────────────────────────
  // MABS internal Storage Spaces mirror compounds similarly.
  if (inputs.mabsEnabled) {
    const mabs = inputs.mabsResult
    const mirrorFactor = mabs.internalMirrorFactor
    const mabsRes = inputs.mabsInputs.resiliency

    if (mabs.scratchVolumeTB > 0) {
      const scratchDisk = round2(mabs.scratchVolumeTB * mirrorFactor)
      suggestions.push({
        id: `sug-${_sugId++}`,
        name: 'MABS-Scratch',
        resiliency: mabsRes,
        plannedSizeTB: scratchDisk,
        source: 'MABS',
        description: `Scratch/cache ${mabs.scratchVolumeTB} TB × ${mirrorFactor} mirror`,
      })
    }
    if (mabs.backupDataVolumeTB > 0) {
      const backupDisk = round2(mabs.backupDataVolumeTB * mirrorFactor)
      suggestions.push({
        id: `sug-${_sugId++}`,
        name: 'MABS-BackupData',
        resiliency: mabsRes,
        plannedSizeTB: backupDisk,
        source: 'MABS',
        description: `Backup data ${mabs.backupDataVolumeTB} TB × ${mirrorFactor} mirror`,
      })
    }
    if (mabs.mabsOsDiskTB > 0) {
      suggestions.push({
        id: `sug-${_sugId++}`,
        name: 'MABS-OsDisk',
        resiliency: 'three-way-mirror',
        plannedSizeTB: round2(mabs.mabsOsDiskTB),
        source: 'MABS',
        description: 'MABS VM operating system disk',
      })
    }
  }

  return suggestions
}
