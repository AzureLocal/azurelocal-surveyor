# Phase 13: Reports Overhaul

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P1  
**Depends on:** All workload phases (3–12)  
**Estimate:** L  

---

## Context

The Reports page needs conditional workload tabs (AVD, AKS, MABS) that appear only when those workloads are enabled. The existing SOFS report tab needs verification. The Final Report needs to combine all workloads, and compute health checks removed from the Volume Health Check (Phase 12H) need a new home in the Compute Report.

## Current State

- **File:** `src/pages/ReportsPage.tsx` — report tabs and content
- SOFS Report tab already exists (conditional on SOFS enabled)
- AVD, AKS, MABS do NOT have dedicated report tabs
- Final Report exists but may not include all workloads correctly
- Compute health checks are currently in the Volume Health Check section

## Required Changes

### 13A. Add conditional report tabs
- **AVD Report** — conditional on `avdEnabled`
  - Per-pool session host breakdown (count, tier, vCPU, memory)
  - Profile storage by location (SOFS, Azure Files, External)
  - Bandwidth estimates
  - Session host VM specs
  - Data/temp disk summary
- **AKS Report** — conditional on `aks.enabled`
  - Per-cluster breakdown (control plane nodes, worker nodes, vCPU, memory)
  - Arc service preset consumption within AKS worker pool
  - PVC storage summary per cluster
  - Warning if Arc presets exceed worker capacity
- **MABS Report** — conditional on `mabsEnabled`
  - Backup sizing summary
  - Internal mirror impact on volume sizes
  - MABS VM specs (vCPU, memory)
  - Volume suggestions (Scratch, BackupData, OsDisk) with provisioning info

### 13B. SOFS Report — verify and update
- Already exists — verify it includes:
  - Volume layout (shared vs per-VM)
  - OS disk information
  - Compute/memory breakdown
  - Internal mirror impact on volume sizes

### 13C. Final Report — combine everything
- All workloads: AVD, AKS (with Arc presets folded in), VMs (with storage groups), SOFS, MABS, custom workloads
- Total compute: sum all vCPUs + memory. N+1 failover impact.
- Total storage: sum all volume suggestions with resiliency + provisioning
- Volume summary: total planned, total pool footprint, utilization %

### 13D. Compute Report — add moved checks
- Add compute health checks removed from Volume Health Check in Phase 12H:
  - HC_VCPU_OVER_SUBSCRIBED
  - HC_MEMORY_EXCEEDED
  - HC_VCPU_HIGH
  - HC_MEMORY_HIGH

### 13E. Capacity Report — verify accuracy
- Hardware-driven report. Should be unaffected by workload changes.
- Verify numbers match Volumes page reference section

## Files Affected

| File | Changes |
|------|---------|
| `src/pages/ReportsPage.tsx` | Add AVD, AKS, MABS tabs; update Final Report; add compute checks to Compute Report |
| `src/engine/healthcheck.ts` | Expose compute checks separately for Compute Report |

## Acceptance Criteria

### Conditional Tabs
- [ ] AVD Report tab appears ONLY when `avdEnabled` is true
- [ ] AKS Report tab appears ONLY when `aks.enabled` is true
- [ ] MABS Report tab appears ONLY when `mabsEnabled` is true
- [ ] SOFS Report tab continues to appear only when SOFS is enabled
- [ ] Tabs disappear when respective workloads are disabled

### AVD Report Content
- [ ] Per-pool breakdown showing session host count, tier, vCPU, memory
- [ ] Profile storage broken down by location (SOFS, Azure Files, External)
- [ ] Data/temp disk summary per pool
- [ ] Session host VM specs are accurate

### AKS Report Content
- [ ] Per-cluster breakdown showing control plane and worker resources
- [ ] Arc service preset consumption shown as sub-items under AKS workers
- [ ] PVC storage summary per cluster
- [ ] Warning displayed if Arc preset demand exceeds worker capacity

### MABS Report Content
- [ ] Backup sizing summary
- [ ] Internal mirror impact on volumes shown
- [ ] MABS VM specs displayed
- [ ] Volume suggestions with provisioning info

### SOFS Report
- [ ] Volume layout mode (shared/per-VM) is displayed
- [ ] OS disk information included
- [ ] Internal mirror impact shown

### Final Report
- [ ] All enabled workloads are included
- [ ] Total compute aggregation is correct (no double-counting Arc presets)
- [ ] Total storage includes volume summaries with resiliency and provisioning
- [ ] N+1 failover impact shown

### Compute Report
- [ ] HC_VCPU_OVER_SUBSCRIBED check is present
- [ ] HC_MEMORY_EXCEEDED check is present
- [ ] HC_VCPU_HIGH check is present
- [ ] HC_MEMORY_HIGH check is present
- [ ] These checks are NOT in the Volume Health Check section

### General
- [ ] `npm run build` succeeds with zero errors
- [ ] All existing tests pass (`npm test`)
- [ ] Visual inspection confirms tabs render correctly with proper content
- [ ] Manual verification: toggle workloads on/off → tabs appear/disappear correctly
