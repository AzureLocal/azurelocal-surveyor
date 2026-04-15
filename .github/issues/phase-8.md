# Phase 8: MABS Planner Cleanup

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P1  
**Depends on:** Phase 2 (2B — CSV-level resiliency removed from MABS)  
**Estimate:** S  

---

## Context

The MABS (Microsoft Azure Backup Server) planner has CSV-level resiliency selectors that should be removed. Resiliency is now per-volume on the Volumes page. The internal mirror (guest-level Storage Spaces inside the MABS VM) must stay because it's a real configuration choice that affects the total storage demand. MABS volumes on the Volumes page represent Azure Local host-level CSVs only.

## Current State

- **File:** `src/pages/MabsPage.tsx` — MABS planner UI
- **File:** `src/engine/workload-volumes.ts` — MABS volume suggestions
- **File:** `src/engine/mabs.ts` — MABS compute engine
- Has `scratchResiliency` and `backupResiliency` dropdowns on the page
- Has `internalMirror` setting (guest Storage Spaces — this stays)
- Generates 3 volume suggestions: MABS-Scratch, MABS-BackupData, MABS-OsDisk
- Volumes account for internal mirror factor in their sizes

## Required Changes

### 8A. Remove CSV-level resiliency selectors
- Remove `scratchResiliency` dropdown from MABS page UI
- Remove `backupResiliency` dropdown from MABS page UI
- Keep `internalMirror` setting (guest-level Storage Spaces)

### 8B. Volume suggestions update
- MABS still generates 3 volumes: `MABS-Scratch`, `MABS-BackupData`, `MABS-OsDisk`
- Sizes continue to account for `internalMirror` factor (already correct)
- All volumes get `resiliency: advanced.defaultResiliency` (user can change on Volumes page)
- **Provisioning defaults:**
  - `MABS-BackupData` → `'thin'` (grows over retention period — natural fit for thin provisioning)
  - `MABS-Scratch` → `'fixed'`
  - `MABS-OsDisk` → `'fixed'`

### 8C. Guest volumes stay OFF the Volumes page
- Same rule as SOFS: no guest-level volumes on Volumes page
- Only Azure Local CSV volumes backing the MABS VM appear as suggestions

## Files Affected

| File | Changes |
|------|---------|
| `src/pages/MabsPage.tsx` | Remove scratchResiliency and backupResiliency dropdowns |
| `src/engine/workload-volumes.ts` | Update MABS volume suggestions with provisioning defaults |

## Acceptance Criteria

- [ ] `scratchResiliency` dropdown is NOT present on the MABS page
- [ ] `backupResiliency` dropdown is NOT present on the MABS page
- [ ] `internalMirror` setting IS still present and functional on the MABS page
- [ ] MABS volume suggestions generate exactly 3 volumes: MABS-Scratch, MABS-BackupData, MABS-OsDisk
- [ ] Volume sizes correctly account for `internalMirror` factor
- [ ] `MABS-BackupData` has `provisioning: 'thin'` as default
- [ ] `MABS-Scratch` has `provisioning: 'fixed'` as default
- [ ] `MABS-OsDisk` has `provisioning: 'fixed'` as default
- [ ] All MABS volumes have `resiliency: advanced.defaultResiliency` as default
- [ ] No guest-level volumes appear on the Volumes page
- [ ] `npm run build` succeeds with zero errors
- [ ] All existing tests pass (`npm test`)
- [ ] Visual inspection confirms MABS page is clean without the removed dropdowns
