# Epic: Azure Local Surveyor v2.0 — Comprehensive Quality Overhaul

## Overview

Complete overhaul of the Surveyor. Resiliency and provisioning (fixed/thin) move to per-volume on the Volumes page. Each workload planner gets intelligence upgrades. AKS becomes multi-cluster. Arc services integrate into AKS. Volumes page is rebuilt with correct calculations. Reports get per-workload conditional tabs. Quick fixes for nav, docs, about page.

---

## Sub-Issues

| # | Phase | Issue | Priority |
|---|-------|-------|----------|
| 1 | 1A | #123 — Remove Home Nav Item | P3 |
| 2 | 1B | #124 — Update About Page Release History | P2 |
| 3 | 1C | #125 — Surface Architecture Docs in Docs Page | P2 |
| 4 | 1D | #126 — Verify and Update References Page | P3 |
| 5 | 2 | #127 — Store Schema & Type Foundation (Zustand v8→v9) | **P0** |
| 6 | 3 | #128 — Hardware Page Cleanup | P1 |
| 7 | 4 | #129 — AVD Planner Intelligence | P1 |
| 8 | 5 | #130 — AKS Planner — Multi-Cluster Support | P1 |
| 9 | 6 | #131 — Arc Services → AKS Integration | P1 |
| 10 | 7 | #132 — SOFS Planner Overhaul | P1 |
| 11 | 8 | #133 — MABS Planner Cleanup | P1 |
| 12 | 9 | #134 — Virtual Machines — Storage Groups | P1 |
| 13 | 10 | #135 — Custom Workloads Cleanup | P2 |
| 14 | 11 | #136 — Workload Planner Totals Fix | P1 |
| 15 | 12 | #137 — Volumes Page Overhaul | **P0** |
| 16 | 13 | #138 — Reports Overhaul | P1 |
| 17 | 14 | #139 — Verification & Testing | **P0** |

---

## Phase Dependencies

| Phase | Title | Dependencies |
|-------|-------|-------------|
| 1 | Quick Global Fixes (nav, about, docs, references) | None |
| 2 | Store Schema & Type Foundation (Zustand v8→v9 migration) | Blocks all other phases |
| 3 | Hardware Page Cleanup | Phase 2 |
| 4 | AVD Planner Intelligence | Phase 2 |
| 5 | AKS Planner — Multi-Cluster | Phase 2 |
| 6 | Arc Services → AKS Integration | Phase 5 |
| 7 | SOFS Planner Overhaul | Phase 2 |
| 8 | MABS Planner Cleanup | Phase 2 |
| 9 | Virtual Machines — Storage Groups | Phase 2 |
| 10 | Custom Workloads Cleanup | Phase 2 |
| 11 | Workload Planner Totals Fix | Phases 5, 6, 9 |
| 12 | Volumes Page Overhaul | All workload phases |
| 13 | Reports Overhaul | All workload phases |
| 14 | Verification & Testing | All phases |

---

# Full Plan

---

## Phase 1: Quick Global Fixes (no dependencies, parallel)

### 1A. Remove Home nav item
- **File:** `src/components/Layout.tsx` line 40
- Delete `<NavItem to="/" label="Home" icon={Home} end />`. Logo already links to `/`.
- Remove `Home` from lucide-react imports if unused elsewhere.

### 1B. Update About page release history
- **File:** `src/pages/AboutPage.tsx` lines 172–225
- Add v1.5.0, v1.6.0, v1.7.0, and upcoming v2.0 entries.

### 1C. Surface architecture docs in Docs page
- **File:** `src/pages/DocsPage.tsx`
- Add "Architecture" section to the hardcoded `DOCS` array with links to `docs/architecture/overview.md` and `docs/architecture/engine-flow.md` on GitHub.

### 1D. Verify References page
- **File:** `src/pages/ReferencesPage.tsx`
- Audit all 17 links. Add references for AKS on Azure Local, MABS, and custom workloads if missing.

---

## Phase 2: Store Schema & Type Foundation (*blocks Phases 3–12*)

