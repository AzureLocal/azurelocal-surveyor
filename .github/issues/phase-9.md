# Phase 9: Virtual Machines — Storage Groups

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P1  
**Depends on:** Phase 2 (2D — VM storage groups model)  
**Estimate:** M  

---

## Context

The VM planner currently has a flat model (one set of VM specs for all VMs). Real deployments often have different tiers of VMs (e.g., SQL servers with big disks vs web servers with small disks) that should be placed on separate volumes. Storage groups allow users to define these tiers and generate separate volume suggestions per group.

## Current State

- **File:** `src/components/WorkloadPlanner.tsx` — VM ScenarioCard
- **File:** `src/engine/workload-volumes.ts` — VM volume suggestions
- Flat model: vmCount, vCPUsPerVm, memoryPerVmGB, storagePerVmGB
- Generates a single volume suggestion for all VMs
- Has `resiliency` field (being removed to Volumes page in Phase 2)
- `vCpuOvercommitRatio` exists at the scenario level

## Required Changes

### 9A. Storage groups UI
- Replace flat VM fields with add/remove group card pattern
- Each storage group card contains:
  - Group name (text input, e.g., "SQL Servers", "Web Servers")
  - VM count (number)
  - vCPUs per VM (number)
  - Memory per VM GB (number)
  - Storage per VM GB (number)
- "Add Group" button to add new group cards
- Delete button on each group card
- `vCpuOvercommitRatio` stays at the top level (applies to all VM groups)
- Default: 1 group named "Default" with existing values (backward compatible with migration)

### 9B. Volume suggestions update
- **File:** `src/engine/workload-volumes.ts`
- Per group: generate a `VM-{groupName}` volume suggestion
- Size per group: `vmCount × storagePerVmGB / 1024` (TB)
- Each volume gets `provisioning: 'fixed'` default, `resiliency: advanced.defaultResiliency`
- Summary: total VMs across all groups, total vCPUs accounting for overcommit, total memory, total storage

### 9C. Compute aggregation
- Total VM vCPUs = sum(group.vmCount × group.vCpusPerVm) per group
- Effective vCPUs = total / vCpuOvercommitRatio
- Total memory = sum(group.vmCount × group.memoryPerVmGB)
- These feed into the workload planner totals

## Files Affected

| File | Changes |
|------|---------|
| `src/components/WorkloadPlanner.tsx` | VM ScenarioCard → storage group cards |
| `src/engine/workload-volumes.ts` | Per-group volume suggestions |
| `src/engine/workloads.ts` | Aggregation from groups[] |

## Acceptance Criteria

- [ ] VM planner shows a card-based UI for storage groups
- [ ] Users can add new storage groups with an "Add Group" button
- [ ] Users can remove storage groups (with protection against removing all when VMs enabled)
- [ ] Each group card has fields for: name, VM count, vCPUs/VM, memory/VM, storage/VM
- [ ] `vCpuOvercommitRatio` is at the top level, above the group cards
- [ ] Default state has 1 group named "Default" (backward compatible with v8 migration)
- [ ] Volume suggestions generate separate `VM-{groupName}` volumes per group
- [ ] Volume size per group = `vmCount × storagePerVmGB / 1024` TB
- [ ] All VM volumes have `provisioning: 'fixed'` and `resiliency: advanced.defaultResiliency`
- [ ] Workload planner totals correctly aggregate vCPU, memory, and storage across all groups
- [ ] vCPU overcommit ratio applies to the total across all groups
- [ ] `npm run build` succeeds with zero errors
- [ ] New tests for multi-group aggregation and volume generation
- [ ] All existing tests pass (`npm test`)
- [ ] Visual inspection confirms clean card layout with proper add/remove behavior
