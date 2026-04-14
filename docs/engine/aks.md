# AKS Engine

AKS on Azure Local (AKS enabled by Azure Arc) sizing — `src/engine/aks.ts`.

---

## Inputs

| Field | Description | Default |
|---|---|---|
| `clusterCount` | Number of independent AKS clusters | 1 |
| `controlPlaneNodesPerCluster` | 1 (dev) or 3 (HA) | 3 |
| `workerNodesPerCluster` | Worker nodes per cluster | 3 |
| `vCpusPerWorker` | vCPUs per worker node | 4 |
| `memoryPerWorkerGB` | RAM per worker node (GB) | 16 |
| `osDiskPerNodeGB` | OS disk per node (GB) | 200 |
| `persistentVolumesTB` | Aggregate PVC storage across all clusters (TB) | 0 |
| `dataServicesTB` | Extra storage for Arc data services (TB) | 0 |
| `resiliency` | S2D resiliency type for workload volumes | `three-way-mirror` |

---

## Computation

Control plane nodes use [Microsoft AKS Arc fixed specs](https://learn.microsoft.com/en-us/azure/aks/hybrid/overview): **4 vCPUs / 16 GB RAM** each.

```
totalControlPlaneNodes = clusterCount × controlPlaneNodesPerCluster
totalWorkerNodes       = clusterCount × workerNodesPerCluster
totalNodes             = totalControlPlaneNodes + totalWorkerNodes

totalControlPlaneVCpus    = totalControlPlaneNodes × 4
totalControlPlaneMemoryGB = totalControlPlaneNodes × 16

totalWorkerVCpus    = totalWorkerNodes × vCpusPerWorker
totalWorkerMemoryGB = totalWorkerNodes × memoryPerWorkerGB

totalVCpus    = totalControlPlaneVCpus + totalWorkerVCpus
totalMemoryGB = totalControlPlaneMemoryGB + totalWorkerMemoryGB

osDiskTB      = round2((totalNodes × osDiskPerNodeGB) / 1024)
totalStorageTB = osDiskTB + persistentVolumesTB + dataServicesTB
```

---

## Storage resiliency field scope

The **Workload volume resiliency** field (`resiliency`) controls the S2D resiliency recommendation for:

- AKS-PersistentVolumes volume suggestions generated in the Volume Detail report
- Arc data service volumes (`dataServicesTB`)

**Node OS disks always use Three-Way Mirror** regardless of this setting. This is a fixed AKS Arc behaviour and cannot be overridden in Surveyor.

The field was renamed from "Storage resiliency" to "Workload volume resiliency" in Surveyor v1.3.0 to make this scope distinction explicit. The hint text in the UI reads: *"applies to PVC and data service volume suggestions"*.

---

## Arc-enabled service presets and AKS dependency

All Arc-enabled service presets (SQL Managed Instance GP/BC, IoT Operations, AI Foundry Local, Container Apps) are flagged `requiresAks: true` in `src/engine/service-presets.ts`.

When any of these presets is enabled and AKS is **disabled**, the Workload Planner shows an amber warning banner with a one-click **Enable AKS** button. This ensures the infrastructure sizing captures the AKS runtime overhead.

If a user tries to disable AKS while one of these presets is enabled, a confirmation dialog warns that the affected services will be left without a runtime.

### Out of scope for current releases

The following AKS additions are tracked for future consideration but are **not** in scope:

- **Node pool diversity**: separate control-plane / system / user pool breakdown
- **GPU node pools**: separate GPU node type with different vCPU/RAM specs
- **Autoscaling headroom**: min/max node count with buffer percentage
- **Multiple Kubernetes versions**: no per-cluster K8s version tracking

---

## Integration points

| System | Detail |
|---|---|
| Capacity planner | `totalVCpus` and `totalMemoryGB` flow into host sizing |
| Volume Detail | `persistentVolumesTB` drives AKS-PersistentVolumes row; `dataServicesTB` drives AKS-DataServices row; both use `resiliency` for raw footprint |
| Workload summary | AKS appears as a dedicated row when enabled |
| PDF / XLSX / Markdown | AKS totals exported in workload summary when enabled |
| Service presets | Presets with `requiresAks: true` trigger the dependency banner when AKS is off |
