# Phase 12: Volumes Page Overhaul

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P0 — **Critical path, largest phase**  
**Depends on:** All workload phases (3–11)  
**Estimate:** XL  

---

## Context

The Volumes page is the most critical and most broken part of the application. Every section needs work: Quick Start has rounding bugs and misleading FAIL status, suggested volumes lack resiliency/provisioning controls, the volume table lacks provisioning and pool footprint columns, the utilization bar calculation is wrong, and the health check mixes compute checks with volume checks. This is the single largest phase of the v2.0 overhaul.

---

## Required Changes

### 12A. Quick Start / Reference Section — COMPLETE REWRITE

**Current problems:**
- TB↔TiB conversion cycle creates rounding artifacts (e.g., 69.93 > 69.91 TB → FAIL)
- Uses "Scenario" column header (confusing)
- Only shows one resiliency type
- Has "Fits?" column with FAIL status on what should be a pure reference

**New design:**
- **Pure hardware reference** — takes ONLY hardware inputs + node count. Zero workload dependency.
- **Title:** "Microsoft Best Practice — Volume Reference"
- **Subtitle:** "What the cluster deployment wizard would create if you selected automatic volume creation."
- **Two rows:** One for Three-Way Mirror, one for Two-Way Mirror
- **Columns:** Resiliency | Volume Count | Calculator Size (TB) | WAC / PowerShell Size (TiB) | WAC Size (GiB) | Pool Footprint (TB)
- **Remove:** "Fits?" column, "Scenario" column, FAIL/PASS status, pool footprint comparison
- **Fix rounding:** After TiB floor conversion, subtract 1 GiB from `wacSizeGiB` to guarantee fit. Reference table should never show errors.
- **PowerShell script:** Keep copy-to-clipboard one-liner, updated for both resiliency variants

**Files:** `src/pages/VolumesPage.tsx`, `src/engine/volumes.ts`

### 12B. Volume Mode Toggle
- Generic mode vs Workload-based mode toggle — **no changes needed** to the toggle itself

### 12C. Suggested Volumes Section (Generic mode)
- **Current:** Equal-split volumes from hardware capacity
- **Add:** Per-suggestion **resiliency dropdown** column (three-way-mirror, two-way-mirror, dual-parity). Default from `advanced.defaultResiliency`.
- **Add:** Per-suggestion **provisioning dropdown** column (fixed / thin). Default: `fixed`.
- When user clicks "Add" or "Add All" → volumes move to planned volumes table with chosen resiliency + provisioning

### 12D. Suggested Volumes Section (Workload mode)
- **Current:** Auto-generated from enabled workloads, grouped by source
- **Add:** Per-suggestion **resiliency dropdown** (same as generic). Default from `advanced.defaultResiliency`.
- **Add:** Per-suggestion **provisioning dropdown** (fixed / thin). Workload-specific defaults:
  - `MABS-BackupData` → `'thin'`
  - Everything else → `'fixed'`
- **Important:** Suggestions ONLY show Azure Local host-level volumes. SOFS internal mirror reflected in SIZE, not as separate guest volumes. Same for MABS.
- Intelligence from workload planners feeds into suggestion count and sizes (SOFS layout, VM groups, AKS clusters, etc.)
- "Add" / "Add All" → volumes move to planned table with chosen settings

### 12E. Planned Volumes Table (VolumeTable)
- **Current columns:** Name | Resiliency | Planned (TiB) | New-Volume GiB | Edit/Delete
- **New columns:** Name | Resiliency | Provisioning (Fixed/Thin) | Planned (TiB) | New-Volume GiB | Pool Footprint (TB) | Edit/Delete
- Inline editor gains provisioning dropdown
- Pool footprint per-row: `plannedSizeTB / resiliencyFactor` — real pool consumption per volume

**File:** `src/components/VolumeTable.tsx`

### 12F. Add Custom Volume
- **Current:** Name + Size + Resiliency + Add button
- **Add:** Provisioning (fixed/thin) dropdown to the add row

### 12G. Storage Utilization Bar — FIX CALCULATION
**Current problem:** Bar goes red at 80% even when totals seem wrong.
- The bar's denominator should be `availableForVolumesTB` (raw pool space), NOT `effectiveUsableTB`
- Numerator: `totalPoolConsumptionTB` = sum of all volumes' pool footprints
- Green: <70%, Amber: 70–80%, Red: >80%
- **Thin provisioning awareness:** If any volume is thin-provisioned, show logical allocation vs physical pool consumption. Thin volumes consume less physical pool initially but can grow.
- Add tooltip: "This shows pool consumption relative to available capacity after reserves."

**File:** `src/engine/volumes.ts` — `computeVolumeSummary()`

### 12H. Volume Health Check — OVERHAUL

**Remove compute checks:**
- HC_VCPU_OVER_SUBSCRIBED → move to Compute Report (Phase 13)
- HC_MEMORY_EXCEEDED → move to Compute Report
- HC_VCPU_HIGH → move to Compute Report
- HC_MEMORY_HIGH → move to Compute Report
- HC_THIN_PROVISIONING (global) → replaced by per-volume thin awareness

