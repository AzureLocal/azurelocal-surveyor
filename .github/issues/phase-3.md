# Phase 3: Hardware Page Cleanup

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P1  
**Depends on:** Phase 2 (2H — `volumeProvisioning` removed from `HardwareInputs`)  
**Estimate:** XS  

---

## Context

The Hardware page currently includes a "Volume provisioning" dropdown (fixed/thin) that is a global setting. In v2.0, provisioning moves to per-volume on the Volumes page, so this global dropdown must be removed. All other hardware fields remain.

## Current State

- **File:** `src/components/HardwareForm.tsx` ~lines 303–308
- Volume provisioning dropdown exists as a `<Field>` in the hardware form
- Hardware fields that stay: OEM Preset, Node count, Capacity drives/node, Capacity drive size/type, Cache drives/node, Cache drive size/type, CPU cores/node, RAM/node
- Cache drives are currently informational only (not wired into engine calculations)

## Required Changes

### 3A. Remove volume provisioning dropdown
- Delete the `<Field label="Volume provisioning">` block and its associated select/onChange handler from `HardwareForm.tsx`
- Remove any imports or helper functions used exclusively by this dropdown

### 3B. Verify remaining fields
- Confirm OEM Preset, node count, capacity drives, cache drives, CPU, RAM all render and function correctly after removal
- Cache drives remain as informational (no engine changes needed — document as future work)

## Files Affected

| File | Changes |
|------|---------|
| `src/components/HardwareForm.tsx` | Remove volume provisioning dropdown |

## Acceptance Criteria

- [ ] Volume provisioning dropdown is no longer rendered on the Hardware page
- [ ] No dead code remains related to the removed dropdown (imports, handlers, helpers)
- [ ] All remaining hardware fields (OEM Preset, node count, capacity drives, cache drives, CPU, RAM) render correctly
- [ ] OEM Preset selector still populates hardware fields correctly
- [ ] No console errors after removal
- [ ] `npm run build` succeeds with zero errors
- [ ] All existing tests pass (`npm test`)
- [ ] Visual inspection confirms clean Hardware page layout with no gaps or misalignment
