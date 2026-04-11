// ─── Shared Types ────────────────────────────────────────────────────────────
// All engine functions are pure: (inputs) => outputs, no React, no side-effects.

export type DriveMedia =
  | 'all-nvme'
  | 'nvme-ssd'   // NVMe cache + SSD capacity
  | 'nvme-hdd'   // NVMe cache + HDD capacity
  | 'all-ssd'
  | 'all-hdd'

/**
 * S2D resiliency types matching the Excel workbook.
 *  two-way-mirror   = 50%, min 2 nodes
 *  three-way-mirror = 33.3%, min 3 nodes
 *  dual-parity      = 50–80% (node-count dependent), min 4 nodes
 *  nested-two-way   = 25% (nested resiliency for 2-node), min 2 nodes
 */
export type ResiliencyType =
  | 'two-way-mirror'
  | 'three-way-mirror'
  | 'dual-parity'
  | 'nested-two-way'

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
  hyperthreadingEnabled: boolean // logical vCPU = physical × 2 when true
  volumeProvisioning: 'fixed' | 'thin'
}

// ─── Advanced Settings (Sheet: "Advanced Settings") ──────────────────────────

export interface AdvancedSettings {
  capacityEfficiencyFactor: number     // default 0.92 — filesystem overhead per drive
  infraVolumeSizeTB: number            // logical size of infra (system) volume, default 0.25
  vCpuOversubscriptionRatio: number    // default 4
  systemReservedMemoryGB: number       // default 8 per node
  systemReservedVCpus: number          // default 4 per node for Hyper-V / Arc VM agent
  defaultResiliency: ResiliencyType
}

export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  capacityEfficiencyFactor: 0.92,
  infraVolumeSizeTB: 0.25,
  vCpuOversubscriptionRatio: 4,
  systemReservedMemoryGB: 8,
  systemReservedVCpus: 4,
  defaultResiliency: 'three-way-mirror',
}

// ─── Capacity (Sheet: "Capacity Report") ─────────────────────────────────────

