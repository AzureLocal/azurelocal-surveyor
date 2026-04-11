import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  HardwareInputs,
  AdvancedSettings,
  VolumeSpec,
  WorkloadSpec,
  AvdInputs,
  SofsInputs,
  AksInputs,
  VmScenario,
  BackupArchiveScenario,
} from '../engine/types'
import { DEFAULT_ADVANCED_SETTINGS } from '../engine/types'

export interface SurveyorState {
  // Inputs
  hardware: HardwareInputs
  advanced: AdvancedSettings
  volumes: VolumeSpec[]
  workloads: WorkloadSpec[]  // legacy / custom scenario rows
  avd: AvdInputs
  avdEnabled: boolean
  sofs: SofsInputs
  sofsEnabled: boolean
  // Workload scenarios
  aks: AksInputs
  infraVms: VmScenario
  devTestVms: VmScenario
  backupArchive: BackupArchiveScenario
  customVms: VmScenario

  // Actions
  setHardware: (hw: Partial<HardwareInputs>) => void
  setAdvanced: (a: Partial<AdvancedSettings>) => void
  addVolume: (v: VolumeSpec) => void
  updateVolume: (id: string, v: Partial<VolumeSpec>) => void
  removeVolume: (id: string) => void
  addWorkload: (w: WorkloadSpec) => void
  updateWorkload: (id: string, w: Partial<WorkloadSpec>) => void
  removeWorkload: (id: string) => void
  setAvd: (a: Partial<AvdInputs>) => void
  setAvdEnabled: (enabled: boolean) => void
  setSofs: (s: Partial<SofsInputs>) => void
  setSofsEnabled: (enabled: boolean) => void
  setAks: (a: Partial<AksInputs>) => void
  setInfraVms: (s: Partial<VmScenario>) => void
  setDevTestVms: (s: Partial<VmScenario>) => void
  setBackupArchive: (s: Partial<BackupArchiveScenario>) => void
  setCustomVms: (s: Partial<VmScenario>) => void
  resetAll: () => void
}

const DEFAULT_HARDWARE: HardwareInputs = {
  nodeCount: 4,
  capacityDrivesPerNode: 6,
  capacityDriveSizeTB: 3.84,
  cacheDrivesPerNode: 0,
  cacheDriveSizeTB: 0,
  cacheMediaType: 'none',
  capacityMediaType: 'nvme',
  coresPerNode: 32,
  memoryPerNodeGB: 256,
  hyperthreadingEnabled: true,
  volumeProvisioning: 'fixed',
}

const DEFAULT_AVD: AvdInputs = {
  totalUsers: 100,
  concurrentUsers: 0,
  workloadType: 'medium',
  multiSession: true,
  profileSizeGB: 40,
  userTypeMixEnabled: false,
  userTypeMix: {
    taskPct: 30,
    taskProfileGB: 15,
    knowledgePct: 50,
    knowledgeProfileGB: 40,
    powerPct: 20,
    powerProfileGB: 80,
  },
  growthBufferPct: 20,
  officeContainerEnabled: true,
  officeContainerSizeGB: 20,
  dataDiskPerHostGB: 0,
  profileStorageLocation: 's2d',
}

const DEFAULT_SOFS: SofsInputs = {
  userCount: 100,
  concurrentUsers: 0,
  profileSizeGB: 40,
  redirectedFolderSizeGB: 10,
  containerType: 'split',
  sofsGuestVmCount: 2,
  sofsVCpusPerVm: 4,
  sofsMemoryPerVmGB: 16,
  autoSizeDrivesPerNode: 0,
  autoSizeNodes: 2,
}

const DEFAULT_AKS: AksInputs = {
  enabled: false,
  clusterCount: 1,
  controlPlaneNodesPerCluster: 1,
  workerNodesPerCluster: 3,
  vCpusPerWorker: 4,
  memoryPerWorkerGB: 16,
  osDiskPerNodeGB: 200,
  persistentVolumesTB: 0,
  dataServicesTB: 0,
  resiliency: 'three-way-mirror',
}

const DEFAULT_INFRA_VMS: VmScenario = {
  enabled: false,
  vmCount: 4,
  vCpusPerVm: 4,
  memoryPerVmGB: 16,
  storagePerVmGB: 500,
  resiliency: 'three-way-mirror',
  vCpuOvercommitRatio: 1,
}

