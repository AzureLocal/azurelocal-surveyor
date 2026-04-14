# Architecture Overview

Azure Local Surveyor is a single-page React application that translates the
`S2D_Capacity_Calculator.xlsx` workbook into a typed, versioned, browser-resident
planning tool. This page describes the four main layers and how they fit together.

---

## Layers

```mermaid
graph TB
    User(("User"))

    subgraph UI ["UI Layer — React + React Router"]
        Pages["Pages\nHardwarePage · WorkloadsPage · AvdPage\nSofsPage · AksPage · MabsPage\nVolumesPage · ReportsPage"]
        Components["Components\nHardwareForm · WorkloadPlanner · AvdPlanner\nSofsPlanner · VolumeTable · FinalReport\nCapacityReport · ComputeReport · HealthCheck"]
    end

    subgraph State ["State Layer — Zustand (persisted)"]
        Store["useSurveyorStore\nhardware · advanced · volumes · volumeMode\navd · avdEnabled · sofs · sofsEnabled\naks · mabs · mabsEnabled · virtualMachines\nservicePresets · customWorkloads"]
    end

    subgraph Engine ["Engine Layer — Pure TypeScript"]
        EngFns["capacity.ts · compute.ts · volumes.ts\navd.ts · avd-pools.ts · sofs.ts\naks.ts · mabs.ts · mabs.ts\nworkloads.ts · service-presets.ts\ncustom-workloads.ts · healthcheck.ts\nworkload-volumes.ts · hardware.ts"]
    end

    subgraph Exports ["Export Layer"]
        Exporters["pdf.ts · xlsx.ts · markdown.ts\npowershell.ts · json.ts"]
        Files["Downloads\n.pdf · .xlsx · .md · .ps1 · .json"]
    end

    User --> Pages
    Pages --> Components
    Components <-->|read/write| Store
    Store -->|inputs| EngFns
    EngFns -->|results| Components
    EngFns -->|results| Exporters
    Store -->|inputs| Exporters
    Exporters --> Files
```

---

## UI Layer

**Pages** (`src/pages/`) are React Router route components. Each page initialises
its section of the store and delegates planning UI to one or more components.

| Page | Components used | Primary engine call |
|---|---|---|
| `HardwarePage` | `HardwareForm`, `AdvancedSettings` | — (inputs only) |
| `WorkloadsPage` | `WorkloadPlanner` | `computeCapacity`, `computeAvd`, `computeAks`, `computeSofs`, `computeMabs`, `computeWorkloadTotals` |
| `AvdPage` | `AvdPlanner` | `computeAvd` |
| `SofsPage` | `SofsPlanner`, `SofsReport` | `computeSofs` |
| `AksPage` | inline | `computeAks` |
| `MabsPage` | inline | `computeMabs` |
| `VolumesPage` | `VolumeTable` | `computeVolumeSummary`, `computeQuickStart` |
| `ReportsPage` | `CapacityReport`, `ComputeReport`, `FinalReport`, `HealthCheck`, `SofsReport` | all engine modules |

**Components** (`src/components/`) are self-contained UI units. They read from the
Zustand store, call engine functions for display, and write back to the store on
user input. Components never hold derived state — every derived value is computed
on each render from the current store snapshot.

---

## State Layer

`src/state/store.ts` is a single Zustand store that is persisted to `localStorage`
with versioned migrations. Every user-editable field lives here; computed results
are never stored — they are re-derived on every render.

| Store slice | Shape | Default source |
|---|---|---|
| `hardware` | `HardwareInputs` | `DEFAULT_HARDWARE` in `types.ts` |
| `advanced` | `AdvancedSettings` | `DEFAULT_ADVANCED_SETTINGS` in `types.ts` |
| `volumes` | `VolumeSpec[]` | `[]` |
| `volumeMode` | `"workload" \| "generic"` | `"workload"` |
| `avd` | `AvdInputs` (with `pools[]`) | single pool, 100 users |
| `avdEnabled` | `boolean` | `false` |
| `sofs` | `SofsInputs` | defaults in `types.ts` |
| `sofsEnabled` | `boolean` | `false` |
| `aks` | `AksInputs` (with `aks.enabled`) | 1 cluster, 3 control, 3 workers |
| `mabs` | `MabsInputs` | defaults in `types.ts` |
| `mabsEnabled` | `boolean` | `false` |
| `virtualMachines` | `VmScenario` | `enabled: false` |
| `servicePresets` | `ServicePresetInstance[]` | `[]` |
| `customWorkloads` | `CustomWorkload[]` | `[]` |

