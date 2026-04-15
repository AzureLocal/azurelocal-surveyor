## Summary

When MABS is enabled, the Volume Detail page (Workload mode) always generates a dedicated `MABS-OsDisk` volume for the MABS VM's operating system disk. In many deployments the MABS server VM lives on a shared CSV alongside other workload VMs (e.g. on the same `VM-OS` volume), rather than on its own isolated volume. There is currently no way to tell the planner which model you are using.

## Background

MABS on Azure Local is typically deployed in one of two models:

| Model | Description | Volume impact |
|---|---|---|
| **Dedicated MABS volume** | The MABS VM has its own Azure Local CSV, separate from all other VMs. Fault isolation — a MABS issue does not affect other VM storage. | `MABS-OsDisk` volume generated separately (current behaviour, always) |
| **Shared VM volume** | The MABS VM OS disk lives on an existing shared VM volume (e.g. the same CSV used for other utility/management VMs). Simpler, fewer volumes, common in smaller deployments. | `MABS-OsDisk` should be **suppressed** — its capacity is already accounted for in the shared VM volume sizing |

Currently the planner always generates `MABS-OsDisk` with no way to indicate that the MABS VM will share a CSV with other VMs.

## Current Behaviour

Three volumes always suggested when MABS is enabled:
- `MABS-OsDisk` — MABS VM operating system disk (e.g. 0.20 TiB)
- `MABS-Scratch` — staging/cache area
- `MABS-BackupData` — full + incremental retention data (thin)

## Desired Behaviour

Add a toggle to the MABS planner: **MABS VM OS disk placement**

```
○ Dedicated volume  (generate MABS-OsDisk suggestion — default)
○ Shared with other VMs  (suppress MABS-OsDisk; note that OS disk capacity 
                           should be included in your shared VM volume sizing)
```

When **Shared with other VMs** is selected:
- `MABS-OsDisk` volume suggestion is NOT generated
- A callout note appears on the MABS planner: "MABS VM OS disk will not generate a dedicated volume suggestion. Include `{mabsOsDiskGB} GB` in your shared VM OS volume sizing."
- The `MABS-OsDisk` capacity is still shown in MABS sizing results for reference (so the user knows how much to add to their shared volume)

When **Dedicated volume** is selected (default):
- Behaviour unchanged — `MABS-OsDisk` is generated as today

## Implementation Notes

### State changes (`src/engine/types.ts`)
Add to `MabsInputs`:
```typescript
mabsOsDiskPlacement: 'dedicated' | 'shared'  // default: 'dedicated'
```

### Store defaults (`src/state/store.ts`)
```typescript
mabsOsDiskPlacement: 'dedicated'
```

### Store migration (`src/state/store.ts` — v9 already current; next migration version)
Add `mabsOsDiskPlacement: 'dedicated'` backfill for any persisted state missing the field.

### Volume generation (`src/engine/workload-volumes.ts`)
Wrap the `MABS-OsDisk` push in:
```typescript
if (mabs.mabsOsDiskTB > 0 && inputs.mabsInputs.mabsOsDiskPlacement !== 'shared') {
```

### MABS planner UI (`src/pages/MabsPage.tsx`)
Add a radio/toggle control for `mabsOsDiskPlacement` in the MABS VM Configuration section, with the callout note described above.

## Acceptance Criteria

- [ ] `MabsInputs.mabsOsDiskPlacement: 'dedicated' | 'shared'` added to types
- [ ] Default is `'dedicated'` — existing behaviour unchanged when field not set
- [ ] Toggle control visible in MABS planner UI
- [ ] When `'shared'`: `MABS-OsDisk` volume suggestion is suppressed; callout note shown
- [ ] When `'dedicated'`: `MABS-OsDisk` volume suggestion generated as before
- [ ] Store migration backfills `'dedicated'` for persisted state without the field
- [ ] Unit test: `mabsOsDiskPlacement: 'shared'` → no OS disk volume in suggestions
- [ ] Unit test: `mabsOsDiskPlacement: 'dedicated'` → OS disk volume in suggestions
