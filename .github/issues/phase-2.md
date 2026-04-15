# Phase 2: Store Schema & Type Foundation (Zustand v8→v9)

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P0 — **BLOCKS ALL SUBSEQUENT PHASES (3–12)**  
**Estimate:** L  

---

## Context

This is the foundational phase for the entire v2.0 overhaul. All type definitions and the Zustand store schema must be updated before any workload planner or volumes page changes can proceed. This consolidates all breaking schema changes into a single migration (v8→v9) to avoid multiple migration steps.

## Current State

- **Store version:** 8 (in `src/state/store.ts`)
- **Types file:** `src/engine/types.ts`
- Resiliency is scattered across multiple workload types (VmScenario, AksInputs, MabsInputs, CustomWorkload)
- AKS is flat (single cluster model)
- VMs are flat (no storage groups)
- SOFS lacks volume layout and OS disk fields
- AVD includes S2D as a storage location option
- VolumeSpec lacks provisioning (fixed/thin)
- HardwareInputs has a global `volumeProvisioning` field

---

## Required Changes

### 2A. VolumeSpec — add `provisioning`
- **File:** `src/engine/types.ts`
- Add `provisioning: 'fixed' | 'thin'` to `VolumeSpec` interface (default: `'fixed'`)
- `SuggestedVolume` inherits this through `VolumeSpec` extension

### 2B. Remove CSV-level resiliency from workloads
- **Remove these fields:**
  - `resiliency` from `VmScenario`
  - `resiliency` from `AksInputs`
  - `scratchResiliency` from `MabsInputs`
  - `backupResiliency` from `MabsInputs`
- **Keep these fields (guest-level resiliency):**
  - `mabs.internalMirror` (guest Storage Spaces inside MABS VM)
  - `sofs.internalMirror` (guest S2D inside SOFS VMs)
  - `advanced.defaultResiliency` (default for new volume suggestions)

### 2C. AKS — multi-cluster model
- Replace flat `AksInputs` with cluster array:
  ```typescript
  interface AksInputs {
    enabled: boolean
    clusters: AksCluster[]
  }
  interface AksCluster {
    id: string
    name: string
    controlPlaneNodesPerCluster: 1 | 3
    workerNodesPerCluster: number
    vCpusPerWorker: number
    memoryPerWorkerGB: number
    osDiskPerNodeGB: number
    persistentVolumesTB: number
  }
  ```
- Remove `dataServicesTB` (handled by Arc service presets)
- Remove `resiliency` (per-volume now)
- Remove `clusterCount` (replaced by `clusters.length`)

### 2D. VMs — storage groups
- Replace flat `VmScenario` with groups:
  ```typescript
  interface VmScenario {
    enabled: boolean
    vCpuOvercommitRatio: number
    groups: VmStorageGroup[]
  }
  interface VmStorageGroup {
    id: string
    name: string
    vmCount: number
    vCpusPerVm: number
    memoryPerVmGB: number
    storagePerVmGB: number
  }
  ```

### 2E. SOFS — volume layout + OS disks
- Add to `SofsInputs`:
  - `volumeLayout: 'shared' | 'per-vm'` (default: `'shared'`)
  - `sofsOsDiskPerVmGB: number` (default: `127`)

### 2F. AVD — remove S2D storage location
- Remove `'s2d'` from `AvdProfileStorageLocation` union type
- Keep: `'sofs' | 'azure-files' | 'external'`

### 2G. Custom workloads — remove resiliency
- Remove `resiliency` field from `CustomWorkload` interface

### 2H. Remove `volumeProvisioning` from `HardwareInputs`

### 2I. Store migration function (v8→v9)
- **File:** `src/state/store.ts`
- Write migration function that:
  1. Wraps existing flat AKS values into a single `AksCluster` in `clusters[]`
  2. Wraps existing flat VM values into a single `VmStorageGroup` in `groups[]`
  3. Migrates AVD pools with `storageLocation: 's2d'` to `'sofs'`
  4. Drops removed fields (`resiliency` from VMs, AKS, MABS; `scratchResiliency`/`backupResiliency` from MABS; `dataServicesTB` from AKS; `volumeProvisioning` from hardware; `resiliency` from custom workloads)
  5. Sets `provisioning: 'fixed'` on all existing `VolumeSpec` entries
  6. Adds `volumeLayout: 'shared'` and `sofsOsDiskPerVmGB: 127` defaults to SOFS
  7. Bumps version from 8 to 9

---

## Files Affected

| File | Changes |
|------|---------|
| `src/engine/types.ts` | VolumeSpec, AksInputs, AksCluster, VmScenario, VmStorageGroup, SofsInputs, MabsInputs, AvdProfileStorageLocation, CustomWorkload, HardwareInputs |
| `src/state/store.ts` | Migration v8→v9, default values, version bump |

---

## Acceptance Criteria

- [ ] `VolumeSpec` has a `provisioning: 'fixed' | 'thin'` field
- [ ] `AksInputs` contains `clusters: AksCluster[]` array instead of flat fields
- [ ] `AksCluster` interface is defined with all specified fields (id, name, controlPlaneNodesPerCluster, workerNodesPerCluster, vCpusPerWorker, memoryPerWorkerGB, osDiskPerNodeGB, persistentVolumesTB)
- [ ] `dataServicesTB` is removed from AKS types
- [ ] `VmScenario` contains `groups: VmStorageGroup[]` array instead of flat fields
- [ ] `VmStorageGroup` interface is defined with all specified fields
- [ ] `resiliency` is removed from `VmScenario`, `AksInputs`, `CustomWorkload`
- [ ] `scratchResiliency` and `backupResiliency` are removed from `MabsInputs`
- [ ] `internalMirror` is retained on `MabsInputs` and `SofsInputs`
- [ ] `advanced.defaultResiliency` is retained
- [ ] `SofsInputs` has `volumeLayout: 'shared' | 'per-vm'` and `sofsOsDiskPerVmGB: number`
- [ ] `'s2d'` is removed from `AvdProfileStorageLocation`
- [ ] `volumeProvisioning` is removed from `HardwareInputs`
- [ ] Store migration v8→v9 correctly wraps existing AKS data into a single cluster
- [ ] Store migration wraps existing VM data into a single storage group
- [ ] Store migration changes AVD pools with `storageLocation: 's2d'` to `'sofs'`
- [ ] Store migration drops all removed fields without data loss on retained fields
- [ ] Store migration adds `provisioning: 'fixed'` to all existing volumes
- [ ] Store migration adds SOFS defaults (`volumeLayout: 'shared'`, `sofsOsDiskPerVmGB: 127`)
- [ ] Store version is 9 after migration
- [ ] `npm run build` succeeds with zero TypeScript errors
- [ ] All existing tests pass after type changes are propagated
- [ ] New unit tests cover the v8→v9 migration with representative v8 state