All type and store changes consolidated here. Single Zustand migration v8→v9.

### 2A. VolumeSpec — add `provisioning`
- **File:** `src/engine/types.ts` — `VolumeSpec` interface
- Add `provisioning: 'fixed' | 'thin'` (default `'fixed'`)
- `SuggestedVolume` inherits it (extends VolumeSpec)

### 2B. Remove CSV-level resiliency from workloads
- **Remove fields:**
  - `virtualMachines.resiliency` from `VmScenario`
  - `aks.resiliency` from `AksInputs`
  - `mabs.scratchResiliency` and `mabs.backupResiliency` from `MabsInputs`
- **Keep fields:**
  - `mabs.internalMirror` (guest Storage Spaces)
  - `sofs.internalMirror` (guest S2D)
  - `advanced.defaultResiliency` (default for new volume suggestions)

### 2C. AKS — multi-cluster model
- Replace flat `AksInputs` with:
```typescript
AksInputs {
  enabled: boolean
  clusters: AksCluster[]
}
AksCluster {
  id: string
  name: string
  controlPlaneNodesPerCluster: 1 | 3
  workerNodesPerCluster: number
  vCpusPerWorker: number
  memoryPerWorkerGB: number
  osDiskPerNodeGB: number
  persistentVolumesTB: number
}
```
- Remove `dataServicesTB` (handled by Arc service presets)
- Remove `resiliency` (per-volume now)
- Remove `clusterCount` (replaced by array length)

### 2D. VMs — storage groups
- Replace flat `VmScenario` with:
```typescript
VmScenario {
  enabled: boolean
  vCpuOvercommitRatio: number
  groups: VmStorageGroup[]
}
VmStorageGroup {
  id: string
  name: string
  vmCount: number
  vCpusPerVm: number
  memoryPerVmGB: number
  storagePerVmGB: number
}
```

### 2E. SOFS — volume layout + OS disks
- Add to `SofsInputs`:
  - `volumeLayout: 'shared' | 'per-vm'` (default `'shared'`)
  - `sofsOsDiskPerVmGB: number` (default `127`)

### 2F. AVD — remove S2D storage location
- Remove `'s2d'` from `AvdProfileStorageLocation` union type
- Keep: `'sofs' | 'azure-files' | 'external'`

### 2G. Custom workloads — remove resiliency
- Remove `resiliency` from `CustomWorkload` interface

### 2H. Remove `volumeProvisioning` from `HardwareInputs`

### 2I. Store migration function (v8→v9)
- **File:** `src/state/store.ts`
- Migrate `aks` flat → `aks.clusters[]` (wrap existing values in single cluster)
- Migrate `virtualMachines` flat → `virtualMachines.groups[]` (wrap in single group)
- Migrate AVD pools with `storageLocation: 's2d'` → `'sofs'`
- Drop removed fields
- Set default `provisioning: 'fixed'` on existing volumes

---

## Phase 3: Hardware Page Cleanup (*depends on 2H*)

### 3A. Remove volume provisioning dropdown
- **File:** `src/components/HardwareForm.tsx` lines 303–308
- Delete the `<Field label="Volume provisioning">` block. Provisioning is now per-volume.

### 3B. Hardware — confirm what stays
- OEM Preset, Node count, Capacity drives/node, Capacity drive size/type, Cache drives/node, Cache drive size/type, CPU cores/node, RAM/node — all stay.
- Cache drives: currently ignored by engine. Leave as-is for now (informational for OEM preset context). Future phase can wire them into cache-aware calculations.
- GPU, Network, 3-tier: out of scope for v2.0. Document as future work.

---

## Phase 4: AVD Planner Intelligence (*depends on 2F*)

### 4A. Remove "Profiles on S2D" storage option
- **File:** `src/components/AvdPlanner.tsx`
- Drop `'s2d'` option from the storage location selector per pool.