const DEFAULT_DEV_TEST_VMS: VmScenario = {
  enabled: false,
  vmCount: 10,
  vCpusPerVm: 4,
  memoryPerVmGB: 8,
  storagePerVmGB: 100,
  resiliency: 'two-way-mirror',
  vCpuOvercommitRatio: 2,
}

const DEFAULT_BACKUP_ARCHIVE: BackupArchiveScenario = {
  enabled: false,
  storageTB: 5,
  resiliency: 'two-way-mirror',
}

const DEFAULT_CUSTOM_VMS: VmScenario = {
  enabled: false,
  vmCount: 5,
  vCpusPerVm: 8,
  memoryPerVmGB: 32,
  storagePerVmGB: 200,
  resiliency: 'three-way-mirror',
  vCpuOvercommitRatio: 1,
}

export const useSurveyorStore = create<SurveyorState>()(
  persist(
    (set) => ({
      hardware: DEFAULT_HARDWARE,
      advanced: DEFAULT_ADVANCED_SETTINGS,
      volumes: [],
      workloads: [],
      avd: DEFAULT_AVD,
      avdEnabled: false,
      sofs: DEFAULT_SOFS,
      sofsEnabled: false,
      aks: DEFAULT_AKS,
      infraVms: DEFAULT_INFRA_VMS,
      devTestVms: DEFAULT_DEV_TEST_VMS,
      backupArchive: DEFAULT_BACKUP_ARCHIVE,
      customVms: DEFAULT_CUSTOM_VMS,

      setHardware: (hw) =>
        set((s) => ({ hardware: { ...s.hardware, ...hw } })),

      setAdvanced: (a) =>
        set((s) => ({ advanced: { ...s.advanced, ...a } })),

      addVolume: (v) =>
        set((s) => ({ volumes: [...s.volumes, v] })),

      updateVolume: (id, v) =>
        set((s) => ({
          volumes: s.volumes.map((vol) => (vol.id === id ? { ...vol, ...v } : vol)),
        })),

      removeVolume: (id) =>
        set((s) => ({ volumes: s.volumes.filter((v) => v.id !== id) })),

      addWorkload: (w) =>
        set((s) => ({ workloads: [...s.workloads, w] })),

      updateWorkload: (id, w) =>
        set((s) => ({
          workloads: s.workloads.map((wl) => (wl.id === id ? { ...wl, ...w } : wl)),
        })),

      removeWorkload: (id) =>
        set((s) => ({ workloads: s.workloads.filter((w) => w.id !== id) })),

      setAvd: (a) =>
        set((s) => ({ avd: { ...s.avd, ...a } })),

      setAvdEnabled: (enabled) =>
        set(() => ({ avdEnabled: enabled })),

      setSofs: (sf) =>
        set((s) => ({ sofs: { ...s.sofs, ...sf } })),

      setSofsEnabled: (enabled) =>
        set(() => ({ sofsEnabled: enabled })),

      setAks: (a) =>
        set((s) => ({ aks: { ...s.aks, ...a } })),

      setInfraVms: (v) =>
        set((s) => ({ infraVms: { ...s.infraVms, ...v } })),

      setDevTestVms: (v) =>
        set((s) => ({ devTestVms: { ...s.devTestVms, ...v } })),

      setBackupArchive: (v) =>
        set((s) => ({ backupArchive: { ...s.backupArchive, ...v } })),

      setCustomVms: (v) =>
        set((s) => ({ customVms: { ...s.customVms, ...v } })),

      resetAll: () =>
        set({
          hardware: DEFAULT_HARDWARE,
          advanced: DEFAULT_ADVANCED_SETTINGS,
          volumes: [],
          workloads: [],
          avd: DEFAULT_AVD,
          avdEnabled: false,
          sofs: DEFAULT_SOFS,
          sofsEnabled: false,
          aks: DEFAULT_AKS,
          infraVms: DEFAULT_INFRA_VMS,
          devTestVms: DEFAULT_DEV_TEST_VMS,
          backupArchive: DEFAULT_BACKUP_ARCHIVE,
          customVms: DEFAULT_CUSTOM_VMS,
        }),
    }),
    { name: 'surveyor-state' }  // persisted to localStorage
  )
)
