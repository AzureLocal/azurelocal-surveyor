# Workloads

The workload model aggregates all enabled scenarios into a single compute and storage demand summary. The aggregation logic lives in `src/engine/workloads.ts`.

## Built-in workload sources

Surveyor can roll up demand from:

- Azure Virtual Desktop (AVD)
- AKS on Azure Local
- generic VM scenarios
- SOFS guest cluster
- MABS
- Arc-enabled service presets
- custom workloads

Each scenario contributes three numbers to the shared summary:

- total vCPUs
- total memory in GB
- total storage in TB

## Important nuance

The workload summary is intentionally a roll-up layer. Some workload-specific math happens before aggregation:

- AVD computes session hosts, FSLogix storage, and bandwidth in `src/engine/avd.ts`
- SOFS computes profile demand, internal mirror compounding, and IOPS in `src/engine/sofs.ts`
- AKS computes control plane, worker, OS-disk, and PVC demand in `src/engine/aks.ts`

The aggregate numbers then feed:

- the Compute report
- the Final report
- exporters
- health checks

## Scope boundaries

- AKS sizing in Surveyor covers base AKS infrastructure. Arc-enabled application platforms are modeled separately as service presets.
- RemoteApp is not yet a first-class workload type in the AVD data model. Current AVD estimates are the host-pool baseline.
- Custom workloads are the escape hatch for anything not represented by a dedicated planner.