### 4B. Conditional field behavior based on storage location
- **SOFS selected:** All profile fields active (profile size, growth buffer, office container, user mix). All inputs required. SOFS sync active.
- **Azure Files / External selected:** Profile fields visible but read-only/dimmed. Label: "Estimated reference only — profile storage is not hosted on this Azure Local cluster." Values still computed for informational display but NOT included in cluster storage totals (already tracked as `externalizedStorageTB`).

### 4C. Separate data/temp disk from profiles
- Move "Data / temp disk per host (GB)" into its own "Session Host VM Storage" section, visually separated from the FSLogix profile section. This is per-session-host-VM storage, not profile storage.

### 4D. AVD ↔ Compute integration
- AVD session hosts are VMs with per-pool specs (light=2vCPU/8GB, medium=4/16, heavy=8/32, power=16/64). The compute pipeline already includes AVD in `workloads.ts` aggregation. Verify the reporting pipeline shows AVD session host breakdown alongside other workloads in the Final Report and new AVD Report tab.

---

## Phase 5: AKS Planner Overhaul (*depends on 2C*)

### 5A. Multi-cluster UI
- **File:** `src/pages/AksPage.tsx`
- Replace single-cluster form with add/remove cluster cards (same pattern as AVD host pools).
- Each cluster card: name, control plane (1 or 3), workers, vCPU/worker, RAM/worker, OS disk/node, PVC storage.
- Summary: aggregate totals across all clusters.

### 5B. Remove resiliency and data services
- Remove resiliency selector from AKS page
- Remove `dataServicesTB` field (Arc presets cover this)

### 5C. Engine update
- **File:** `src/engine/aks.ts`
- `computeAks()` iterates `clusters[]` and sums totals. Control plane always 4vCPU/16GB per node.

---

## Phase 6: Arc Services → AKS Integration (*depends on 5*)

### 6A. Presets consume AKS worker capacity
- **File:** `src/engine/service-presets.ts`
- Arc preset vCPUs/memory count AGAINST AKS worker pool capacity, not on top of it.
- In reporting: show Arc presets as sub-items under AKS, with warning if preset demand exceeds total worker capacity.

### 6B. Preset storage → AKS PVCs
- Arc preset storage flows as PVC storage within AKS cluster, not as standalone volume suggestions.
- **File:** `src/engine/workload-volumes.ts` — Arc presets add to AKS PVC volumes instead of generating their own.

### 6C. Enforce AKS dependency
- If any Arc preset is enabled but AKS is disabled, show blocking error (upgrade existing banner).

---

## Phase 7: SOFS Planner Overhaul (*depends on 2E*)

### 7A. Volume layout switch
- **File:** `src/components/SofsPlanner.tsx`
- New toggle: "Volume layout: Single shared volume / One per SOFS VM"
- Affects volume suggestion count: 1 volume or N volumes (N = sofsGuestVmCount)

### 7B. SOFS OS disk volumes
- Add `sofsOsDiskPerVmGB` field to SOFS planner UI (default 127 GB)
- Volume suggestions generate OS disk volume(s): `SOFS-OsDisk` or `SOFS-VM1-OsDisk`, `SOFS-VM2-OsDisk` etc.
- OS disk volumes default to three-way-mirror

### 7C. Volume suggestion update
- **File:** `src/engine/workload-volumes.ts`
- **Shared mode:** 1 `SOFS-ProfileData` volume (size = `internalFootprintTB`) + 1 `SOFS-OsDisk` volume (N VMs × osDiskPerVmGB)
- **Per-VM mode:** N `SOFS-VM{i}-Data` volumes (each `internalFootprintTB / N`) + N `SOFS-VM{i}-OsDisk` volumes
- All get `provisioning: 'fixed'` default, `resiliency: advanced.defaultResiliency`

### 7D. SOFS volume suggestions are ONLY for Azure Local host-level
- The SOFS internal mirror compounding already accounts for guest-level storage demand.
- NO guest-level volumes appear on the Volumes page — only the Azure Local CSV volumes that back the SOFS VMs.

### 7E. Compute/memory verified in reports
- `sofsVCpusTotal` and `sofsMemoryTotalGB` already in aggregation. Verify N+1 failover includes SOFS VMs.

