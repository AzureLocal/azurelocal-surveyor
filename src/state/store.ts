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
  MabsInputs,
} from '../engine/types'
import { DEFAULT_ADVANCED_SETTINGS } from '../engine/types'
import type { ServicePresetInstance } from '../engine/service-presets'

export type VolumeMode = 'workload' | 'generic'

export interface SurveyorState {
  // Inputs
  hardware: HardwareInputs
  advanced: AdvancedSettings
  volumes: VolumeSpec[]
  workloads: WorkloadSpec[]  // legacy / custom scenario rows
  volumeMode: VolumeMode    // #76: workload-based vs generic hardware-based suggestions
  avd: AvdInputs
  avdEnabled: boolean
  sofs: SofsInputs
  sofsEnabled: boolean
  mabs: MabsInputs
  mabsEnabled: boolean
  // Workload scenarios
  aks: AksInputs
  virtualMachines: VmScenario
  servicePresets: ServicePresetInstance[]

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
  setMabs: (m: Partial<MabsInputs>) => void
  setMabsEnabled: (enabled: boolean) => void
  setAks: (a: Partial<AksInputs>) => void
  setVirtualMachines: (s: Partial<VmScenario>) => void
  setVolumeMode: (mode: VolumeMode) => void
  addServicePreset: (p: ServicePresetInstance) => void
  updateServicePreset: (id: string, p: Partial<ServicePresetInstance>) => void
  removeServicePreset: (id: string) => void
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
  internalMirror: 'three-way',
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

const DEFAULT_VIRTUAL_MACHINES: VmScenario = {
  enabled: false,
  vmCount: 5,
  vCpusPerVm: 4,
  memoryPerVmGB: 16,
  storagePerVmGB: 200,
  resiliency: 'three-way-mirror',
  vCpuOvercommitRatio: 1,
}

const DEFAULT_MABS: MabsInputs = {
  protectedDataTB: 10,
  dailyChangeRatePct: 10,
  onPremRetentionDays: 14,
  scratchCachePct: 15,
  mabsVCpus: 8,
  mabsMemoryGB: 32,
  mabsOsDiskGB: 200,
  resiliency: 'dual-parity',
  internalMirror: 'two-way',
}

const DEFAULT_STATE = {
  hardware: DEFAULT_HARDWARE,
  advanced: DEFAULT_ADVANCED_SETTINGS,
  volumes: [] as VolumeSpec[],
  workloads: [] as WorkloadSpec[],
  volumeMode: 'generic' as VolumeMode,
  avd: DEFAULT_AVD,
  avdEnabled: false,
  sofs: DEFAULT_SOFS,
  sofsEnabled: false,
  mabs: DEFAULT_MABS,
  mabsEnabled: false,
  aks: DEFAULT_AKS,
  virtualMachines: DEFAULT_VIRTUAL_MACHINES,
  servicePresets: [] as ServicePresetInstance[],
}

type SurveyorPersistedSlice = typeof DEFAULT_STATE

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeObject<T extends object>(defaults: T, value: unknown): T {
  return {
    ...defaults,
    ...(isRecord(value) ? value : {}),
  } as T
}

export function normalizePersistedState(persisted: unknown): SurveyorPersistedSlice {
  const state = isRecord(persisted) ? persisted : {}
  const advanced = mergeObject(DEFAULT_ADVANCED_SETTINGS, state.advanced)
  const avd = mergeObject(DEFAULT_AVD, state.avd)

  return {
    hardware: mergeObject(DEFAULT_HARDWARE, state.hardware),
    advanced: {
      ...advanced,
      overrides: mergeObject(DEFAULT_ADVANCED_SETTINGS.overrides, advanced.overrides),
    },
    volumes: Array.isArray(state.volumes) ? state.volumes as VolumeSpec[] : [],
    workloads: Array.isArray(state.workloads) ? state.workloads as WorkloadSpec[] : [],
    volumeMode: state.volumeMode === 'workload' ? ('workload' as VolumeMode) : ('generic' as VolumeMode),
    avd: {
      ...avd,
      userTypeMix: mergeObject(DEFAULT_AVD.userTypeMix, avd.userTypeMix),
    },
    avdEnabled: typeof state.avdEnabled === 'boolean' ? state.avdEnabled : false,
    sofs: mergeObject(DEFAULT_SOFS, state.sofs),
    sofsEnabled: typeof state.sofsEnabled === 'boolean' ? state.sofsEnabled : false,
    mabs: mergeObject(DEFAULT_MABS, state.mabs),
    mabsEnabled: typeof state.mabsEnabled === 'boolean' ? state.mabsEnabled : false,
    aks: mergeObject(DEFAULT_AKS, state.aks),
    virtualMachines: mergeObject(DEFAULT_VIRTUAL_MACHINES, state.virtualMachines),
    servicePresets: Array.isArray(state.servicePresets)
      ? (state.servicePresets as ServicePresetInstance[])
      : [],
  }
}

export const useSurveyorStore = create<SurveyorState>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,

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

