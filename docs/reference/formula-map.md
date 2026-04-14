# Formula Map — Workbook Coverage Status

This page maps each Excel sheet to its TypeScript engine counterpart and documents the implementation status.
The machine-readable version of this data lives in [`engine-spec.json`](https://github.com/AzureLocal/azurelocal-surveyor/blob/main/engine-spec.json) at the repo root.

## Status key

| Status | Meaning |
| --- | --- |
| `implemented` | Full formula coverage — output matches workbook to parity-test tolerance |
| `implemented-with-enhancements` | Full formula coverage plus app-specific additions beyond the workbook |
| `partial` | Some formulas implemented; known gaps documented below |
| `re-expressed` | Logic is equivalent but the app has evolved beyond the workbook (new fields, consolidated types) |
| `deferred` | Not yet implemented; tracked in GitHub issues |
| `static` | UI or guidance text only — no formulas to implement |

## Sheet coverage

| Excel sheet | TypeScript module | Key function | Status | Parity tests |
| --- | --- | --- | --- | --- |
| How to Use | `src/pages/DocsPage.tsx` | — | static | — |
| Hardware Inputs | `src/engine/hardware.ts` | `validateHardwareInputs()` | implemented | — |
| Workload Planner | `src/engine/workloads.ts`, `aks.ts`, `mabs.ts` | `computeWorkloadTotals()` | partial | — |
| AVD Planning | `src/engine/avd.ts` | `computeAvd()` | re-expressed | 12 scenarios |
| SOFS Planner | `src/engine/sofs.ts` | `computeSofs()` | re-expressed | 8 scenarios |
| Volume Detail | `src/engine/volumes.ts` | `computeVolumeSummary()`, `toWacSize()` | implemented-with-enhancements | — |
| Capacity Report | `src/engine/capacity.ts` | `computeCapacity()` | implemented | 20 scenarios |
| Compute Report | `src/engine/compute.ts` | `computeCompute()` | implemented | 6 scenarios |
| Final Report | `src/components/FinalReport.tsx` + `src/exporters/` | `FinalReport()`, `exportJson()` | implemented-with-enhancements | — |
| Drive Layout Comparison | `src/pages/DriveLayoutPage.tsx` | — | implemented | — |
| Thin Provisioning | `src/pages/ThinProvisioningPage.tsx` | — | static | — |
| Volume Health Check | `src/engine/healthcheck.ts` | `runHealthCheck()` | implemented | engine.test.ts |
| Advanced Settings | `src/engine/types.ts` | `DEFAULT_ADVANCED_SETTINGS` | partial | — |
| References | `src/pages/ReferencesPage.tsx` | — | static | — |
| To Do | — | — | static | — |

## Intentional divergences

### Hardware Inputs

- Workbook uses a single `DriveMedia` dropdown. App expands this to `capacityMediaType` + `cacheMediaType` to support SSD/HDD capacity tiers.
- Workbook uses `YesNo` strings; app uses `boolean`.
- `hostOsReservedRamGb` moved from Hardware Inputs to Advanced Settings as `systemReservedMemoryGB`.

### Workload Planner (partial)

- Workbook has 6 scenario tabs. App consolidates Infra+Dev/Test+Custom into `VmScenario` and replaces Backup/Archive with a dedicated MABS planner.
- Service presets (Arc SQL MI, IoT Operations, AI Foundry Local) and custom workload builder are app additions beyond the workbook.

### AVD Planning (re-expressed)

- App adds: user type mix (#59), Office Container (#59), data disk per host (#31), profile storage location selector (#33).
- `growthBuffer` scale: workbook uses decimal (0.3), app uses integer percent (30).
- Profile storage uses `totalUsers`, not `concurrentUsers` — correct per FSLogix guidance. Documented in `computeAvd()` and the AVD docs page.

### SOFS Planner (re-expressed)

- App adds: internal mirror compounding (#69), three container types (#45), auto-sizing (#43), IOPS estimates (#41).
- `sofsNodes` is auto-calculated; workbook exposes it as a user input.

### Advanced Settings (partial)

- Workbook defines 38 override keys. App implements 4: `driveUsableTb`, `avdSessionHostsNeeded`, `avdProfileLogicalTb`, `sofsProfileDemandTb`.
- 34 override keys are deferred. See `engine-spec.json` → `overrideGap` for the full list.

### Type naming convention

`src/engine/` uses kebab-case enums (e.g. `'three-way-mirror'`). `reference/temp/` uses title-case (e.g. `'Three-Way Mirror'`). These represent the same concepts. All engine code, exports, and the plan manifest use kebab-case exclusively.

## App-added modules (beyond workbook scope)

The following modules have no direct workbook counterpart. They are pure additions.

| Module | Description |
| --- | --- |
| `src/engine/aks.ts` | AKS on Azure Local cluster sizing — control plane + worker nodes |
| `src/engine/mabs.ts` | Microsoft Azure Backup Server sizing with internal mirror compounding |
| `src/engine/service-presets.ts` | Arc-enabled service preset catalog (SQL MI, IoT Operations, AI Foundry, Container Apps) + `requiresAks` dependency flag |
| `src/engine/custom-workloads.ts` | User-defined generic workload builder |
| `src/engine/avd-pools.ts` | Multi-pool AVD session host group aggregation |
| `src/engine/workload-volumes.ts` | Workload-driven volume row generation |
| `src/exporters/json.ts` | Versioned `SurveyorPlan` manifest export (#118) |
| `src/exporters/powershell.ts` | PowerShell `New-Volume` script generation |

## OEM presets

| Preset file | Models covered |
| --- | --- |
| `src/engine/presets/dell-ax.ts` | AX-650, AX-750, AX-760, AX-670, AX-770 |
| `src/engine/presets/lenovo-mx.ts` | MX3530-H, MX3530-F, MX3535 |
| `src/engine/presets/hpe-proliant.ts` | DL380 Gen11, EL8000 |
| `src/engine/presets/dataon.ts` | S2D-5212, S2D-4112 |

## Architecture and engine-flow docs

For a deeper understanding of how these modules fit together, see:

- [Architecture Overview](../architecture/overview.md) — app layers, page-to-engine map, state structure
- [Engine Data Flow](../architecture/engine-flow.md) — end-to-end pipeline diagrams, computation chains, override handling