---

## Phase 8: MABS Planner Cleanup (*depends on 2B*)

### 8A. Remove CSV-level resiliency selectors
- **File:** `src/pages/MabsPage.tsx`
- Remove `scratchResiliency` and `backupResiliency` dropdowns.
- Keep `internalMirror` (Storage Spaces inside MABS VM).

### 8B. Volume suggestions update
- **File:** `src/engine/workload-volumes.ts`
- MABS still generates 3 volumes: `MABS-Scratch`, `MABS-BackupData`, `MABS-OsDisk`
- Sizes account for `internalMirror` factor (already correct)
- All get `resiliency: advanced.defaultResiliency` (editable on Volumes page)
- **Provisioning defaults:** `MABS-BackupData` → `thin` (grows over retention period), `MABS-Scratch` → `fixed`, `MABS-OsDisk` → `fixed`

### 8C. MABS volumes are ONLY Azure Local host-level
- Same as SOFS — no guest-level volumes on Volumes page. Only the Azure Local CSVs backing the MABS VM.

---

## Phase 9: Virtual Machines Intelligence (*depends on 2D*)

### 9A. Storage groups UI
- **File:** `src/components/WorkloadPlanner.tsx` — VM ScenarioCard
- Default: 1 group (backward compatible). User can add groups.
- Each group: name, VM count, vCPUs/VM, RAM/VM, storage/VM.
- Each group generates a separate volume suggestion.

### 9B. Volume suggestions update
- **File:** `src/engine/workload-volumes.ts`
- Per group: `VM-{groupName}` volume, size = `vmCount × storagePerVmGB / 1024`
- `provisioning: 'fixed'` default, `resiliency: advanced.defaultResiliency`

---

## Phase 10: Custom Workloads (*depends on 2G*)

### 10A. Remove resiliency from template
- **File:** `src/components/CustomWorkloads.tsx`
- Drop `resiliency` from JSON template and UI.

### 10B. Wire `internalMirrorFactor`
- **File:** `src/engine/custom-workloads.ts`
- Currently stored but NOT used. Apply it: `storageTB × internalMirrorFactor` for volume suggestion size.

### 10C. Volume suggestions per custom workload
- OS disk volume: `{name}-OsDisk` if `osDiskPerVmGB > 0`, three-way-mirror default, `fixed`
- Data volume: `{name}-Data`, size = `storageTB × internalMirrorFactor`, default resiliency, `fixed`

### 10D. JSON import validation
- Validate imported JSON against `CustomWorkload` schema. Reject malformed with clear errors.

---

## Phase 11: Workload Planner Totals (*depends on 5, 6, 9*)

### 11A. Fix vCPU/Memory bars at top of WorkloadPlanner
- **File:** `src/components/WorkloadPlanner.tsx` — top aggregation section
- Arc service presets currently add on top of AKS. After Phase 6, Arc presets consume AKS worker capacity → remove double-counting from workload planner totals.
- Verify each workload's contribution is correct after all schema changes.

---

## Phase 12: Volumes Page Overhaul (*depends on all workload phases*)

This is the biggest and most critical phase. Every section of the Volumes page needs work.

### 12A. Quick Start / Reference Section — COMPLETE REWRITE
**Current problems:**
- "Reference scenario does not fit" errors from TB↔TiB rounding artifacts (69.93 > 69.91)
- Uses "Scenario" column header (confusing)
- Only shows one resiliency type
- Has "Fits?" column with FAIL status on what should be a pure reference

**New design:**
- **Pure hardware reference** — takes ONLY hardware inputs + node count. Zero workload dependency.
- **Title:** "Microsoft Best Practice — Volume Reference"
- **Subtitle:** "What the cluster deployment wizard would create if you selected automatic volume creation."
- **Two rows:** One for Three-Way Mirror, one for Two-Way Mirror
- **Columns:** Resiliency | Volume Count | Calculator Size (TB) | WAC / PowerShell Size (TiB) | WAC Size (GiB) | Pool Footprint (TB)
- **Remove:** "Fits?" column, "Scenario" column, FAIL/PASS status, pool footprint comparison.
- **Fix rounding:** After TiB floor conversion, subtract 1 GiB from `wacSizeGiB` to guarantee fit. This is a reference value, not exact — a tiny margin is better than a FAIL on a reference table.
- **PowerShell script:** Keep copy-to-clipboard one-liner, updated for both resiliency variants.