export interface CapacityResult {
  nodeCount: number                    // carried through for downstream resiliency calcs
  rawPoolTB: number                    // total raw drives (no overhead)
  usablePerDriveTB: number             // driveSizeTB × efficiencyFactor
  totalUsableTB: number                // usablePerDrive × drives × nodes
  reserveDrives: number                // min(nodeCount, 4)
  reserveTB: number                    // reserveDrives × usablePerDriveTB
  infraVolumeTB: number                // infra volume pool footprint
  availableForVolumesTB: number        // totalUsable − reserve − infraVolume (pool space)
  availableForVolumesTiB: number       // availableForVolumesTB × 0.909099 (OS-visible)
  resiliencyType: ResiliencyType
  resiliencyFactor: number
  effectiveUsableTB: number            // availableForVolumes × resiliencyFactor — the planning number
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

// ─── AKS on Azure Local (Sheet: "Workload Planner" → AKS scenario) ──────────

export interface AksInputs {
  enabled: boolean
  clusterCount: number
  controlPlaneNodesPerCluster: number  // 1 (dev) or 3 (HA) — always 4 vCPU, 16 GB RAM each
  workerNodesPerCluster: number
  vCpusPerWorker: number
  memoryPerWorkerGB: number
  osDiskPerNodeGB: number              // default 200 GB per node
  persistentVolumesTB: number          // total PVC storage across all clusters
  dataServicesTB: number               // SQL MI, Arc data, etc.
  resiliency: ResiliencyType
}

export interface AksResult {
  totalNodes: number
  totalControlPlaneVCpus: number
  totalWorkerVCpus: number
  totalVCpus: number
  totalControlPlaneMemoryGB: number
  totalWorkerMemoryGB: number
  totalMemoryGB: number
  osDiskTB: number
  totalStorageTB: number
}

// ─── Workload Scenarios (Sheet: "Workload Planner") ──────────────────────────

export interface VmScenario {
  enabled: boolean
  vmCount: number
  vCpusPerVm: number
  memoryPerVmGB: number
  storagePerVmGB: number
  resiliency: ResiliencyType
  // Per-scenario overcommit: effective vCPU demand = (vmCount × vCpusPerVm) / vCpuOvercommitRatio
  // Default 1 = full vCPU demand. Higher values mean these VMs can share cores more aggressively.
  vCpuOvercommitRatio: number
}

export interface BackupArchiveScenario {
  enabled: boolean
  storageTB: number
  resiliency: ResiliencyType
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

export type AvdProfileStorageLocation = 's2d' | 'sofs' | 'azure-files' | 'external'

export interface AvdUserTypeMix {
  taskPct: number           // % of task workers (light profile)
  taskProfileGB: number     // profile size for task workers
  knowledgePct: number      // % of knowledge workers (medium profile)
  knowledgeProfileGB: number
  powerPct: number          // % of power workers (large profile)
  powerProfileGB: number
}

export interface AvdInputs {
  totalUsers: number
  concurrentUsers: number         // #26: 0 = use totalUsers for sizing; > 0 = size session hosts for this peak
  workloadType: AvdWorkloadType
  multiSession: boolean           // true = Windows 11 multi-session; false = single-session VDI
  profileSizeGB: number           // FSLogix VHD(X) size per user (overridden by mix when enabled)
  // #59: user type mix for weighted profile size
  userTypeMixEnabled: boolean
  userTypeMix: AvdUserTypeMix
  growthBufferPct: number         // #27: percent growth buffer applied to profile storage (0–50)
  officeContainerEnabled: boolean
  officeContainerSizeGB: number   // additional FSLogix Office Container per user
  dataDiskPerHostGB: number       // #31: additional data/temp disk per session host (0 if none)
  profileStorageLocation: AvdProfileStorageLocation  // #33
}

export interface AvdResult {
  usersPerHost: number
  sessionHostCount: number        // ceil(sizingUsers / usersPerHost)
  sizingUsers: number             // concurrentUsers if set, else totalUsers
  vCpusPerHost: number
  memoryPerHostGB: number
  // #29: density analysis
  cpuLimitedUsersPerHost: number
  ramLimitedUsersPerHost: number
  limitingFactor: 'cpu' | 'ram' | 'preset'
  totalVCpus: number
  totalMemoryGB: number
  // #59: effective profile size (from mix when enabled, or fixed)
  effectiveProfileSizeGB: number
  // Storage broken out to match the "calculator TB vs WAC TB" pattern
  osDiskPerHostGB: number
  dataDiskPerHostGB: number       // #31
  totalOsStorageTB: number
  totalDataDiskStorageTB: number  // #31
  totalProfileStorageTB: number   // includes growth buffer
  profileStorageWithGrowthTB: number   // #27: profile storage × (1 + growthBuffer%)
  totalOfficeContainerStorageTB: number
  totalStorageTB: number          // all AVD storage combined
  // #35: network bandwidth estimates
  bandwidthPerUserMbps: number
  totalBandwidthMbps: number
}

// ─── SOFS (Sheet: "SOFS Planner") ────────────────────────────────────────────

export type SofsContainerType = 'single' | 'split' | 'three'

export interface SofsInputs {
  userCount: number
  concurrentUsers: number        // for IOPS estimate during login storm
  profileSizeGB: number
  redirectedFolderSizeGB: number
  containerType: SofsContainerType  // #45: profile container architecture
  sofsGuestVmCount: number       // typically 2 for HA
  sofsVCpusPerVm: number
  sofsMemoryPerVmGB: number
  // #43: auto-sizing — target drive count to calculate required drive size
  autoSizeDrivesPerNode: number  // 0 = manual, > 0 = auto-calculate drive size
  autoSizeNodes: number          // node count for auto-sizing SOFS cluster
}

export interface SofsResult {
  totalProfileStorageTB: number
  totalRedirectedStorageTB: number
  totalStorageTB: number
  sofsVCpusTotal: number
  sofsMemoryTotalGB: number
  // #41: IOPS estimates
  steadyStateIopsPerUser: number
  loginStormIopsPerUser: number
  totalSteadyStateIops: number
  totalLoginStormIops: number
  // #43: auto-sizing
  autoSizeDriveSizeTB: number    // calculated drive size to meet demand; 0 if disabled
}

// ─── Compute (Sheet: "Compute Report") ───────────────────────────────────────

export interface ComputeResult {
  nodeCount: number                  // passed through for N+1 and per-node calculations
  physicalCores: number
  logicalCores: number               // physicalCores × 2 if hyperthreading enabled
  logicalCoresPerNode: number        // logicalCores / nodeCount
  hyperthreadingEnabled: boolean
  systemReservedVCpus: number
  usableVCpus: number
  // N+1 failover: capacity with one node down
  usableVCpusN1: number              // usableVCpus minus one node's contribution
  usableMemoryGBN1: number           // usableMemoryGB minus one node's contribution
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