      setMabs: (m) =>
        set((s) => ({ mabs: { ...s.mabs, ...m } })),

      setMabsEnabled: (enabled) =>
        set(() => ({ mabsEnabled: enabled })),

      setAks: (a) =>
        set((s) => ({ aks: { ...s.aks, ...a } })),

      setVirtualMachines: (v) =>
        set((s) => ({ virtualMachines: { ...s.virtualMachines, ...v } })),

      setVolumeMode: (mode) =>
        set(() => ({ volumeMode: mode })),

      addServicePreset: (p) =>
        set((s) => ({ servicePresets: [...s.servicePresets, p] })),

      updateServicePreset: (id, p) =>
        set((s) => ({
          servicePresets: s.servicePresets.map((sp) => sp.id === id ? { ...sp, ...p } : sp),
        })),

      removeServicePreset: (id) =>
        set((s) => ({ servicePresets: s.servicePresets.filter((sp) => sp.id !== id) })),

      resetAll: () =>
        set(DEFAULT_STATE),
    }),
    {
      name: 'surveyor-state',
      version: 5,
      migrate: (persisted: unknown, version: number) => {
        const state = isRecord(persisted) ? { ...persisted } : {}
        if (version < 5) {
          // v5: add servicePresets
          if (!Array.isArray(state.servicePresets)) state.servicePresets = []
        }
        if (version < 3) {
          // v3: add volumeMode
          if (state.volumeMode === undefined) state.volumeMode = 'generic'
        }
        if (version < 2) {
          // v2: consolidated infraVms/devTestVms/customVms → virtualMachines,
          //     removed backupArchive, added mabs/mabsEnabled
          if (!state.virtualMachines) state.virtualMachines = DEFAULT_VIRTUAL_MACHINES
          if (!state.mabs) state.mabs = DEFAULT_MABS
          if (state.mabsEnabled === undefined) state.mabsEnabled = false
          // Ensure sofs has all required fields
          if (state.sofs && typeof state.sofs === 'object') {
            const s = state.sofs as Record<string, unknown>
            if (s.containerType === undefined) s.containerType = 'split'
            if (s.internalMirror === undefined) s.internalMirror = 'three-way'
            if (s.autoSizeDrivesPerNode === undefined) s.autoSizeDrivesPerNode = 0
            if (s.autoSizeNodes === undefined) s.autoSizeNodes = 2
          }
          // Ensure mabs has internalMirror
          if (state.mabs && typeof state.mabs === 'object') {
            const m = state.mabs as Record<string, unknown>
            if (m.internalMirror === undefined) m.internalMirror = 'two-way'
          }
          // Ensure advanced has overrides
          if (state.advanced && typeof state.advanced === 'object') {
            const a = state.advanced as Record<string, unknown>
            if (!a.overrides) a.overrides = {}
          }
          // Clean up removed fields
          delete state.infraVms
          delete state.devTestVms
          delete state.customVms
          delete state.backupArchive
        }

        return normalizePersistedState(state) as unknown as SurveyorState
      },
      merge: (persisted: unknown, current: SurveyorState) => ({
        ...current,
        ...normalizePersistedState(persisted),
      }),
    }
  )
)
