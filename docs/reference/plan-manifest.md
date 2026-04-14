# Plan Manifest Schema

The **Export JSON** button on the Reports page produces a `SurveyorPlan` JSON file.
This file is the primary handoff artifact for Ranger and any downstream automation.

## File name

```
azure-local-plan-YYYY-MM-DD.json
```

## Schema versioning

The `schemaVersion` field uses `"MAJOR.MINOR"` string format.

- Ranger (and any other consumer) checks only the **major** version: `schemaVersion.split('.')[0] === '1'`
- **MAJOR** bumps when a field is removed or its type changes incompatibly — consumers must reject the file
- **MINOR** bumps when new optional fields are added — consumers may safely ignore unknown fields

The current version is `"1.0"`.

## Top-level structure

```json
{
  "schemaVersion": "1.0",
  "surveyorVersion": "1.3.0",
  "generatedAt": "2026-04-14T12:00:00.000Z",
  "provenance": { ... },
  "inputs": { ... },
  "outputs": { ... }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | `"1.0"` | Manifest schema version — check major only |
| `surveyorVersion` | `string` | Surveyor app version that generated the file |
| `generatedAt` | `string` | ISO 8601 UTC timestamp of export |
| `provenance` | object | How and by whom the plan was created |
| `inputs` | object | Verbatim snapshot of all user-entered inputs |
| `outputs` | object | Frozen computed results at export time |

## provenance

```json
{
  "source": "manual",
  "notes": "Pre-deployment sizing for customer Site A",
  "approvedBy": "engineer@example.com",
  "approvedAt": "2026-04-14T15:30:00.000Z",
  "baselineLabel": "Pre-deployment baseline — Site A"
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `source` | `"manual" \| "imported" \| "url-share"` | yes | How inputs were created |
| `notes` | `string` | no | Free-text annotation |
| `approvedBy` | `string` | no | Approver name or email — set by Ranger or hand-edit |
| `approvedAt` | `string` | no | ISO 8601 UTC approval timestamp |
| `baselineLabel` | `string` | no | Human-readable baseline label for Ranger display |

For v1.7.0 there is no UI for stamping approval. Set `approvedBy`, `approvedAt`, and `baselineLabel` by editing the JSON directly or via Ranger.

## inputs

A verbatim copy of all Zustand store slices at export time. All type definitions live in `src/engine/types.ts` and use kebab-case enum values (e.g. `"three-way-mirror"`, not `"Three-Way Mirror"`).

| Field | Type | Description |
| --- | --- | --- |
| `hardware` | `HardwareInputs` | Cluster node, drive, CPU, and RAM config |
| `advanced` | `AdvancedSettings` | Efficiency factor, infra volume, overrides |
| `volumes` | `VolumeSpec[]` | User-defined planned volumes |
| `volumeMode` | `"workload" \| "generic"` | Volume suggestion mode |
| `avdEnabled` | `boolean` | Whether AVD scenario is active |
| `avd` | `AvdInputs` | AVD session host and FSLogix inputs |
| `sofsEnabled` | `boolean` | Whether SOFS scenario is active |
| `sofs` | `SofsInputs` | SOFS guest cluster inputs |
| `mabsEnabled` | `boolean` | Whether MABS scenario is active |
| `mabs` | `MabsInputs` | MABS backup server inputs |
| `aks` | `AksInputs` | AKS cluster inputs (`aks.enabled` is the toggle) |
| `virtualMachines` | `VmScenario` | VM workload inputs (`virtualMachines.enabled` is the toggle) |
| `servicePresets` | `ServicePresetInstance[]` | Arc-enabled service preset instances |
| `customWorkloads` | `CustomWorkload[]` | User-defined custom workload entries |

## outputs

Computed at export time and frozen. Ranger can consume these directly without re-running the engine.
Per-scenario fields (`avd`, `sofs`, `aks`, `mabs`) are only present when the scenario was enabled at export time.

| Field | Type | Always present | Description |
| --- | --- | --- | --- |
| `capacity` | `CapacityResult` | yes | Raw pool, usable, reserve, effective usable |
| `compute` | `ComputeResult` | yes | vCPU, memory, N+1 failover analysis |
| `volumeSummary` | `VolumeSummaryResult` | yes | Planned volumes, utilization |
| `workloadTotals` | `WorkloadSummaryResult` | yes | Aggregate vCPU, memory, storage across all scenarios |
| `health` | `HealthCheckResult` | yes | Volume and compute health check results |
| `avd` | `AvdResult` | when `avdEnabled` | Session host count, storage breakdown |
| `sofs` | `SofsResult` | when `sofsEnabled` | Profile demand, IOPS, auto-size result |
| `aks` | `AksResult` | when `aks.enabled` | Control plane + worker node totals |
| `mabs` | `MabsResult` | when `mabsEnabled` | Backup volume sizing, internal mirror factor |

## Ranger integration notes

1. **Version check first:** reject files where `schemaVersion.split('.')[0] !== '1'`
2. **Trust outputs:** the `outputs` section is a frozen snapshot — do not re-run the engine; use these values directly
3. **Baseline approval:** set `provenance.approvedBy`, `provenance.approvedAt`, and `provenance.baselineLabel` before importing into Ranger as an approved baseline
4. **Enum values:** all ResiliencyType, DriveMedia, and similar enum fields use kebab-case — `"three-way-mirror"` not `"Three-Way Mirror"`

## Round-trip import

A plan exported as JSON can be loaded back into Surveyor in a future release. When loaded, `provenance.source` will be set to `"imported"` to distinguish it from a freshly-typed plan. This feature is not yet implemented in v1.7.0.
