# Phase 6: Arc Services → AKS Integration

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P1  
**Depends on:** Phase 5 (AKS multi-cluster support)  
**Estimate:** M  

---

## Context

Arc-enabled services (Azure Arc Data Services, Arc App Services, Arc Machine Learning, etc.) run ON TOP of AKS worker nodes. Currently, Arc service preset resources are added separately from AKS, causing double-counting in resource totals. Arc presets should consume AKS worker pool capacity, and their storage should flow as PVC storage within AKS clusters.

## Current State

- **File:** `src/engine/service-presets.ts` — Arc presets compute independently
- **File:** `src/engine/workload-volumes.ts` — Arc presets generate standalone volume suggestions
- **File:** `src/engine/workloads.ts` — Arc preset totals added on top of AKS totals
- Arc presets have vCPU, memory, and storage requirements
- If AKS is disabled but Arc presets are enabled, a warning banner shows

## Required Changes

### 6A. Presets consume AKS worker capacity
- Arc preset vCPUs and memory count AGAINST AKS worker pool capacity, not in addition to it
- In `workloads.ts` aggregation: Arc preset compute is NOT added to the total (it's already within AKS worker resources)
- In reporting: show Arc presets as sub-items under AKS, with a warning if total preset demand exceeds total AKS worker capacity across all clusters

### 6B. Preset storage → AKS PVCs
- Arc preset storage flows as PVC storage within AKS clusters
- In `workload-volumes.ts`: Arc presets add their storage to AKS PVC volumes instead of generating separate standalone volume suggestions
- The AKS PVC volume suggestion size should include Arc preset storage demand

### 6C. Enforce AKS dependency
- If any Arc preset is enabled but AKS is disabled, show a blocking error (upgrade existing warning banner to error)
- The error should prevent proceeding or at minimum show a clear message: "Arc services require AKS. Enable AKS to use Arc service presets."

## Files Affected

| File | Changes |
|------|---------|
| `src/engine/service-presets.ts` | Presets consume AKS worker capacity instead of adding |
| `src/engine/workload-volumes.ts` | Arc preset storage flows into AKS PVC suggestions |
| `src/engine/workloads.ts` | Remove double-counting of Arc presets on top of AKS |
| AKS page or service presets UI | Upgrade warning to blocking error |

## Acceptance Criteria

- [ ] Arc service preset vCPU/memory is counted WITHIN AKS worker capacity, not added on top
- [ ] Total workload vCPU/memory aggregation does NOT double-count Arc presets and AKS workers
- [ ] Arc preset storage is included in AKS PVC volume suggestions (no standalone Arc volume suggestions)
- [ ] Reports show Arc presets as sub-items under AKS with their resource consumption
- [ ] Warning is displayed if Arc preset resource demand exceeds total AKS worker capacity
- [ ] Blocking error is shown if any Arc preset is enabled but AKS is disabled
- [ ] Error message clearly states: "Arc services require AKS. Enable AKS to use Arc service presets." (or similar)
- [ ] WorkloadPlanner totals are correct after integration (no double-counting)
- [ ] Volume suggestions on Volumes page correctly combine AKS PVC + Arc preset storage
- [ ] `npm run build` succeeds with zero errors
- [ ] All existing tests pass, plus new tests for Arc-within-AKS accounting
- [ ] Manual verification: enable AKS + Arc presets → totals match expected (AKS workers are the ceiling, Arc presets consume from that ceiling)