### 12B. Volume Mode Toggle — stays as-is
- Generic mode vs Workload-based mode toggle. No changes needed to the toggle itself.

### 12C. Suggested Volumes Section (Generic mode)
**Current:** Equal-split volumes from hardware capacity.
**Changes:**
- Add per-suggestion **resiliency dropdown** column (three-way-mirror, two-way-mirror, dual-parity). Default from `advanced.defaultResiliency`.
- Add per-suggestion **provisioning dropdown** column (fixed / thin). Default `fixed`.
- When user clicks "Add" or "Add All" → volumes move to the planned volumes table below with chosen resiliency + provisioning.

### 12D. Suggested Volumes Section (Workload mode)
**Current:** Auto-generated from enabled workloads. Groups by source (AVD, AKS, VMs, SOFS, MABS, presets, custom).
**Changes:**
- Add per-suggestion **resiliency dropdown** (same as generic). Default from `advanced.defaultResiliency`.
- Add per-suggestion **provisioning dropdown** (fixed / thin). Workload-specific defaults:
  - MABS-BackupData → `thin`
  - Everything else → `fixed`
- **Important:** Suggestions ONLY show Azure Local host-level volumes. SOFS internal mirror is reflected in the SIZE of the SOFS volume (already compounded), but no "guest" volumes appear here. Same for MABS.
- The intelligence from workload planners (SOFS volume layout shared/per-VM, VM storage groups, AKS multi-cluster, etc.) feeds into the number and size of suggested volumes.
- When user clicks "Add" or "Add All" → volumes move to planned table with chosen settings.

### 12E. Planned Volumes Table (VolumeTable)
**Current columns:** Name | Resiliency | Planned (TiB) | New-Volume GiB | Edit/Delete
**New columns:** Name | Resiliency | Provisioning (Fixed/Thin) | Planned (TiB) | New-Volume GiB | Pool Footprint (TB) | Edit/Delete
- Inline editor gains provisioning dropdown.
- Pool footprint per-row: `plannedSizeTB / resiliencyFactor` — shows real pool consumption per volume.

### 12F. Add Custom Volume
**Current:** Name + Size + Resiliency + Add button
**Changes:** Add provisioning (fixed/thin) dropdown to the add row.

### 12G. Storage Utilization Bar — FIX CALCULATION
**Current problem:** User reports bar goes red at 80% even when totals seem wrong.
**The bar's denominator is `effectiveUsableTB`** — this is the planning number AFTER reserve and overhead are removed.
- Green: <70%, Amber: 70–80%, Red: >80%
- **Fix:** Verify `totalPoolConsumptionTB` calculation is correct: `sum(plannedSizeTB / resiliencyFactor)` per volume. This must match the pool footprint column.
- **Thin provisioning awareness:** If any volume is `thin` provisioned, the bar should show logical allocation (what's provisioned) vs physical pool (what's consumed). Thin-provisioned volumes consume less physical pool initially but can grow.
- Add tooltip explaining: "This shows pool consumption relative to available capacity after reserves."

### 12H. Volume Health Check — OVERHAUL
**Current problems:**
- Has compute checks (vCPU, memory) mixed into volume health check
- Doesn't show healthy state clearly
- No thin provisioning awareness for over-provisioning

