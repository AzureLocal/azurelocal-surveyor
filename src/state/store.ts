import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  HardwareInputs,
  AdvancedSettings,
  VolumeSpec,
  WorkloadSpec,
  AvdInputs,
  SofsInputs,
} from '../engine/types'
import { DEFAULT_ADVANCED_SETTINGS } from '../engine/types'

export interface SurveyorState {
  // Inputs
  hardware: HardwareInputs
  advanced: AdvancedSettings
  volumes: VolumeSpec[]
  workloads: WorkloadSpec[]
  avd: AvdInputs
  sofs: SofsInputs

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
  setSofs: (s: Partial<SofsInputs>) => void
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
}

const DEFAULT_AVD: AvdInputs = {
  totalUsers: 100,
  workloadType: 'medium',
  multiSession: true,
  profileSizeGB: 40,
  officeContainerEnabled: true,
  officeContainerSizeGB: 20,
}

const DEFAULT_SOFS: SofsInputs = {
  userCount: 100,
  profileSizeGB: 40,
  redirectedFolderSizeGB: 10,
  sofsGuestVmCount: 2,
  sofsVCpusPerVm: 4,
  sofsMemoryPerVmGB: 16,
}

export const useSurveyorStore = create<SurveyorState>()(
  persist(
    (set) => ({
      hardware: DEFAULT_HARDWARE,
      advanced: DEFAULT_ADVANCED_SETTINGS,
      volumes: [],
      workloads: [],
      avd: DEFAULT_AVD,
      sofs: DEFAULT_SOFS,

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

      setSofs: (sf) =>
        set((s) => ({ sofs: { ...s.sofs, ...sf } })),

      resetAll: () =>
        set({
          hardware: DEFAULT_HARDWARE,
          advanced: DEFAULT_ADVANCED_SETTINGS,
          volumes: [],
          workloads: [],
          avd: DEFAULT_AVD,
          sofs: DEFAULT_SOFS,
        }),
    }),
    { name: 'surveyor-state' }  // persisted to localStorage
  )
)
