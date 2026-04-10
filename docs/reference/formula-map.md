# Formula Map

This page maps each Excel sheet to its TypeScript engine counterpart.

| Excel sheet | TypeScript module | Key function |
|---|---|---|
| Hardware Inputs | `src/engine/hardware.ts` | `validateHardwareInputs()` |
| Capacity Report | `src/engine/capacity.ts` | `computeCapacity()` |
| Volume Detail | `src/engine/volumes.ts` | `computeVolumeSummary()`, `toWacSize()` |
| Workload Planner | `src/engine/workloads.ts` | `computeWorkloadSummary()` |
| AVD Planning | `src/engine/avd.ts` | `computeAvd()` |
| SOFS Planner | `src/engine/sofs.ts` | `computeSofs()` |
| Compute Report | `src/engine/compute.ts` | `computeCompute()` |
| Drive Layout Comparison | `src/components/LayoutCompare.tsx` | (UI only) |
| Advanced Settings | `src/engine/types.ts` | `DEFAULT_ADVANCED_SETTINGS` |
| Health Check | `src/engine/healthcheck.ts` | `runHealthCheck()` |

## OEM presets

| Preset file | Models covered |
|---|---|
| `src/engine/presets/dell-ax.ts` | AX-650, AX-750, AX-760 |
| `src/engine/presets/lenovo-mx.ts` | MX3530-H, MX3530-F |
| `src/engine/presets/hpe-proliant.ts` | DL380 Gen11, EL8000 |
| `src/engine/presets/dataon.ts` | S2D-5212, S2D-4112 |