The store uses **version 8** (as of v1.5.0). Migrations run on startup if the
persisted version is older; see `store.ts` for the migration chain.

---

## Engine Layer

All engine functions are **pure** — they take typed inputs and return typed results
with no side-effects, no React imports, and no global state. This makes them trivial
to test independently and safe to call from both UI components and exporters.

### Module dependency graph

```mermaid
graph LR
    HW["hardware.ts\nvalidateHardwareInputs()"]
    CAP["capacity.ts\ncomputeCapacity()"]
    COMP["compute.ts\ncomputeCompute()"]
    VOL["volumes.ts\ncomputeVolumeSummary()\ntoWacSize()\ncomputeQuickStart()"]
    HC["healthcheck.ts\nrunHealthCheck()"]
    WL["workloads.ts\ncomputeWorkloadTotals()\nvmScenarioTotals()"]
    AVD["avd.ts\ncomputeAvd()\navd-pools.ts"]
    SOFS["sofs.ts\ncomputeSofs()"]
    AKS["aks.ts\ncomputeAks()"]
    MABS["mabs.ts\ncomputeMabs()"]
    SP["service-presets.ts\ncomputeAllServicePresets()\ngetCatalogEntry()"]
    CW["custom-workloads.ts\ncomputeAllCustomWorkloads()"]
    WVOL["workload-volumes.ts\nworkload-driven volume rows"]

    CAP --> VOL
    CAP --> HC
    COMP --> HC
    VOL --> HC
    WL --> HC
    AVD --> WL
    SOFS --> WL
    AKS --> WL
    MABS --> WL
    SP --> WL
    CW --> WL
    CAP --> WVOL
    WL --> WVOL
```

### Key interfaces

All input and result types are defined in `src/engine/types.ts`.
The type file is the single authoritative reference for:
- all `*Inputs` shapes (user-editable fields)
- all `*Result` shapes (engine outputs)
- shared enums: `ResiliencyType`, `DriveMedia`, `AvdWorkloadType`
- `DEFAULT_HARDWARE` and `DEFAULT_ADVANCED_SETTINGS` constants

---

## Export Layer

`src/exporters/` contains five export functions, one per format.
All exporters are called from `FinalReport.tsx` and receive the same `state`
object (a `Pick<SurveyorState, ...>` containing all relevant store slices).
Each exporter re-runs the engine to compute a fresh, consistent snapshot —
nothing is cached between UI renders and export.

| File | Format | Key output |
|---|---|---|
| `pdf.ts` | PDF | Multi-section report with all planner results |
| `xlsx.ts` | Excel | Multi-sheet workbook with hardware, capacity, workloads, AVD, SOFS |
| `markdown.ts` | Markdown | Human-readable planning summary |
| `powershell.ts` | PowerShell | `New-Volume` commands for all planned volumes |
| `json.ts` | JSON | Versioned `SurveyorPlan` manifest (see [plan-manifest.md](../reference/plan-manifest.md)) |

The JSON exporter is the primary **machine-readable handoff artifact**. Its schema
is versioned independently of the app version — see [plan-manifest.md](../reference/plan-manifest.md)
for the full schema and Ranger integration notes.

---

## OEM Hardware Presets

`src/engine/presets/` contains static hardware preset files for OEM server models.
Selecting a preset in `HardwareForm` populates the hardware inputs in one click.
Presets are verified against Microsoft's official Azure Local hardware catalog.

| File | Models |
|---|---|
| `dell-ax.ts` | AX-650, AX-750, AX-760, AX-670, AX-770 |
| `lenovo-mx.ts` | MX3530-H, MX3530-F, MX3535 |
| `hpe-proliant.ts` | DL380 Gen11, EL8000 |
| `dataon.ts` | S2D-5212, S2D-4112 |

---

## Share URL

The app supports a share URL that base64-encodes the current Zustand store state
into the URL hash. This allows a complete plan to be shared as a single URL without
any server-side storage. The share URL is a UI convenience; for durable baseline
artifacts use the JSON export.
