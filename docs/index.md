# Azure Local Surveyor — v2.8.0

Plan storage and workloads in the [Surveyor website](https://azurelocal.cloud/azurelocal-surveyor/). Calculations run in your browser.

## Choose your planning area

| Start here | Your question | Follow this path |
| --- | --- | --- |
| **Storage Sizing** | How much usable storage does this configuration provide? | Hardware & Drives → Capacity & Resiliency → Volume Planning → Storage Report |
| **Workload Planning: buy hardware** | What hardware do these workloads need? | Workloads → Hardware Options → Fit & Recommendations → Storage Design → Reports & Exports |
| **Workload Planning: existing hardware** | What can my current equipment run? | Hardware → Workloads → Fit & Recommendations → Storage Design → Reports & Exports |

Storage Sizing works independently. You do not need to enter VMs or enable any workload to use it. Each area has its own active project and browser persistence.

Read the [planning guide](./guide/planning-areas.md) for detailed workflows, transfers and saved projects.

## Inputs and results

Enter physical nodes, capacity drives and drive sizes. Cache drives are separate from capacity drives. OEM presets are documented planning examples with vendor sources and review dates; [review their assumptions](./reference/oem-presets.md) before customizing hardware.

Capacity results distinguish raw pool space, reserves and overhead, space available for volumes, and effective usable space under a comparison resiliency. Each planned volume has its own resiliency and pool footprint. Review the complete volume design and health checks before using exported sizes or scripts.

Workload Planning combines included individual VMs, optional measured demand, quick VM groups and enabled specialized services. Avoid entering the same workload in more than one place. Hardware fit checks CPU, RAM and storage footprint, including your selected compute maintenance reserve.

## Learn more

- [Planning areas and project workflows](./guide/planning-areas.md)
- [Capacity model](./engine/capacity.md) and [volume sizing](./engine/volumes.md)
- [Workload calculations](./engine/workloads.md) and [compute](./engine/compute.md)
- [OEM presets and sources](./reference/oem-presets.md)
- [Saved projects and plan manifests](./reference/plan-manifest.md)
- [Release notes](./changelog.md)

For Windows Server Hyper-V planning, open [Hyper-V Surveyor](https://labs.hybridsolutions.cloud/hyperv-surveyor/).