**New design:**
- **Remove compute checks** from volume health check. Compute belongs in the Compute Report.
- **Always show all checks** — healthy or not. Green check = pass, red X = fail, amber ! = warning.
- **Per-volume detail table:** Show every volume with its resiliency, provisioning, planned size, pool footprint, status.
- **Thin provisioning callout:** If any volume is thin-provisioned and the LOGICAL total exceeds effectiveUsableTB, show info message: "You are thin-provisioned by X TB over physical capacity. This is expected with thin provisioning but requires monitoring." This is informational (blue/gray), not red — thin provisioning by definition over-provisions.
- **Fixed-only check:** If ALL volumes are fixed and total exceeds capacity → ERROR (red).
- **Mixed check:** If some thin + some fixed, calculate fixed footprint separately. Fixed volumes MUST fit. Thin volumes can over-provision but warn.

**Health checks to keep (volume-specific only):**
1. Per-volume resiliency vs node count (error if insufficient nodes)
2. Per-volume size ≤ 64 TB limit
3. Total pool footprint vs available pool space (error for fixed, info for thin)
4. Volume count not a multiple of node count (info)
5. High utilization >70% (warning — Microsoft rebuild headroom guidance)
6. Dual parity requires ≥4 nodes

**Health checks to REMOVE from this section:**
- HC_VCPU_OVER_SUBSCRIBED → move to Compute Report
- HC_MEMORY_EXCEEDED → move to Compute Report
- HC_VCPU_HIGH → move to Compute Report
- HC_MEMORY_HIGH → move to Compute Report
- HC_THIN_PROVISIONING (global) → replaced by per-volume thin awareness

**Health checks to update:**
- HC_OVER_CAPACITY → split into "fixed over-capacity" (ERROR) and "thin over-provisioned" (INFO)

### 12I. Fix wrong calculations
- Audit `computeVolumeSummary()` — verify `totalPoolConsumptionTB = sum(plannedSizeTB / resiliencyFactor(vol.resiliency, nodeCount))`
- Resiliency factor must be per-volume, NOT global. Each volume has its own resiliency → its own factor.
- `remainingUsableTB = effectiveUsableTB - totalPlannedTB` (NOT pool consumption — this is the usable planning number)
- The utilization bar denominator must be `availableForVolumesTB` (raw pool space), NOT `effectiveUsableTB`. Pool consumption is raw pool consumption; it should be compared against raw pool availability.
- Run through test scenarios to validate numbers match expectations.

---

## Phase 13: Reports Overhaul (*depends on all workload phases*)

### 13A. Add conditional report tabs
- **File:** `src/pages/ReportsPage.tsx`
- **AVD Report** — conditional on `avdEnabled`. Per-pool session host breakdown, profile storage by location, bandwidth estimates, session host VM specs.
- **AKS Report** — conditional on `aks.enabled`. Per-cluster breakdown, node summary, Arc service preset consumption within AKS worker pool.
- **MABS Report** — conditional on `mabsEnabled`. Backup sizing summary, internal mirror impact, MABS VM specs, volume suggestions.
- **SOFS Report** — already exists. Verify it includes volume layout (shared/per-VM), OS disks, compute/memory, internal mirror impact.

### 13B. Final Report — combine everything
- All workloads: AVD, AKS (with Arc presets folded in), VMs (with storage groups), SOFS, MABS, custom workloads.
- Total compute: sum all vCPUs + memory. N+1 failover impact.
- Total storage: sum all volume suggestions with resiliency + provisioning.
- Volume summary: total planned, total pool footprint, utilization %.

### 13C. Capacity Report — verify accuracy
- Hardware-driven. Should be unaffected by workload changes. Verify numbers match Volumes page reference section.

### 13D. Compute Report — add moved checks
- Add the compute health checks removed from Volume Health Check (HC_VCPU_OVER_SUBSCRIBED, HC_MEMORY_EXCEEDED, etc.)

---

## Phase 14: Verification

### Automated
1. Build succeeds (`npm run build` — zero errors)
2. All existing tests pass (`npm test` — 63/63 currently)
3. New tests for:
   - AKS multi-cluster aggregation
   - VM storage group volume generation
   - SOFS shared vs per-VM volume count
   - Per-volume resiliency factor in pool footprint
   - Per-volume provisioning in volume suggestions
   - Quick Start reference calculations (both three-way and two-way)
   - Health check: thin over-provisioning info vs fixed error
   - Arc presets within AKS worker capacity
   - Store migration v8→v9

