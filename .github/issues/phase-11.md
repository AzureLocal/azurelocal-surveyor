# Phase 11: Workload Planner Totals Fix

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P1  
**Depends on:** Phases 5 (AKS multi-cluster), 6 (Arc→AKS), 9 (VM storage groups)  
**Estimate:** S  

---

## Context

The WorkloadPlanner component shows aggregate vCPU and memory bars at the top. After the AKS multi-cluster, Arc→AKS integration, and VM storage groups changes, the aggregation logic needs to be verified and corrected to prevent double-counting (especially Arc presets within AKS workers).

## Current State

- **File:** `src/components/WorkloadPlanner.tsx` — top aggregation section
- **File:** `src/engine/workloads.ts` — workload aggregation logic
- Currently sums AVD + AKS + Arc presets + VMs + SOFS + MABS + Custom
- Arc presets are added ON TOP of AKS (double-counting)
- After Phase 6, Arc presets consume AKS worker capacity → must not be added separately

## Required Changes

### 11A. Fix workload aggregation
- In `workloads.ts`:
  - AKS total = sum of all clusters' vCPU/memory (control plane + workers)
  - Arc presets are a SUBSET of AKS worker capacity → do NOT add separately
  - VMs total = sum of all storage groups' vCPU/memory (with overcommit applied)
  - AVD, SOFS, MABS, Custom → verify unchanged
- Remove Arc presets from the top-level sum (they're inside AKS workers)

### 11B. Verify WorkloadPlanner UI
- The vCPU and memory bars should show correct totals
- Each workload's contribution should be accurately represented in the breakdown
- Arc presets should appear as a sub-item under AKS, not as a separate workload category in the totals

## Files Affected

| File | Changes |
|------|---------|
| `src/engine/workloads.ts` | Fix aggregation — Arc within AKS, multi-cluster, storage groups |
| `src/components/WorkloadPlanner.tsx` | Verify totals display, Arc as AKS sub-item |

## Acceptance Criteria

- [ ] Workload planner vCPU total = AVD + AKS (all clusters, includes Arc presets) + VMs (all groups, with overcommit) + SOFS + MABS + Custom
- [ ] Arc preset vCPU/memory is NOT added as a separate line item in the total (it's within AKS)
- [ ] AKS total correctly sums across all clusters (control plane + workers)
- [ ] VM total correctly sums across all storage groups with overcommit ratio applied
- [ ] WorkloadPlanner UI bars match the computed totals
- [ ] Arc presets are shown as sub-items under AKS in any breakdown display
- [ ] If Arc preset demand exceeds AKS worker capacity, a warning is visible
- [ ] `npm run build` succeeds with zero errors
- [ ] All existing tests pass, plus updated aggregation tests
- [ ] Manual verification: enable all workloads → totals match expected sum
