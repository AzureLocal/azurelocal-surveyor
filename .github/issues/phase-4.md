# Phase 4: AVD Planner Intelligence

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P1  
**Depends on:** Phase 2 (2F — S2D removed from `AvdProfileStorageLocation`)  
**Estimate:** M  

---

## Context

The AVD Planner needs intelligence improvements. The S2D storage option must be removed. When users select a storage location for profiles, the UI should behave differently: SOFS makes profile fields active and required, while Azure Files and External make profile fields informational-only (since that storage lives outside the Azure Local cluster). Additionally, the data/temp disk setting needs to be visually separated from the profile section since it represents per-session-host-VM storage, not profile storage.

## Current State

- **File:** `src/components/AvdPlanner.tsx`
- Storage location selector includes S2D, SOFS, Azure Files, External
- All profile fields are always active regardless of storage location
- Data/temp disk per host is in the same section as profile settings
- AVD session hosts contribute to compute totals via `workloads.ts` aggregation

## Required Changes

### 4A. Remove "Profiles on S2D" storage option
- Drop `'s2d'` option from the storage location selector per host pool
- This aligns with the type change in Phase 2F

### 4B. Conditional field behavior based on storage location
- **SOFS selected:**
  - All profile fields active and required (profile size, growth buffer, office container, user mix)
  - All inputs editable with normal styling
  - SOFS sync remains active
- **Azure Files or External selected:**
  - Profile fields visible but read-only/dimmed (reduced opacity or disabled styling)
  - Label above fields: "Estimated reference only — profile storage is not hosted on this Azure Local cluster."
  - Values still computed for informational display
  - Profile storage is NOT included in cluster storage totals (should already flow through `externalizedStorageTB`)

### 4C. Separate data/temp disk from profiles
- Move "Data / temp disk per host (GB)" into its own section titled "Session Host VM Storage"
- Visually separate it from the FSLogix profile section (e.g., separate card, divider, or section header)
- This is per-session-host-VM local storage, distinct from profile storage

### 4D. AVD ↔ Compute integration verification
- AVD session hosts have per-pool specs (light=2vCPU/8GB, medium=4/16, heavy=8/32, power=16/64)
- The compute pipeline already includes AVD in `workloads.ts` aggregation
- Verify the reporting pipeline shows AVD session host breakdown in the Final Report and new AVD Report tab (Phase 13)

## Files Affected

| File | Changes |
|------|---------|
| `src/components/AvdPlanner.tsx` | Remove S2D option, conditional field behavior, separate data disk section |

## Acceptance Criteria

- [ ] S2D is no longer available as a storage location option in the AVD planner
- [ ] When SOFS is selected as storage location, all profile fields are active and editable
- [ ] When Azure Files is selected, profile fields are visually dimmed/disabled with an informational label
- [ ] When External is selected, profile fields are visually dimmed/disabled with an informational label
- [ ] The informational label text reads: "Estimated reference only — profile storage is not hosted on this Azure Local cluster."
- [ ] Profile storage with Azure Files/External does NOT contribute to cluster storage totals
- [ ] Profile storage with SOFS DOES contribute to cluster storage totals through SOFS sync
- [ ] "Data / temp disk per host" is in a separate "Session Host VM Storage" section, visually distinct from profiles
- [ ] Data/temp disk values still correctly contribute to per-VM storage calculations
- [ ] AVD session host vCPU/memory contributions remain correct in workload aggregation
- [ ] All per-pool workload tiers (light/medium/heavy/power) correctly map to vCPU/memory specs
- [ ] `npm run build` succeeds with zero errors
- [ ] All existing tests pass (`npm test`)
- [ ] Visual inspection confirms clean layout with proper section separation
