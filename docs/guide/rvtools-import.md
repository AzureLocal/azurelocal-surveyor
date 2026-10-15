# RVTools import guide

Surveyor reads an RVTools export in your browser. Nothing is uploaded. Two importers exist and both are on the Workloads page.

| Importer | Use it for | Result |
| --- | --- | --- |
| **Individual VM inventory** (Import RVTools / vInfo) | Sizing from the real VM list | One editable row per VM, with inclusion, tier and evidence |
| **Custom workload import** (Specialized, grouped) | A quick fleet estimate | VMs grouped by identical vCPU and memory into one workload per signature |

Enter each machine once. Individual inventory and grouped workloads are additive.

## Accepted files

- An RVTools **.xlsx** workbook, or the **vInfo** tab saved as **.csv**. A workbook needs a sheet named `vInfo`; a one-sheet file is treated as vInfo.
- Optional **vPartition** sheet for consumed storage.

## Columns used

| Column (case-insensitive) | Used for |
| --- | --- |
| `VM` | Name (required for the individual importer) |
| `CPUs` (or `CPU`) | vCPU allocation |
| `Memory` | Allocated memory in MiB; converted to GiB by dividing by 1024 |
| `Provisioned MiB` (or MB) | Provisioned storage |
| `In Use MiB` (or MB) | Used storage when no partition data exists |
| `Consumed MiB` on **vPartition** | Preferred consumed storage; summed per VM |
| `Powerstate` | Powered on, off or suspended |
| `Template`, `SRM Placeholder` | Rows marked true are skipped |
| `Cluster`, `Host`, `VM UUID`, guest OS columns | Kept as evidence and to tell duplicate names apart |

All other columns are ignored.

## What is skipped

- **Templates** and **SRM placeholders**.
- **vCLS** agent VMs, named `vCLS-<id>` or `vCLS (1)`: they are vSphere platform VMs, not workloads. The grouped importer skips them too and reports the count.
- Rows with no CPU, memory or storage at all (blank or footer rows).

## Powered-off VMs

Powered-off and suspended VMs are **kept and included**. Surveyor warns with the count. Exclude them on the review screen if they are decommissioned; leave them in if they are cold workloads that will move.

## Allocated versus measured

RVTools holds **allocation evidence**: what each VM was given, not what it uses. Surveyor therefore sizes from allocation by default.

- **Allocation (default):** vCPU and memory as configured.
- **Measured P95 (optional):** attach a P95 CSV (use the downloadable template, which carries stable VM IDs) with CPU %, memory %, IOPS and throughput. Missing metrics fall back to allocation independently. Measured sizing assumes you will apply the right-sizing it implies.
- **Storage basis:** provisioned (default) or consumed. Consumed sizing relies on thin provisioning or reclamation and does not reserve the gap up to provisioned capacity.

## Review before sizing

Check tiers (suggested from VM names such as SQL, DC, AVD), duplicate-name warnings and storage warnings. A VM with no storage evidence stops the import rather than becoming zero demand.

## Security of the workbook

Spreadsheet parsing uses SheetJS 0.20.3 (pinned with an integrity hash in `package-lock.json`). The earlier 0.18.5 release had prototype-pollution and ReDoS advisories. Tests cover hostile headers and very long cells. Still treat workbooks from other people as untrusted input.
