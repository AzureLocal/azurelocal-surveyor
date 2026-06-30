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
}

// ─── Advanced Settings (Sheet: "Advanced Settings") ──────────────────────────

// ─── Advanced Settings Overrides (#64) ───────────────────────────────────────
// Any non-zero value replaces the formula-calculated result.
// Mirrors the Excel "Override" column pattern: IF(override<>"", override, formula).

export interface AdvancedSettingsOverrides {
  driveUsableTb?: number           // per drive TB — replaces driveSizeTB × efficiencyFactor
  avdSessionHostsNeeded?: number   // total session hosts — replaces ceil(users / density)
  avdProfileLogicalTb?: number     // total profile logical TB — replaces users × profileGB / 1024
  sofsProfileDemandTb?: number     // total SOFS profile demand TB — replaces userCount × profileGB / 1024
}

export interface AdvancedSettings {
  infraVolumeSizeTB: number            // logical size of infra (system) volume, default 0.25
  vCpuOversubscriptionRatio: number    // default 4
  systemReservedMemoryGB: number       // default 8 per node
  systemReservedVCpus: number          // default 4 per node for Hyper-V / Arc VM agent
  defaultResiliency: ResiliencyType
  overrides: AdvancedSettingsOverrides // manual overrides for formula-calculated values (#64)
}

export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  infraVolumeSizeTB: 0.25,
  vCpuOversubscriptionRatio: 4,
  systemReservedMemoryGB: 8,
  systemReservedVCpus: 4,
  defaultResiliency: 'three-way-mirror',
  overrides: {},
}

// ─── Capacity (Sheet: "Capacity Report") ─────────────────────────────────────

export interface CapacityResult {
  nodeCount: number                    // carried through for downstream resiliency calcs
  rawPoolTB: number                    // total raw drives — true byte count, no overhead (Stage 1)
  usablePerDriveTB: number             // raw drive size (no 0.92 haircut); or override value if set
  totalUsableTB: number                // pool after ~1% metadata overhead (Stage 2; = rawPoolTB × 0.99)
  reserveDrives: number                // min(nodeCount, 4)
  reserveTB: number                    // reserveDrives × largestRawDriveSizeTB (AB#4643)
  infraVolumeTB: number                // infra volume pool footprint
  availableForVolumesTB: number        // totalUsable − reserve − infraVolume (pool footprint space)
  availableForVolumesTiB: number       // availableForVolumesTB × TB_TO_TiB — OS-visible (one conversion)
  resiliencyType: ResiliencyType       // effective resiliency (may differ from requested if clamped)
  resiliencyFactor: number
  effectiveUsableTB: number            // availableForVolumes × resiliencyFactor — the planning number
  // AB#4636 — resiliency gating (optional for backward compat with test fixtures)
  resiliencyClamped?: boolean          // true when requested resiliency was invalid and was clamped
  resiliencyRequested?: ResiliencyType // the originally-requested resiliency (before clamping)
}

// ─── Expansion Headroom (Capacity Report — Deliverable 2.4.1) ────────────────

/**
 * A single fill-target row in the expansion headroom table.
 * All TB values are raw (unrounded); display rounds as needed.
 */
export interface ExpansionHeadroomRow {
  /** Fill target fraction, e.g. 0.70, 0.80, 0.90, 1.00. */
  targetFraction: number
  /** Pool footprint budget at this fill level: targetFraction × A (TB). */
  footprintBudgetTB: number
  /** Same, in TiB: footprintBudgetTB / 1.099511627776. */
  footprintBudgetTiB: number
  /** Pool footprint headroom remaining: max(0, targetFraction × A − U) (TB). */
  remainingFootprintTB: number
  /** Same, in TiB. */
  remainingFootprintTiB: number
  /** New usable data space: remainingFootprintTB / copies (TB). */
  remainingNewUsableTB: number
  /** Same, in TiB. */
  remainingNewUsableTiB: number
  /** True when U > targetFraction × A (already past this line). */
  pastLine: boolean
}

