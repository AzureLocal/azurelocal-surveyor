# Phase 5: AKS Planner — Multi-Cluster Support

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P1  
**Depends on:** Phase 2 (2C — multi-cluster AKS model)  
**Estimate:** L  

---

## Context

The AKS planner currently supports only a single cluster configuration. Real-world Azure Local deployments often run multiple AKS clusters. The planner needs to support adding/removing multiple clusters (same pattern as AVD host pools) and the engine needs to aggregate totals across all clusters.

## Current State

- **File:** `src/pages/AksPage.tsx` — single-cluster form
- **File:** `src/engine/aks.ts` — flat `computeAks()` function for single cluster
- Fields: cluster count, control plane nodes, worker nodes, vCPU/worker, RAM/worker, OS disk/node, PVC storage, data services TB, resiliency
- `dataServicesTB` duplicates Arc service preset storage
- `resiliency` is moving to per-volume (Volumes page)

## Required Changes

### 5A. Multi-cluster UI
- Replace single-cluster form with add/remove cluster card pattern (same as AVD host pools)
- Each cluster card contains:
  - Cluster name (text input)
  - Control plane nodes (1 or 3 selector)
  - Worker nodes per cluster (number)
  - vCPUs per worker (number)
  - Memory per worker GB (number)
  - OS disk per node GB (number)
  - Persistent volume storage TB (number)
- "Add Cluster" button to add new cluster cards
- Delete button on each cluster card (with confirmation if >1 cluster)
- Summary section at bottom aggregating totals across all clusters

### 5B. Remove resiliency and data services
- Remove resiliency selector from AKS page entirely
- Remove `dataServicesTB` field (Arc service presets cover data services storage)

### 5C. Engine update
- **File:** `src/engine/aks.ts`
- Refactor `computeAks()` to iterate `clusters[]` array
- Per-cluster: compute control plane resources (always 4 vCPU / 16 GB per control plane node)
- Per-cluster: compute worker resources (user-specified vCPU/memory per worker)
- Aggregate totals: sum vCPUs, memory, OS disk storage, PVC storage across all clusters
- Return per-cluster breakdown AND aggregate totals

## Files Affected

| File | Changes |
|------|---------|
| `src/pages/AksPage.tsx` | Multi-cluster card UI, remove resiliency/dataServices |
| `src/engine/aks.ts` | Iterate clusters[], aggregate totals |
| `src/engine/workload-volumes.ts` | AKS volume suggestions per-cluster |

## Acceptance Criteria

- [ ] AKS page shows a card-based UI for multiple clusters (same pattern as AVD host pools)
- [ ] Users can add new clusters with an "Add Cluster" button
- [ ] Users can remove clusters (with protection against removing all clusters when AKS is enabled)
- [ ] Each cluster card has fields for: name, control plane nodes (1/3), workers, vCPU/worker, RAM/worker, OS disk/node, PVC storage
- [ ] Resiliency selector is NOT present on the AKS page
- [ ] `dataServicesTB` field is NOT present on the AKS page
- [ ] Summary section shows aggregate totals across all clusters
- [ ] `computeAks()` correctly iterates and sums across `clusters[]`
- [ ] Control plane nodes calculated as 4 vCPU / 16 GB per node per cluster
- [ ] Worker nodes calculated with user-specified vCPU/memory per worker
- [ ] Volume suggestions generate per-cluster volume entries (e.g., `AKS-{clusterName}-PVC`)
- [ ] Default state has one cluster with sensible defaults (backward compatible with v8 migration)
- [ ] `npm run build` succeeds with zero errors
- [ ] All existing tests pass, plus new tests for multi-cluster aggregation
- [ ] Visual inspection confirms cluster cards add/remove correctly with proper summary updates
