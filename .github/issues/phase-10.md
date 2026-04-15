# Phase 10: Custom Workloads Cleanup

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P2  
**Depends on:** Phase 2 (2G — resiliency removed from `CustomWorkload`)  
**Estimate:** M  

---

## Context

Custom workloads allow users to define arbitrary workloads via JSON or UI. The resiliency field needs to be removed (now per-volume). The `internalMirrorFactor` field exists in the type but is NOT currently used by the engine — it needs to be wired in. Volume suggestions need to generate both OS disk and data volumes per custom workload. JSON import needs schema validation.

## Current State

- **File:** `src/components/CustomWorkloads.tsx` — custom workload UI
- **File:** `src/engine/custom-workloads.ts` — custom workload engine
- **File:** `src/engine/workload-volumes.ts` — custom workload volume suggestions
- `CustomWorkload` interface has `resiliency` (being removed), `internalMirrorFactor` (unused), and `storageTB`
- JSON import exists but lacks schema validation
- Volume suggestions generate a single volume per custom workload

## Required Changes

### 10A. Remove resiliency from template
- Drop `resiliency` from the JSON template shown to users
- Drop `resiliency` from the custom workload form UI
- Already removed from the type in Phase 2G

### 10B. Wire `internalMirrorFactor`
- In `custom-workloads.ts`: apply the factor to storage calculation
- Volume suggestion data size = `storageTB × internalMirrorFactor`
- This accounts for guest-level redundancy the same way SOFS/MABS handle it

### 10C. Volume suggestions per custom workload
- Generate two volumes per custom workload:
  1. **OS disk volume:** `{name}-OsDisk` — only if `osDiskPerVmGB > 0` in the workload definition. Default three-way-mirror, `fixed` provisioning.
  2. **Data volume:** `{name}-Data` — size = `storageTB × internalMirrorFactor`. Default from `advanced.defaultResiliency`, `fixed` provisioning.

### 10D. JSON import validation
- Validate imported JSON against the `CustomWorkload` schema
- Reject malformed JSON with clear, user-friendly error messages
- Handle missing fields gracefully (use defaults where appropriate)
- Strip removed fields (like `resiliency`) from imported JSON without error

## Files Affected

| File | Changes |
|------|---------|
| `src/components/CustomWorkloads.tsx` | Remove resiliency from UI/template |
| `src/engine/custom-workloads.ts` | Wire internalMirrorFactor |
| `src/engine/workload-volumes.ts` | OS disk + data volume suggestions per workload |

## Acceptance Criteria

- [ ] `resiliency` is NOT present in the custom workload form UI
- [ ] `resiliency` is NOT present in the JSON template shown to users
- [ ] `internalMirrorFactor` is wired into the engine: data volume size = `storageTB × internalMirrorFactor`
- [ ] Each custom workload generates a `{name}-Data` volume suggestion
- [ ] Each custom workload generates a `{name}-OsDisk` volume suggestion (only if `osDiskPerVmGB > 0`)
- [ ] OS disk volumes default to three-way-mirror and `fixed` provisioning
- [ ] Data volumes default to `advanced.defaultResiliency` and `fixed` provisioning
- [ ] JSON import validates against schema and rejects malformed input with clear error messages
- [ ] JSON import with old `resiliency` field doesn't cause errors (field is silently stripped)
- [ ] JSON import with missing optional fields uses sensible defaults
- [ ] `npm run build` succeeds with zero errors
- [ ] New tests for internalMirrorFactor application and volume generation
- [ ] All existing tests pass (`npm test`)
- [ ] Visual inspection confirms custom workload form is clean without resiliency