/**
 * Full expansion headroom result — one row per standard fill target
 * (70 / 80 / 90 / 100%) plus metadata describing the current utilization.
 *
 * Math (canonical — shared with Cartographer):
 *   A      = availableForVolumesTB  (pool footprint space, excl. reserve + infra)
 *   U      = totalPoolFootprintTB   (current planned workload-volume footprint)
 *   copies = data copies for the prevailing new-volume resiliency (2 = two-way, 3 = three-way, 4 = nested-two-way)
 *   currentUtilizationPct = U / A × 100
 *   For each target X ∈ [0.70, 0.80, 0.90, 1.00]:
 *     footprintBudgetTB    = X × A
 *     remainingFootprintTB = max(0, X × A − U)
 *     remainingNewUsableTB = remainingFootprintTB / copies
 *     pastLine             = U > X × A
 */
export interface ExpansionHeadroomResult {
  /** Available-for-volumes (pool footprint), TB — equals CapacityResult.availableForVolumesTB. */
  availableForVolumesTB: number
  /** Current planned workload-volume pool footprint, TB. */
  totalPoolFootprintTB: number
  /** Data copies for the resiliency used when sizing new volumes. */
  copies: number
  /** Human-readable label for the resiliency used (e.g. "two-way-mirror"). */
  resiliencyLabel: ResiliencyType
  /** Current pool utilization as a percentage (0–100+). */
  currentUtilizationPct: number
  /** One row per fill target: 70%, 80%, 90%, 100%. */
  rows: ExpansionHeadroomRow[]
}

// ─── Volumes (Sheet: "Volume Detail") ────────────────────────────────────────

export interface VolumeSpec {
  id: string
  name: string
  resiliency: ResiliencyType
  provisioning: 'fixed' | 'thin'
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
  totalPoolFootprintTB: number
  remainingUsableTB: number
  utilizationPct: number
}

// ─── AKS on Azure Local (Sheet: "Workload Planner" → AKS scenario) ──────────

export interface AksCluster {
  id: string
  name: string
  controlPlaneNodesPerCluster: 1 | 3   // 1 (dev) or 3 (HA) — always 4 vCPU, 16 GB RAM each
  workerNodesPerCluster: number
  vCpusPerWorker: number
  memoryPerWorkerGB: number
  osDiskPerNodeGB: number              // default 200 GB per node
  persistentVolumesTB: number          // PVC storage for this cluster (includes Arc preset storage)
}

