# Changelog

All notable changes to Azure Local Surveyor are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
