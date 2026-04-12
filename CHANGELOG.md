# Changelog

All notable changes to Azure Local Surveyor are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — Quick-Start Volumes and Report Alignment

### Added
- Quick-start volumes table — hardware-based equal-split reference with fit check (#75)
- Volume mode toggle — switch between workload-based and generic hardware-based suggestions (#76)
- Smart volume mode with capacity validation (#76)
- Expanded volume health check — summary banner and collapsible detailed breakdown (#77)
- OEM preset dropdown verification and update against Azure Local hardware catalog (#78)
- Report alignment — unified exports, PowerShell scripts, and completeness pass (#79)

---

## [0.4.0] — MABS, VM Scenarios, and Drive Layout

### Added
- MABS (Microsoft Azure Backup Server) backup planner page (#70)
- VM scenarios consolidation and workload-based volume suggestions (#68)
- Drive layout comparison page — auto-calculate equivalent drive size for same raw capacity (#65)
- Advanced settings overrides for formula-calculated values (#64)
- NaN guards and internal mirror resiliency support
- Drive size standardized dropdown replacing free-text input (#74)
- TiB labeling throughout volume and capacity output

---

## [0.3.0] — SOFS, AKS, Health Check, and Exports

### Added
- Scale-Out File Server (SOFS) planner — cluster sizing, IOPS, FSLogix container types, readiness checklist (#41–#47)
- AKS on Azure Local planning page (#17)
- Expanded volume health check matching Excel workbook — 52 formula checks (#20)
- Visual charts and gauges in reports (#10)
- Richer PDF and XLSX exports matching Excel tab structure (#18)
- PowerShell volume creation commands in Final Report (#49)
- Best Practice Notes section in Final Report (#51)
- Thin Provisioning reference guide page with risks, PowerShell monitoring, and checklist (#53)
- References page — 17 hyperlinked Microsoft Learn URLs (#55)
- TB ↔ TiB conversion reference table with live converter (#57)
- N+1 failover analysis and N+1 Fit column (#23)
- Per-scenario vCPU overcommit ratios (#24)
- Overcommit sensitivity table with N+1 Fit column (#25)
- Azure Local brand color scheme (#66)
- Dell AX-660, AX-4510, AX-4520 OEM presets (#1)
- Onboarding / getting-started flow for new users (#19)
- In-app Documentation page (#3)
- Resiliency reference guide (#11)

### Fixed
- Pool utilization warning threshold corrected to 70% (#58)
- SOFS compute never added to workload totals (#15)
- Health check vCPU/memory checks ignoring workload scenario totals (#14)
- FinalReport always showing AVD/SOFS sections regardless of enabled state (#12)

---

## [0.2.0] — AVD Planner and Compute Report

### Added
- Azure Virtual Desktop (AVD) planner — session host density, FSLogix sizing, network bandwidth, gold image reference, readiness checklist (#26–#39)
- AVD FSLogix user type mix estimator (Task/Knowledge/Power Worker) (#59)
- AVD FSLogix profile storage location selector (S2D / SOFS / Azure Files / External) (#33)
- Separate OS disk and data/temp disk storage inputs per session host (#31)
- Growth buffer percentage on FSLogix profile storage (#27)
- Concurrent users as primary session host sizing driver (#26)
- Tabbed Reports view mirroring Excel sheet tabs — Capacity / Compute / Final (#9)
- Conditional sidebar navigation — hide AVD/SOFS when disabled (#4)
- Prominent TiB vs TB callouts throughout the UI (#5)

---

## [0.1.0] — Initial Release

### Added
- Hardware inputs — node count, CPU, memory, drive configuration, OEM presets
- S2D capacity engine — pool sizing, resiliency efficiency, usable capacity formula
- Capacity Report — raw capacity, pool capacity, usable capacity, WAC TiB equivalent
- Workload planner — multi-scenario vCPU and memory planning
- Basic volume planning
- Azure Local hexagon logo and brand identity
- Hash-based routing for GitHub Pages SPA support