export interface AksInputs {
  enabled: boolean
  clusters: AksCluster[]
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

export interface VmStorageGroup {
  id: string
  name: string
  vmCount: number
  vCpusPerVm: number
  memoryPerVmGB: number
  storagePerVmGB: number
}

export interface VmScenario {
  enabled: boolean
  // Effective vCPU demand = (totalVCpus across all groups) / vCpuOvercommitRatio
  // Default 1 = full vCPU demand. Higher values mean VMs can share cores more aggressively.
  vCpuOvercommitRatio: number
  groups: VmStorageGroup[]
}

// ─── MABS (Microsoft Azure Backup Server) ───────────────────────────────────

/** Internal Storage Spaces mirror type inside the MABS VM. */
export type MabsInternalMirror = 'two-way' | 'three-way' | 'simple'

export interface MabsInputs {
  protectedDataTB: number           // total data being backed up across all workloads
  dailyChangeRatePct: number        // typical 10% for mixed workloads
  onPremRetentionDays: number       // 7–14 typical before Azure offload
  scratchCachePct: number           // scratch/cache as % of protected data (default 15)
  mabsVCpus: number                 // MABS VM vCPUs (default 8)
  mabsMemoryGB: number              // MABS VM RAM (default 32)
  mabsOsDiskGB: number              // MABS VM OS disk (default 200)
  // #70: internal Storage Spaces mirror inside the MABS VM
  // Volume resiliency (scratchResiliency, backupResiliency) moved to per-volume on Volumes page
  internalMirror: MabsInternalMirror
  // #150: whether MABS VM OS disk gets a dedicated volume or shares an existing VM volume
  // optional — defaults to 'dedicated' when not present (backward compatible with persisted state)
  mabsOsDiskPlacement?: 'dedicated' | 'shared'
}

export interface MabsResult {
  scratchVolumeTB: number           // staging/cache area
  backupDataVolumeTB: number        // full + incremental retention
  totalStorageTB: number            // scratch + backup data (logical)
  // #70: internal mirror compounding
  internalMirrorFactor: number      // multiplier (1=simple, 2=two-way, 3=three-way)
  internalFootprintTB: number       // totalStorageTB × internalMirrorFactor
  mabsVCpus: number                 // VM compute
  mabsMemoryGB: number              // VM memory
  mabsOsDiskTB: number              // OS disk in TB
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

export interface CustomWorkload {
  id: string
  name: string
  description: string
  enabled: boolean
  // Compute
  vmCount: number           // VMs (use 1 for non-VM workloads)
  vCpusPerVm: number        // vCPUs per VM
  memoryPerVmGB: number     // memory per VM in GB
  osDiskPerVmGB: number     // OS disk per VM in GB (0 = none)
  // Storage
  storageTB: number         // logical storage in TB (before internal mirror compounding)
  // Volume resiliency moved to per-volume on Volumes page
  internalMirrorFactor: number  // 1 = no compounding, 2 = two-way, 3 = three-way
  // Optional
  bandwidthMbps: number     // 0 = not specified
}

export interface WorkloadSummaryResult {
  totalVCpus: number
  totalMemoryGB: number
  totalStorageTB: number
}

// ─── AVD (Sheet: "AVD Planning") ─────────────────────────────────────────────

export type AvdProfileStorageLocation = 'sofs' | 'azure-files' | 'external'

export interface AvdUserTypeMix {
  taskPct: number           // % of task workers (light profile)
  taskProfileGB: number     // profile size for task workers
  knowledgePct: number      // % of knowledge workers (medium profile)
  knowledgeProfileGB: number
  powerPct: number          // % of power workers (large profile)
  powerProfileGB: number
}

export interface AvdHostPool {
  id: string
  name: string
  totalUsers: number
  concurrentUsers: number         // #26: 0 = use totalUsers for sizing; > 0 = size session hosts for this peak
  workloadType: AvdWorkloadType
  multiSession: boolean           // true = Windows 11 multi-session; false = single-session VDI
  fslogixEnabled: boolean         // when false, no profile storage is counted for this pool
  profileSizeGB: number           // FSLogix VHD(X) size per user (overridden by mix when enabled)
  officeContainerEnabled: boolean
  officeContainerSizeGB: number   // additional FSLogix Office Container per user
  dataDiskPerHostGB: number       // #31: additional data/temp disk per session host (0 if none)
  profileStorageLocation: AvdProfileStorageLocation  // #33
}

export interface AvdInputs {
  pools: AvdHostPool[]
  // #59: user type mix for weighted profile size
  userTypeMixEnabled: boolean
  userTypeMix: AvdUserTypeMix
  growthBufferPct: number         // #27: percent growth buffer applied to profile storage (0–50)
}

export interface AvdPoolResult {
  id: string
  name: string
  totalUsers: number
  concurrentUsers: number
  workloadType: AvdWorkloadType
  multiSession: boolean
  profileStorageLocation: AvdProfileStorageLocation
  usersPerHost: number
  sessionHostCount: number
  sizingUsers: number
  vCpusPerHost: number
  memoryPerHostGB: number
  cpuLimitedUsersPerHost: number
  ramLimitedUsersPerHost: number
  limitingFactor: 'cpu' | 'ram' | 'preset'
  effectiveProfileSizeGB: number
  osDiskPerHostGB: number
  dataDiskPerHostGB: number
  totalVCpus: number
  totalMemoryGB: number
  totalOsStorageTB: number
  totalDataDiskStorageTB: number
  totalProfileStorageTB: number
  profileStorageWithGrowthTB: number
  totalOfficeContainerStorageTB: number
  totalStorageTB: number
  externalizedStorageTB: number
  bandwidthPerUserMbps: number
  totalBandwidthMbps: number
}

export interface AvdResult {
  poolCount: number
  totalUsers: number
  totalConcurrentUsers: number
  pools: AvdPoolResult[]
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
  totalExternalStorageTB: number  // profile + Office container storage hosted outside the Azure Local cluster
  // #35: network bandwidth estimates
  bandwidthPerUserMbps: number
  totalBandwidthMbps: number
  sofsLinkedUserCount: number
  sofsLinkedConcurrentUsers: number
  sofsLinkedProfileSizeGB: number
}

// ─── SOFS (Sheet: "SOFS Planner") ────────────────────────────────────────────

export type SofsContainerType = 'single' | 'split' | 'three'

/** Internal mirror type used inside the SOFS guest cluster (Storage Spaces / S2D). */
export type SofsInternalMirror = 'two-way' | 'three-way' | 'simple'

export interface SofsInputs {
  userCount: number
  concurrentUsers: number        // for IOPS estimate during login storm
  profileSizeGB: number
  redirectedFolderSizeGB: number
  containerType: SofsContainerType  // #45: profile container architecture
  sofsGuestVmCount: number       // typically 2 for HA
  sofsVCpusPerVm: number
  sofsMemoryPerVmGB: number
  // #69: internal mirror type — compounds with Azure Local cluster resiliency
  internalMirror: SofsInternalMirror
  // #43: auto-sizing — target drive count to calculate required drive size
  autoSizeDrivesPerNode: number  // 0 = manual, > 0 = auto-calculate drive size
  autoSizeNodes: number          // node count for auto-sizing SOFS cluster
  // v2.0: volume layout — one shared CSV or one per SOFS VM
  volumeLayout: 'shared' | 'per-vm'
  sofsOsDiskPerVmGB: number      // OS disk size per SOFS VM (default 127 GB)
}

export interface SofsResult {
  totalProfileStorageTB: number
  totalRedirectedStorageTB: number
  totalStorageTB: number
  sofsVCpusTotal: number
  sofsMemoryTotalGB: number
  // #69: internal mirror compounding
  internalMirrorFactor: number   // multiplier for internal mirror (1=simple, 2=two-way, 3=three-way)
  internalFootprintTB: number    // totalStorageTB × internalMirrorFactor (before Azure Local resiliency)
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

export type HealthDetailStatus = 'pass' | 'warning' | 'fail' | 'info'

export interface HealthDetail {
  label: string
  status: HealthDetailStatus
  calculation: string
  threshold: string
  outcome: string
  ruleSource?: string
}

export interface HealthIssue {
  code: string
  severity: HealthSeverity
  message: string
  details?: HealthDetail[]
}

export interface VolumeHealthDetail {
  name: string
  resiliency: ResiliencyType
  plannedSizeTiB: number
  poolFootprintTB: number
  status: 'pass' | 'fail'
  failReason?: string
  checks: HealthDetail[]
}

export interface HealthCheckResult {
  passed: boolean                // true only when zero errors
  issues: HealthIssue[]
  // #77: expanded detail
  volumeDetails: VolumeHealthDetail[]
  totalPoolFootprintTB: number
  availablePoolTB: number
  utilizationPct: number
  errorCount: number
  warningCount: number
  infoCount: number
}

// ─── OEM Preset ───────────────────────────────────────────────────────────────

export type OemCatalogType = 'integrated' | 'premier' | 'validated-node'

export interface OemPreset {
  id: string
  vendor: string
  model: string
  catalogType: OemCatalogType    // certification level in Azure Local solutions catalog
  generation?: string            // hardware generation (e.g. "Gen11", "V4")
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
