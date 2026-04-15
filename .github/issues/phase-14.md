# Phase 14: Verification & Testing

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P0  
**Depends on:** ALL previous phases (1–13)  
**Estimate:** L  

---

## Context

This is the final phase of the v2.0 overhaul. All changes from Phases 1–13 must be verified through automated tests and manual testing scenarios. New tests must be written for all new functionality, and existing tests must be updated to reflect schema and behavior changes.

## Current Test Baseline

- **Test runner:** Vitest
- **Current pass rate:** 63/63 tests passing
- **Test location:** `src/__tests__/` and co-located test files

---

## Required: New Automated Tests

### Store Migration
- [ ] Test v8→v9 migration with representative v8 state data
- [ ] Test migration wraps flat AKS into single cluster
- [ ] Test migration wraps flat VMs into single storage group
- [ ] Test migration converts AVD S2D → SOFS
- [ ] Test migration drops removed fields
- [ ] Test migration adds provisioning: 'fixed' to existing volumes
- [ ] Test migration adds SOFS defaults

### AKS Multi-Cluster
- [ ] Test `computeAks()` with 0 clusters (disabled)
- [ ] Test `computeAks()` with 1 cluster (backward compatible)
- [ ] Test `computeAks()` with 3 clusters (aggregation)
- [ ] Test control plane resources: always 4 vCPU / 16 GB per node
- [ ] Test worker resources: user-specified per worker

### VM Storage Groups
- [ ] Test volume generation with 1 group (backward compatible)
- [ ] Test volume generation with 3 groups (separate volumes)
- [ ] Test vCPU overcommit applies to total across all groups
- [ ] Test memory aggregation across groups (no overcommit)

### SOFS Volume Layout
- [ ] Test shared mode: 1 data volume + 1 OS disk volume
- [ ] Test per-VM mode (3 VMs): 3 data volumes + 3 OS disk volumes
- [ ] Test total data volume size equals internalFootprintTB in both modes
- [ ] Test OS disk volume sizes

### Per-Volume Resiliency
- [ ] Test pool footprint with mixed resiliency (some three-way, some two-way)
- [ ] Test resiliency factor uses per-volume resiliency, not global

### Provisioning
- [ ] Test volume suggestions include provisioning field
- [ ] Test MABS-BackupData defaults to thin
- [ ] Test health check: fixed-only over-capacity → ERROR
- [ ] Test health check: thin over-provisioning → INFO (not ERROR)
- [ ] Test health check: mixed fixed+thin → fixed must fit

### Quick Start Reference
- [ ] Test three-way-mirror row calculation
- [ ] Test two-way-mirror row calculation
- [ ] Test rounding with 1 GiB safety margin
- [ ] Test with various node counts and drive configurations

### Arc → AKS Integration
- [ ] Test Arc presets within AKS worker capacity (no double-counting)
- [ ] Test warning when Arc exceeds AKS capacity
- [ ] Test Arc storage flows into AKS PVC
- [ ] Test error when Arc enabled but AKS disabled

### Custom Workloads
- [ ] Test internalMirrorFactor applied to data volume size
- [ ] Test OS disk volume generated when osDiskPerVmGB > 0
- [ ] Test no OS disk volume when osDiskPerVmGB === 0
- [ ] Test JSON import validation (valid, invalid, old schema)

---

## Required: Manual Testing Scenarios

### Scenario 1: All Workloads Enabled
1. Enable all workloads (AVD, AKS, VMs, SOFS, MABS, custom)
2. Verify WorkloadPlanner totals match sum of individual workloads
3. Verify no double-counting (especially Arc within AKS)

### Scenario 2: Volume Mode Comparison
1. Switch between Generic and Workload-based volume modes
2. Verify suggestions update correctly
3. Add suggested volumes → verify resiliency + provisioning carry over to planned table

### Scenario 3: Quick Start Accuracy
1. Configure known hardware (e.g., 4 nodes × 12 drives × 4 TB)
2. Verify Quick Start shows two clean rows (three-way + two-way)
3. Verify NO FAIL status appears
4. Verify numbers match Microsoft calculator expectations

### Scenario 4: Utilization Bar
1. Add volumes until utilization approaches limits
2. Verify bar color transitions: green → amber at 70% → red at 80%
3. Verify tooltip is present and accurate

### Scenario 5: Health Check
1. Add volumes with mixed resiliency and provisioning
2. Verify all checks shown (green pass included)
3. Over-provision with thin volumes → verify INFO message (not ERROR)
4. Over-provision with fixed volumes → verify ERROR

### Scenario 6: Conditional Reports
1. Enable/disable each workload
2. Verify corresponding report tab appears/disappears
3. Verify report content matches workload configuration

### Scenario 7: Store Migration
1. Load v8 state (from browser localStorage or test fixture)
2. Verify v9 migration runs cleanly
3. Verify all data is preserved and correctly transformed

### Scenario 8: Edge Cases
1. Single node cluster (should limit resiliency options)
2. Zero storage VMs (data disk = 0 GB)
3. Large cluster (16 nodes × 24 drives × 16 TB)
4. All workloads disabled (empty state)

---

## Files Affected

| File | Changes |
|------|---------|
| `src/__tests__/` | New and updated test files |
| Various engine files | May need minor fixes discovered during testing |

## Acceptance Criteria

- [ ] `npm run build` succeeds with zero errors
- [ ] ALL existing tests pass (updated for schema changes)
- [ ] ALL new tests listed above are written and passing
- [ ] Test coverage for engine files ≥ 80%
- [ ] ALL 8 manual testing scenarios completed with expected results
- [ ] No console errors during manual testing
- [ ] No visual regressions (layout, styling, responsiveness)
- [ ] Quick Start reference section shows clean two-row table with no FAIL for any hardware configuration
- [ ] Performance: page loads and calculations complete within 2 seconds for max-size configurations
- [ ] README updated with v2.0 changes summary
- [ ] CHANGELOG.md updated with v2.0 entry