### Manual
1. Enable all workloads → verify WorkloadPlanner totals match sum of individual workloads
2. Switch to workload-based volumes → verify suggestions match workload planner inputs
3. Add suggested volumes → verify resiliency + provisioning carry over
4. Check utilization bar accuracy with known hardware inputs
5. Verify Quick Start reference section shows clean two-row table (three-way + two-way) with no FAIL
6. Verify health check shows all checks (green pass included)
7. Verify thin-provisioned volumes show over-provisioning info
8. Verify Final Report includes all workloads
9. Verify conditional tabs appear/disappear when workloads toggled

---

## Decisions

1. **Resiliency ownership:** Per-volume on Volumes page. `advanced.defaultResiliency` is the default for new suggestions. Workloads do NOT own CSV resiliency. Guest-level resiliency (SOFS internal mirror, MABS internal mirror) stays on workload sub-pages.
2. **Provisioning ownership:** Per-volume on Volumes page. No global toggle. Each volume can be fixed or thin independently.
3. **Arc presets:** Consume AKS worker capacity (not additive). Storage flows as AKS PVCs.
4. **SOFS/MABS volumes:** Only Azure Local host-level CSV volumes on Volumes page. Guest-internal storage is reflected in volume SIZE via internal mirror factor, not as separate volumes.
5. **Quick Start:** Pure hardware reference, no workload dependency, no FAIL status.
6. **Health check split:** Volume checks on Volumes page, compute checks in Compute Report.
7. **Thin provisioning:** Over-provisioning is expected and shown as info, not error.

---

## Scope Exclusions (Future Work)

- GPU support
- Network configuration
- 3-tier storage modeling
- Cache drive engine integration (fields stay as informational)
- Host OS overhead breakdown
- Stretched cluster / multi-site

---

## Relevant Files (comprehensive)

**Components:**
- `src/components/Layout.tsx` — remove Home nav
- `src/components/HardwareForm.tsx` — remove volume provisioning
- `src/components/WorkloadPlanner.tsx` — remove workload resiliency, VM storage groups, fix totals
- `src/components/AvdPlanner.tsx` — storage location intelligence, separate data disk
- `src/components/SofsPlanner.tsx` — volume layout switch, OS disk field
- `src/components/VolumeTable.tsx` — add provisioning column, pool footprint column, fix utilization bar
- `src/components/CustomWorkloads.tsx` — remove resiliency from template
- `src/components/HealthCheck.tsx` — remove compute checks, add thin awareness, always show all

**Pages:**
- `src/pages/AksPage.tsx` — multi-cluster UI
- `src/pages/MabsPage.tsx` — remove CSV resiliency
- `src/pages/VolumesPage.tsx` — rewrite Quick Start, update suggestions, fix calculations
- `src/pages/ReportsPage.tsx` — add AVD/AKS/MABS tabs
- `src/pages/DocsPage.tsx` — architecture docs
- `src/pages/AboutPage.tsx` — release history

**Engine:**
- `src/engine/types.ts` — VolumeSpec, AksCluster, VmStorageGroup, SofsInputs, CustomWorkload changes
- `src/engine/aks.ts` — multi-cluster computation
- `src/engine/sofs.ts` — no changes (internal mirror already correct)
- `src/engine/mabs.ts` — no changes (internal mirror already correct)
- `src/engine/volumes.ts` — fix Quick Start, fix computeVolumeSummary, fix utilization
- `src/engine/workload-volumes.ts` — all suggestion changes (provisioning, layout, Arc→AKS)
- `src/engine/service-presets.ts` — AKS worker capacity accounting
- `src/engine/custom-workloads.ts` — wire internalMirrorFactor
- `src/engine/workloads.ts` — fix aggregation (Arc within AKS)
- `src/engine/healthcheck.ts` — split compute/volume, thin awareness
- `src/engine/capacity.ts` — no changes expected

**State:**
- `src/state/store.ts` — migration v8→v9, all schema changes
