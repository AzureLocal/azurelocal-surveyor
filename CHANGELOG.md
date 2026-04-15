# Changelog

All notable changes to Azure Local Surveyor are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — v2.1.1

### Bug Fixes

- SOFS host volume suggestions should combine the guest VM OS disk and guest data on the same Azure Local host volume in both `shared` and `per-vm` layouts (#152)

---

## [2.1.0] — 2026-04-15

### Bug Fixes

- Pool utilization bar shows 100–101% and turns red when all storage is committed to valid volumes — off-by-one in utilization percentage calculation (#146)
- HC_HIGH_UTILIZATION warning message conflates the reserve-drive concept with the 70% raw-capacity utilization reserve — rewrite needed for clarity (#147)
- SOFS Auto-Sizing has a duplicate node count input that should instead be read from the Hardware page (#149)
- AVD-Profiles and AVD-OfficeContainers volume suggestions are incorrectly generated when SOFS is selected as the profile store (#151)

### Enhancements

- Capacity Report: display Two-Way Mirror and Three-Way Mirror efficiency percentages side by side so hardware configurations can be compared on a single screen (#145)
- MABS: add a toggle to choose whether the MABS VM OS disk gets a dedicated volume placement or is folded into the MABS metadata volume (#150)

### Research

- ReFS Deduplication and Compression: investigate capacity-planning impact, quantify realistic savings rates, and document caveats for Surveyor guidance (#141)

---

## [2.0.0] — Comprehensive Quality Overhaul (Epic #122)

This release delivers a full-stack v2.0 overhaul across 14 phases. Every workload planner now
generates structured volume suggestions, per-volume resiliency and provisioning are independently
configurable, and a Reports page with conditional tabs shows a detailed solution summary for each
enabled workload.

### Added

- **AKS Multi-Cluster** (#105): plan multiple independent AKS clusters; each cluster generates its own OS-disk CSV and PVC volume suggestions; `computeAks()` aggregates across all clusters
- **VM Storage Groups** (#106): organize virtual machines into named storage groups; one volume suggestion per group; groups replace flat VM scenario inputs from v1
- **SOFS Volume Layout** (#108): `shared` mode generates 1 data + 1 OS-disk volume; `per-vm` mode generates N data + N OS-disk volumes (one pair per SOFS guest VM); layout stored in `sofsInputs.volumeLayout`
- **Per-Volume Resiliency** (#100): each `VolumeSpec` carries its own `resiliency` type; pool footprint calculation uses the per-volume factor, not the global default
- **Per-Volume Provisioning** (#101): each `VolumeSpec` carries `provisioning: 'fixed' | 'thin'`; health check enforces fixed-only capacity constraint (HC_OVER_CAPACITY); thin over-provisioning fires HC_THIN_OVER_PROVISIONED as info only
- **Quick Start Reference** (#75, Phase 12 rewrite): hardware-only two-row reference (three-way-mirror + two-way-mirror); 1 GiB safety margin applied after TiB floor; NO FAIL status; PowerShell `New-Volume` snippet auto-generated
- **Compute Health Check** (#132, Phase 13): `runComputeHealthCheck()` emits HC_VCPU_HIGH, HC_VCPU_OVER_SUBSCRIBED, HC_MEMORY_HIGH, HC_MEMORY_EXCEEDED; displayed in a dedicated Compute section on the Reports page
- **AVD Report Tab** (#133): per-pool session host breakdown, FSLogix storage per pool, OS disk sizes, office container totals
- **AKS Report Tab** (#134): per-cluster control-plane and worker node breakdown with resource totals
- **MABS Report Tab** (#135): backup sizing, internal mirror impact, VM specs, volume suggestions table
- **SOFS Report Tab** (Phase 13 update): guest cluster sizing, IOPS at steady-state and login storm, internal mirror compounding explanation
- **Arc → AKS Integration** (#103, Phase 6): Arc-enabled service preset storage folds into `AKS-ArcServices-PVC` when AKS is enabled; standalone `Svc-*` volume generated when AKS is off
- **Custom Workloads** (#107): `internalMirrorFactor` applied to data volume size; OS disk volume (`{Name}-OsDisk`) generated when `osDiskPerVmGB > 0`; disabled workloads excluded from totals and volumes
- **Store Migration v9** (#130): `migratePersistedState()` exported for direct testing; v8 → v9 wraps flat AKS → clusters array, flat VMs → groups array, converts AVD `profileStorageLocation: 's2d'` → `'sofs'`, adds `provisioning: 'fixed'` to existing volumes, adds SOFS v2.0 defaults, removes per-workload CSV-resiliency fields
- **Test Coverage** (Phase 14, #139): 115 automated tests (up from 63); new tests cover AKS multi-cluster, VM storage groups, SOFS per-vm layout (2 and 3 VMs), Quick Start rounding, per-volume mixed resiliency pool footprint, Arc → AKS integration, custom workload mirror factor and OS disk generation, health check mixed fixed+thin, store migration v2→v9

### Changed

- `VolumeSpec`: added `provisioning: 'fixed' | 'thin'` (required); existing volumes migrated to `fixed` in v9
- `SofsInputs`: added `volumeLayout: 'shared' | 'per-vm'` and `sofsOsDiskPerVmGB: number`; both defaulted in v9 migration
- `AksInputs.clusters`: flat AKS inputs replaced by `clusters: AksCluster[]` array in v9 (breaking schema, migration provided)
- `VmScenario.groups`: flat VM inputs replaced by `groups: VmStorageGroup[]` array in v9 (breaking schema, migration provided)
- `MabsInputs`: removed `scratchResiliency` / `backupResiliency` (v9); resiliency now per-volume on Volumes page
- Health check: split into volume health check (`runHealthCheck`) and compute health check (`runComputeHealthCheck`) — compute codes (HC_VCPU_*, HC_MEMORY_*) no longer emitted by volume HC

### Removed

- `hardware.volumeProvisioning` field removed in v9 (now per-volume via `VolumeSpec.provisioning`)
- `customWorkloads[].resiliency` field removed in v9 (now per-volume on Volumes page)

---

## [1.7.0] — Architecture Documentation

### Added

- Architecture docs: new `docs/architecture/overview.md` — app layer diagram (Mermaid), page-to-engine map, state structure, export layer table, OEM preset overview (#90)
- Architecture docs: new `docs/architecture/engine-flow.md` — end-to-end pipeline flowchart (Mermaid), capacity computation chain, workload aggregation flow, health-check evaluation diagram, volume suggestion flow, override handling table, Advanced Settings impact reference (#90)
- Formula map: `deferred` and `implemented-with-enhancements` statuses added to the status key; AVD/SOFS/Compute parity test counts populated (12/8/6 scenarios); app-added modules table (AKS, MABS, service presets, custom workloads, json.ts, powershell.ts, avd-pools.ts, workload-volumes.ts); links to architecture docs (#90, #118)
- Engine spec: `surveyorVersion` updated to `1.7.0`; Final Report entry updated to `implemented-with-enhancements` with all five exporters listed; `implemented-with-enhancements` status added to `statusValues` (#118)

### Architecture notes

- Plan manifest (`SurveyorPlan` JSON export) and its Ranger integration contract are fully documented in `docs/reference/plan-manifest.md` (#118)
- Workbook coverage artifact (`engine-spec.json`) and formula map (`docs/reference/formula-map.md`) serve as the machine-readable and human-readable lineage references respectively (#118)

---

## [1.6.0] — AKS Dependencies, Terminology Clarity

### Added

- Navigation: subtitle labels added under each workload nav item — "Virtual Machines", "Azure Virtual Desktop", "Kubernetes", "Scale-Out File Server", "Azure Backup Server" (#120)
- Arc-enabled service presets: `requiresAks` flag on all 5 catalog entries (SQL MI GP/BC, IoT Operations, AI Foundry Local, Container Apps); Workload Planner shows amber dependency banner with one-click **Enable AKS** when any such preset is enabled and AKS is off (#103)
- AKS disable-protection: confirmation dialog when user tries to disable AKS while an AKS-dependent preset is enabled (#103)
- PDF export: full SOFS Solution Report section added (12-row parameter table covering users, storage footprint, VM sizing, IOPS, CSV capacity, and resiliency compounding warning) (#115)
- Docs: new `docs/engine/aks.md` covering AKS engine inputs, computation, storage resiliency field scope, Arc-enabled service dependency model, and integration points (#103)

### Changed

- Navigation: AKS moved before SOFS in the sidebar (order: Workloads → AVD → AKS → SOFS → MABS) (#120)
- AVD: "Host Pools" planning concept renamed to **Session Host Groups** throughout UI, exports (Markdown, XLSX), and page copy — distinguishes session hosts on Azure Local from the host pool resource in Azure (#121)

---

## [1.5.0] — AVD Maturity

> Commits: `8e190af`

### Added

- AVD planner: multi-pool host pool support — plan up to 10 independent AVD host pools in a single session, each with its own name, user count, workload model, session type, and profile storage location (#111)
- AVD planner: per-pool breakdown table shown when more than one pool is configured; aggregate totals always shown at the top (#111)
- AVD planner: pool selector card rail with add/remove controls; selecting a pool shows its detailed density analysis and bandwidth estimate (#111)
- AVD planner: SOFS sync panel now aggregates across all SOFS-targeted pools only; shows aggregate user count, concurrent users, and profile size driving SOFS demand (#111, #112)
- SOFS planner: reciprocal sync values now reflect SOFS-targeted pool aggregates rather than total AVD demand (#111)
- AVD ↔ SOFS cross-page navigation: "Open the SOFS planner" link in the AVD sync panel; "Open the AVD planner" link in the SOFS sync indicator (#112)
- Markdown export: per-pool breakdown table included when more than one pool is configured; external storage total shown when any pool uses non-SOFS storage (#111)
- XLSX export: AVD Planning sheet includes aggregate summary rows followed by per-pool detail sections (#111)
- Engine docs: `docs/engine/avd.md` and `docs/engine/sofs.md` updated to document multi-pool architecture and SOFS-targeted aggregation

### Changed

- AVD planner page copy: removed single-pool caveat; explains native multi-pool planning support
- SOFS planner page copy: clarifies that only SOFS-targeted AVD pools are counted toward linked AVD demand
- Zustand store: bumped to version 8; migration converts legacy flat AVD state into the new `pools[]` array format

### Fixed

- Store migration: `omitUndefined()` guard added to prevent legacy persisted `undefined` values from overwriting pool defaults during migration (#116)

---

## [1.4.0] — Stability and UX Clarity

> This release absorbs the unreleased v1.2.0 research and documentation work.

### Added

- Landing page at the app root (`/`) for first-run orientation, including a simple explanation of what Surveyor is, what the left-hand menu does, and where to start
- Engine and docs coverage for changelog, plan manifest, and missing MkDocs navigation pages

### Changed

- Hardware page moved to `/hardware`; the sidebar logo/title and new Home nav item now return users to the landing page
- AVD guidance now separates concurrent-user sizing from total-user profile storage sizing and documents RemoteApp planning assumptions
- Surveyor docs were audited, repaired, and cross-linked with S2DCartographer and related Azure Local references

---

## [1.3.0] — Workload Intelligence

> Commits: `1f3c0dc` → `974b73a`

### Added

- AKS planner: `aks.resiliency` is now wired into the `AKS-PersistentVolumes` volume suggestion; previously defaulted to the global resiliency setting regardless of the per-cluster selection (#89)
- AKS planner: scope note at top clarifying this page sizes base AKS infrastructure only — Arc-enabled service workloads are added separately as service presets (#89)
- Arc-enabled service presets: pre-built workload templates for Arc SQL MI (General Purpose), Arc SQL MI (Business Critical), Azure IoT Operations, Azure AI Foundry Local, and Azure Container Apps (#81)
- Service presets: per-instance configuration with optional vCPU, memory, and storage overrides; catalog defaults are preserved when overrides are cleared (#81)
- Service presets: all enabled instances roll up into Workload Planner aggregate totals, volume suggestions (using catalog `defaultPvcResiliency`), FinalReport, and XLSX/Markdown exports (#81)
- Custom workload builder: manual entry form for any workload not covered by built-in scenarios — VM count, vCPUs/VM, memory/VM, OS disk/VM, logical storage, resiliency, internal mirror compounding factor, and optional bandwidth estimate (#80)
- Custom workload builder: JSON import from file upload; downloadable JSON template for schema reference (#80)
- Custom workload builder: multiple workloads with independent enable/disable; internal mirror compounding generates accurate volume suggestion footprints (#80)
- Custom workloads: roll up into Workload Planner totals, volume suggestions, FinalReport, and XLSX/Markdown exports with a dedicated detail sheet (#80)
- Zustand persist: migrated to v6 (adds `customWorkloads`); v5 adds `servicePresets` (#80, #81)

### Changed

- AVD page: clarified single-pool scope note; added multi-pool approximation guidance; added RemoteApp mention (#95)
- AKS planner: renamed "Storage resiliency" → "Workload volume resiliency"; storage total row now shows separate OS-disk vs PVC resiliency sub-labels (#89)

---

## [1.1.0] — Planner Features

> Commits: `37e3660` → `b4c4796`

### Added

- SOFS planner: architecture context banner explaining the three layers — Azure Local host CSVs → SOFS guest VM cluster → FSLogix clients (#88)
- SOFS planner: "Azure Local host-side volume requirement" row in Sizing Results, explicitly showing the CSV space needed before host resiliency overhead (#88)
- SOFS Report tab in Reports — dedicated end-to-end SOFS solution summary (FSLogix demand, guest cluster design, host-side requirement, resiliency compounding, IOPS, deployment assumptions); tab is hidden when SOFS is disabled (#88)
- AVD ↔ SOFS sync panel: when AVD profile storage is set to SOFS, an "Apply to SOFS planner" button syncs user count, concurrent users, and profile size into SOFS state (#92)
- SOFS planner: reciprocal sync indicator — green when in sync with AVD, amber when values diverge (#92)
- AVD planner: burst headroom warning when concurrent users < 70% of total users (#96)

### Changed

- SOFS planner: removed all internal issue numbers (`#41`, `#43`, `#45`, `#69`) from user-facing labels and headings (#88)
- SOFS planner: split inputs into two named sections — FSLogix Storage Demand and SOFS Guest Cluster Configuration (#88)
- SOFS planner: renamed "SOFS internal mirror type" → "Guest cluster data protection"; "SOFS Cluster Hardware Auto-Sizing" → "Guest Cluster Drive Sizing" with rewritten descriptions clarifying storage layers (#88)
- AVD planner: concurrent users field now has a persistent explanation that session hosts/compute/bandwidth use concurrent users while profile storage always uses total users (#96)
- AVD planner: profile storage row in Sizing Results has a sub-label making the total-users sizing explicit (#96)
- AVD planner: removed remaining internal issue numbers (`#26`, `#31`, `#33`, `#37`, `#39`) from user-facing labels (#96)

---

## [1.0.1] — Stability and UX Clarity

> Commits: `75814ca` → `97f1db0`

### Added

- Version number displayed in sidebar and About page (#84)
- Changelog (`CHANGELOG.md`) with full version history (#84)
- About page with resource links, credits, and release history (#84)
- ErrorBoundary component — catches render errors and offers a one-click reset instead of a blank screen (#83)
- Reset All Settings button in Advanced Settings panel with two-step confirmation dialog (#82)

### Fixed

- Blank screen on Volumes and AVD pages in Edge caused by stale Zustand localStorage state from older schema versions (#83)
- `normalizePersistedState()` + `merge` callback ensures all store fields are hydrated with defaults on load (#83)
- Removed `dell-ax-670-large` (not a real catalog entry); Dell AX presets now match the April 2026 solutions catalog (#87)
- Pre-existing lint errors: `no-useless-escape` in volumes.ts, unused variable in ReportsPage.tsx

### Changed

- Lenovo MX: added V4 Premier Solutions (MX630 V4, MX650 V4); V3 models remain as Integrated Systems (#87)
- HPE ProLiant: DL380 Gen11 elevated to Premier (Ignite 2025); DL145 Gen11 added as Integrated System for edge (May 2025); DL360 Gen11 remains Validated Node (#87)
- AKS and VM workload resiliency fields renamed from generic "Resiliency" / "Storage resiliency" to "Workload volume resiliency" with context hints (#91)
- AVD scenario card now explains that OS disks use Three-Way Mirror and profile/data volumes follow the default resiliency in Advanced Settings (#91)
- Quick-Start Volumes fit-check banner renamed from "FIT CHECK: PASS/FAIL" to "Reference scenario fits/does not fit" (#98)
- Quick-Start footer now explicitly distinguishes the reference scenario from the Volume Health Check and explains they are independent (#98)
- Added Microsoft Learn reference links to the Quick-Start Volumes section (#98)
- Milestone structure reorganized: v1.0.1 (stability), v1.1.0 (polish), v1.2.0 (research/docs), v1.3.0 (intelligence) (#84)

---

## [1.0.0] — Quick-Start Volumes and Report Alignment

> Commit: `a8beb7c`

### Added

- Quick-start volumes table — hardware-based equal-split reference with fit check (#75)
- Volume mode toggle — switch between workload-based and generic hardware-based suggestions (#76)
- Smart volume mode with capacity validation (#76)
- Expanded volume health check — summary banner and collapsible detailed breakdown (#77)
- OEM preset dropdown verification and update against Azure Local hardware catalog (#78)
- Report alignment — unified exports, PowerShell scripts, and completeness pass (#79)

---

## [0.4.0] — MABS, VM Scenarios, and Drive Layout

> Commits: `b7f3fca` → `f3a833a`

### Added

- MABS (Microsoft Azure Backup Server) backup planner (#70)
- VM scenarios consolidation and workload-based volume suggestions (#68)
- Drive layout comparison page — auto-calculate equivalent drive size for same raw capacity (#65)
- NaN guards and internal mirror resiliency support (#67–#74)
- Drive size standardized dropdown replacing free-text input (#74)
- TiB labeling throughout volume and capacity output
- Hyperthreading locked as enabled on Hardware form; override moved to Advanced Settings

### Fixed

- SOFS NaN values in planner output

---

## [0.3.0] — Advanced Settings, Charts, and Exports

> Commits: `75126b0` → `aab780e`

### Added

- Advanced settings overrides for formula-calculated values (#64)
- Visual charts and gauges in reports (#10)
- Richer PDF and XLSX exports matching Excel tab structure (#18)
- Health check expansion — logo and onboarding banner (#20, #19)
- Advanced Settings sidebar button wired to working modal (#2)

---

## [0.2.0] — AVD, SOFS, AKS, Health Check, and Reference Pages

> Commits: `fb82ffe` → `b0fb8b6`

### Added

- Azure Virtual Desktop (AVD) planner — session host density, FSLogix sizing, network bandwidth, gold image reference, readiness checklist (#26–#39)
- AVD FSLogix user type mix estimator — Task / Knowledge / Power Worker (#59)
- AVD FSLogix profile storage location selector (S2D / SOFS / Azure Files / External) (#33)
- Growth buffer percentage on FSLogix profile storage (#27)
- Concurrent users as primary session host sizing driver (#26)
- Scale-Out File Server (SOFS) planner — cluster sizing, IOPS, FSLogix container types, readiness checklist (#41–#47)
- AKS on Azure Local planning page (#17)
- Dell AX-660, AX-4510, AX-4520 OEM presets
- Tabbed Reports view — Capacity / Compute / Final (#9)
- N+1 failover analysis and N+1 Fit column in compute report (#23)
- Per-scenario vCPU overcommit ratios (#24)
- Overcommit sensitivity table with N+1 Fit column (#25)
- Thin Provisioning reference guide with risks, PowerShell monitoring, and checklist (#53)
- References page — 17 hyperlinked Microsoft Learn URLs (#55)
- TB ↔ TiB conversion reference table with live converter (#57)
- In-app Documentation page (#3)
- Resiliency reference guide (#11)
- Conditional sidebar navigation — hide AVD/SOFS when disabled (#4)
- Prominent TiB vs TB callouts throughout the UI (#5)
- Best Practice Notes section in Final Report (#51)
- PowerShell volume creation commands in Final Report (#49)

### Fixed

- Pool utilization warning threshold corrected to 70% (#58)
- SOFS compute never added to workload totals (#15)
- Health check vCPU/memory checks ignoring workload scenario totals (#14)
- FinalReport always showing AVD/SOFS sections regardless of enabled state (#12)

---

## [0.1.0] — Initial Release

> Commits: `cba85d8` → `843056b`

### Added

- Hardware inputs — node count, CPU, memory, drive configuration, OEM presets
- S2D capacity engine — pool sizing, resiliency efficiency, usable capacity formula (Excel-parity rewrite)
- Capacity Report — raw capacity, pool capacity, usable capacity, WAC TiB equivalent
- Workload planner — multi-scenario vCPU and memory planning
- Basic volume planning
- Azure Local brand color scheme and hexagon logo
- Hash-based routing for GitHub Pages SPA support