**New behavior:**
- Always show ALL checks — healthy or not. Green ✓ = pass, red ✗ = fail, amber ⚠ = warning
- Per-volume detail table: show every volume with resiliency, provisioning, planned size, pool footprint, status
- **Fixed-only:** If ALL volumes are fixed and total exceeds capacity → ERROR (red)
- **Thin volumes:** If LOGICAL total exceeds effectiveUsableTB → INFO (blue): "You are thin-provisioned by X TB over physical capacity. This is expected with thin provisioning but requires monitoring."
- **Mixed:** Fixed volumes MUST fit. Thin can over-provision but warn.

**Checks to keep (volume-specific only):**
1. Per-volume resiliency vs node count (error if insufficient nodes)
2. Per-volume size ≤ 64 TB limit
3. Total pool footprint vs available pool space (error for fixed, info for thin)
4. Volume count not multiple of node count (info)
5. High utilization >70% (warning — Microsoft rebuild headroom guidance)
6. Dual parity requires ≥4 nodes

**Files:** `src/components/HealthCheck.tsx`, `src/engine/healthcheck.ts`

### 12I. Fix wrong calculations
- Audit `computeVolumeSummary()`:
  - `totalPoolConsumptionTB = sum(plannedSizeTB / resiliencyFactor(vol.resiliency, nodeCount))` — per-volume, NOT global
  - `remainingUsableTB = effectiveUsableTB - totalPlannedTB`
  - Utilization bar denominator = `availableForVolumesTB` (raw pool), not `effectiveUsableTB`
- Run through test scenarios to validate numbers

**File:** `src/engine/volumes.ts`

---

## Files Affected

| File | Changes |
|------|---------|
| `src/pages/VolumesPage.tsx` | Rewrite Quick Start, update suggestion sections with resiliency/provisioning dropdowns |
| `src/engine/volumes.ts` | Fix Quick Start rounding, fix computeVolumeSummary, fix utilization denominator |
| `src/components/VolumeTable.tsx` | Add provisioning column, pool footprint column, inline editor provisioning |
| `src/components/HealthCheck.tsx` | Remove compute checks, always show all, per-volume detail table, thin awareness |
| `src/engine/healthcheck.ts` | Split volume/compute checks, thin over-provisioning logic |
| `src/engine/workload-volumes.ts` | All suggestion changes from workload phases feed in here |

---

## Acceptance Criteria

### Quick Start (12A)
- [ ] Quick Start section title is "Microsoft Best Practice — Volume Reference"
- [ ] Subtitle text present: "What the cluster deployment wizard would create..."
- [ ] Table shows exactly TWO rows: Three-Way Mirror and Two-Way Mirror
- [ ] Columns: Resiliency | Volume Count | Calculator Size (TB) | WAC/PowerShell Size (TiB) | WAC Size (GiB) | Pool Footprint (TB)
- [ ] NO "Fits?" column, NO FAIL/PASS status
- [ ] Rounding is correct: TiB floor with 1 GiB safety margin subtracted
- [ ] PowerShell script copy button works for both resiliency variants
- [ ] Quick Start depends ONLY on hardware inputs (no workload dependency)

### Suggested Volumes (12C, 12D)
- [ ] Generic mode suggestions have per-row resiliency dropdown
- [ ] Generic mode suggestions have per-row provisioning dropdown (fixed/thin)
- [ ] Workload mode suggestions have per-row resiliency dropdown
- [ ] Workload mode suggestions have per-row provisioning dropdown
- [ ] MABS-BackupData defaults to `thin`, all others default to `fixed`
- [ ] "Add" / "Add All" carries chosen resiliency and provisioning to planned table
- [ ] No guest-level volumes (SOFS internal, MABS internal) appear in suggestions

### Volume Table (12E, 12F)
- [ ] Table has columns: Name | Resiliency | Provisioning | Planned (TiB) | New-Volume GiB | Pool Footprint (TB) | Edit/Delete
- [ ] Inline editor includes provisioning dropdown
- [ ] Pool footprint per-row = plannedSizeTB / resiliencyFactor
- [ ] Custom volume add includes provisioning dropdown

### Utilization Bar (12G)
- [ ] Denominator is `availableForVolumesTB` (raw pool)
- [ ] Numerator is sum of all volumes' pool footprints
- [ ] Green <70%, Amber 70–80%, Red >80%
- [ ] Thin provisioning shows logical vs physical consumption
- [ ] Tooltip explains what the bar represents

### Health Check (12H)
- [ ] Compute checks (vCPU, memory) are NOT in the volume health check
- [ ] ALL checks always shown (green pass, red fail, amber warning)
- [ ] Per-volume detail table shows every volume with status
- [ ] Fixed volumes exceeding capacity → ERROR
- [ ] Thin over-provisioning → INFO (blue), not ERROR
- [ ] Mixed fixed+thin: fixed must fit, thin can over-provision with warning
- [ ] Resiliency vs node count check per-volume
- [ ] 64 TB per-volume limit check
- [ ] High utilization >70% warning
- [ ] Dual parity ≥4 nodes check

### Calculations (12I)
- [ ] `totalPoolConsumptionTB` uses per-volume resiliency factors, not global
- [ ] `remainingUsableTB` correctly computed
- [ ] Test scenarios validate numbers match expectations

### General
- [ ] `npm run build` succeeds with zero errors
- [ ] All existing tests pass
- [ ] New tests for: Quick Start calculations, per-volume resiliency pool footprint, thin provisioning health check logic
- [ ] Manual verification with known hardware inputs confirms correct numbers
