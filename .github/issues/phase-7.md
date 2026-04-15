# Phase 7: SOFS Planner Overhaul

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P1  
**Depends on:** Phase 2 (2E — SOFS volume layout + OS disk fields)  
**Estimate:** L  

---

## Context

The SOFS (Scale-Out File Server) planner has significant planning gaps. It lacks the ability to choose between a single shared volume vs per-VM volumes for SOFS data. It doesn't account for SOFS VM OS disks. The volume suggestion logic needs to be overhauled to support these new options. Importantly, SOFS volumes on the Volumes page represent Azure Local host-level CSV volumes only — the internal guest mirror is already reflected in the volume SIZE through the internal mirror factor.

## Current State

- **File:** `src/components/SofsPlanner.tsx` — SOFS planner UI
- **File:** `src/engine/workload-volumes.ts` — SOFS volume suggestions
- **File:** `src/engine/sofs.ts` — SOFS compute engine (internal mirror calculations)
- Current suggestions generate profile data volumes but no OS disk volumes
- No option to choose between shared or per-VM volume layout
- Internal mirror factor correctly compounds storage → the *size* of volumes accounts for guest redundancy
- SOFS VM count, vCPUs, memory are already in the planner

## Required Changes

### 7A. Volume layout switch
- Add toggle to SOFS planner UI: "Volume layout: Single shared volume / One per SOFS VM"
- Default: "Single shared volume" (`'shared'`)
- This affects the COUNT of volume suggestions, not the total size

### 7B. SOFS OS disk volumes
- Add `sofsOsDiskPerVmGB` field to SOFS planner UI (default: 127 GB)
- Volume suggestions must generate OS disk volume(s):
  - **Shared mode:** 1 `SOFS-OsDisk` volume (N VMs × osDiskPerVmGB)
  - **Per-VM mode:** N `SOFS-VM{i}-OsDisk` volumes (each = osDiskPerVmGB)
- OS disk volumes default to three-way-mirror resiliency

### 7C. Volume suggestion update — data volumes
- **File:** `src/engine/workload-volumes.ts`
- **Shared mode:** 1 `SOFS-ProfileData` volume (size = `internalFootprintTB` — total profile data after internal mirror compounding)
- **Per-VM mode:** N `SOFS-VM{i}-Data` volumes (each = `internalFootprintTB / N`)
- All data volumes get `provisioning: 'fixed'` default, `resiliency: advanced.defaultResiliency`

### 7D. Guest volumes stay OFF the Volumes page
- The SOFS internal mirror compounding already accounts for guest-level storage demand in the volume SIZE
- NO guest-level volumes appear on the Volumes page — only Azure Local CSV volumes that back the SOFS VMs
- This is a design rule, not a code change — ensure no code generates guest-level volume suggestions

### 7E. Compute/memory verification
- `sofsVCpusTotal` and `sofsMemoryTotalGB` already exist in aggregation
- Verify N+1 failover calculations include SOFS VMs

## Files Affected

| File | Changes |
|------|---------|
| `src/components/SofsPlanner.tsx` | Volume layout toggle, OS disk per VM field |
| `src/engine/workload-volumes.ts` | SOFS volume suggestions (shared vs per-VM, OS disks) |
| `src/engine/types.ts` | Already done in Phase 2E |

## Acceptance Criteria

- [ ] SOFS planner shows a "Volume layout" toggle with "Single shared volume" and "One per SOFS VM" options
- [ ] Default selection is "Single shared volume"
- [ ] SOFS planner shows an "OS Disk per VM (GB)" field with default value of 127
- [ ] **Shared mode:** Volume suggestions show exactly 1 `SOFS-ProfileData` volume + 1 `SOFS-OsDisk` volume
- [ ] **Per-VM mode (N VMs):** Volume suggestions show N `SOFS-VM{i}-Data` volumes + N `SOFS-VM{i}-OsDisk` volumes
- [ ] Total data volume size (shared or sum of per-VM) equals `internalFootprintTB`
- [ ] OS disk volume size in shared mode = N × osDiskPerVmGB; in per-VM mode = osDiskPerVmGB each
- [ ] OS disk volumes default to three-way-mirror resiliency
- [ ] Data volumes default to `advanced.defaultResiliency`
- [ ] All suggested volumes have `provisioning: 'fixed'` by default
- [ ] NO guest-level volumes (internal mirror volumes) appear on the Volumes page
- [ ] SOFS VM compute/memory contributions are correctly included in workload aggregation
- [ ] N+1 failover calculations include SOFS VMs
- [ ] `npm run build` succeeds with zero errors
- [ ] New tests for shared vs per-VM volume count and sizes
- [ ] All existing tests pass (`npm test`)
- [ ] Visual inspection confirms clean SOFS planner layout with new controls
