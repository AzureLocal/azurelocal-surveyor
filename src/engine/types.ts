// ─── Shared Types ────────────────────────────────────────────────────────────
// All engine functions are pure: (inputs) => outputs, no React, no side-effects.

export type DriveMedia =
  | 'all-nvme'
  | 'nvme-ssd'   // NVMe cache + SSD capacity
  | 'nvme-hdd'   // NVMe cache + HDD capacity
  | 'all-ssd'
  | 'all-hdd'

export type ResiliencyType =
  | '2-way-mirror'
  | '3-way-mirror'
  | 'mirror-accelerated-parity'

export type AvdWorkloadType = 'light' | 'medium' | 'heavy' | 'power'

// ─── Hardware Inputs (Sheet: "Hardware Inputs") ───────────────────────────────

export interface HardwareInputs {
  nodeCount: number               // 2..16
  capacityDrivesPerNode: number  // drives in capacity tier
  capacityDriveSizeTB: number    // per drive
  cacheDrivesPerNode: number     // 0 if no cache tier (all-NVMe or NVMe acts as capacity)
  cacheDriveSizeTB: number       // 0 if no cache tier
  cacheMediaType: 'nvme' | 'ssd' | 'none'
  capacityMediaType: 'nvme' | 'ssd' | 'hdd'
  coresPerNode: number           // physical CPU cores per node
  memoryPerNodeGB: number        // physical RAM per node
}

// ─── Advanced Settings (Sheet: "Advanced Settings") ──────────────────────────

export interface AdvancedSettings {
  capacityEfficiencyFactor: number     // default 0.92 — filesystem overhead
  poolReserveDrives: number            // default 1 — spare for rebuild
  vCpuOversubscriptionRatio: number    // default 4
  systemReservedMemoryGB: number       // default 8 per node
  systemReservedVCpus: number          // default 4 per node for Hyper-V / Arc VM agent
  defaultResiliency: ResiliencyType
}

export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  capacityEfficiencyFactor: 0.92,
  poolReserveDrives: 1,
  vCpuOversubscriptionRatio: 4,
  systemReservedMemoryGB: 8,
  systemReservedVCpus: 4,
  defaultResiliency: '3-way-mirror',
}

// ─── Capacity (Sheet: "Capacity Report") ─────────────────────────────────────

export interface CapacityResult {
  rawPoolTB: number
  poolReserveTB: number
  netPoolTB: number
  resiliencyType: ResiliencyType
  resiliencyFactor: number
  usableAfterResiliencyTB: number
  effectiveUsableTB: number          // after capacityEfficiencyFactor — the number to plan against
}

// ─── Volumes (Sheet: "Volume Detail") ────────────────────────────────────────

export interface VolumeSpec {
  id: string
  name: string
  resiliency: ResiliencyType
  plannedSizeTB: number
}

export interface VolumeDetail extends VolumeSpec {
  // "Calculator TB" — what the engine computed
  calculatorSizeTB: number
  // "WAC / PowerShell TB" — value to type into WAC or New-Volume -Size
  // This is the critical distinction the Excel preserves: round DOWN to the
  // nearest GB that WAC will accept without error.
  wacSizeTB: number
  wacSizeGB: number
}

export interface VolumeSummaryResult {
  volumes: VolumeDetail[]
  totalPlannedTB: number
  totalWacTB: number
  remainingUsableTB: number
  utilizationPct: number
}

// ─── Workloads (Sheet: "Workload Planner") ────────────────────────────────────

export interface WorkloadSpec {
  id: string
  name: string
  vmCount: number
  vCpusPerVm: number
  memoryPerVmGB: number
  storagePerVmGB: number
  resiliency: ResiliencyType
}

export interface WorkloadSummaryResult {
  totalVCpus: number
  totalMemoryGB: number
  totalStorageTB: number
}

// ─── AVD (Sheet: "AVD Planning") ─────────────────────────────────────────────

export interface AvdInputs {
  totalUsers: number
  workloadType: AvdWorkloadType
  multiSession: boolean          // true = Windows 11 multi-session; false = single-session VDI
  profileSizeGB: number          // FSLogix VHD(X) size per user
  officeContainerEnabled: boolean
  officeContainerSizeGB: number  // additional FSLogix Office Container per user
}

export interface AvdResult {
  usersPerHost: number
  sessionHostCount: number       // ceil(totalUsers / usersPerHost)
  vCpusPerHost: number
  memoryPerHostGB: number
  totalVCpus: number
  totalMemoryGB: number
  // Storage broken out to match the "calculator TB vs WAC TB" pattern
  osDiskPerHostGB: number
  totalOsStorageTB: number
  totalProfileStorageTB: number
  totalOfficeContainerStorageTB: number
  totalStorageTB: number         // all AVD storage combined
}

// ─── SOFS (Sheet: "SOFS Planner") ────────────────────────────────────────────

export interface SofsInputs {
  userCount: number
  profileSizeGB: number
  redirectedFolderSizeGB: number
  sofsGuestVmCount: number       // typically 2 for HA
  sofsVCpusPerVm: number
  sofsMemoryPerVmGB: number
}

export interface SofsResult {
  totalProfileStorageTB: number
  totalRedirectedStorageTB: number
  totalStorageTB: number
  sofsVCpusTotal: number
  sofsMemoryTotalGB: number
}

// ─── Compute (Sheet: "Compute Report") ───────────────────────────────────────

export interface ComputeResult {
  physicalCores: number
  systemReservedVCpus: number
  usableVCpus: number
  physicalMemoryGB: number
  systemReservedMemoryGB: number
  usableMemoryGB: number
  numaDomainsEstimate: number    // estimated NUMA domains across the cluster
}

// ─── Health Check (Sheet: "Volume Health Check") ─────────────────────────────

export type HealthSeverity = 'error' | 'warning' | 'info'

export interface HealthIssue {
  code: string
  severity: HealthSeverity
  message: string
}

export interface HealthCheckResult {
  passed: boolean                // true only when zero errors
  issues: HealthIssue[]
}

// ─── OEM Preset ───────────────────────────────────────────────────────────────

export interface OemPreset {
  id: string
  vendor: string
  model: string
  nodeCount?: number             // if preset is for a fixed-node appliance
  coresPerNode: number
  memoryPerNodeGB: number
  capacityDrivesPerNode: number
  capacityDriveSizeTB: number
  capacityMediaType: 'nvme' | 'ssd' | 'hdd'
  cacheDrivesPerNode: number
  cacheDriveSizeTB: number
  cacheMediaType: 'nvme' | 'ssd' | 'none'
  notes?: string
}
