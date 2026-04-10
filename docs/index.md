# Azure Local Surveyor — How to Use

**Azure Local Surveyor** is a capacity planning tool for [Azure Local](https://learn.microsoft.com/azure/azure-local/overview) (formerly Azure Stack HCI). Enter your hardware configuration once and get instant, accurate storage/compute numbers — the same math that powers the internal S2D Capacity Calculator Excel workbook.

---

## Quick Start

**Three steps to get a number:**

1. **Hardware** — Pick an OEM preset *or* manually enter node count, drive count, drive size, and CPU/RAM.
2. **Capacity** — Review the storage report. The "Effective Usable" row is your planning number.
3. **Workloads** — Enable the scenarios that apply (AVD, AKS, VMs, backup) to check utilization against available capacity.

That's it. Use the **Export** button to download an Excel workbook, PDF report, or PowerShell deployment script.

---

## Page-by-Page Guide

### Hardware

| Field | What to enter |
|---|---|
| **Node count** | Number of physical server nodes in the cluster (2–16) |
| **Drives per node** | Capacity (NVMe/SSD/HDD) drives — **do not include cache drives** |
| **Drive size** | Labeled TB per drive (e.g. 3.84 for a 3.84 TB NVMe) |
| **Cache drives** | Optional NVMe read/write cache tier count and size |
| **Cores per node** | Physical CPU cores (not threads) |
| **Memory per node** | Total installed RAM in GB |
| **Hyperthreading** | Enable if the server BIOS exposes logical threads (most modern servers) |
| **Volume provisioning** | Fixed = pre-allocated; Thin = on-demand (affects PowerShell export) |

> **OEM Presets** — The preset dropdown populates all hardware fields from known good configurations (Dell AX-670, AX-770, etc.). You can still override any field after selecting a preset.

### Advanced Settings

| Setting | Default | Notes |
|---|---|---|
| **Capacity efficiency factor** | 0.92 | Drive usable ÷ labeled. Standard for NVMe/SSD. Use 0.80–0.85 for HDD. |
| **Infra volume size** | 0.25 TB | Pool space reserved for the cluster infrastructure volume (Azure Local requirement). |
| **Default resiliency** | Three-way mirror | Applied to the capacity report. Each volume can override this. |
| **vCPU oversubscription** | 4:1 | Logical vCPUs per physical core offered to VMs. Common range: 3:1–8:1. |
| **System reserved vCPUs** | 4 per node | Held back for OS, Hyper-V, and Azure agent processes. |
| **System reserved RAM** | 8 GB per node | Same. |

### Capacity Report

The capacity report breaks the calculation into four sections:

| Section | Fields |
|---|---|
| **Raw Pool** | Raw TB = drives × drive size × nodes |
| **Deductions** | Reserve drives (= `min(nodeCount, 4)`) and infra volume pool footprint |
| **Available for User Volumes** | TB and TiB available after deductions — use the **TiB** value when creating volumes in Windows Admin Center |
| **Planning Number** | **Effective Usable TB** = Available × resiliency factor — this is the number to quote to customers |

#### Resiliency types

| Type | Min nodes | Efficiency | When to use |
|---|---|---|---|
| Two-way mirror | 2 | 50 % | Entry-level, max 2 nodes |
| Three-way mirror | 3 | 33 % | All-flash, best IOPS |
| Dual parity | 4 | 50–80 %* | Capacity-focused all-flash; minimum 4 nodes |
| Nested two-way | 4 | 25 % | Stretched / branch clusters |

*Dual parity efficiency scales with node count:  
`4–6 nodes → 50%`, `7–8 nodes → 66.7%`, `9–15 nodes → 75%`, `16 nodes → 80%`

### Volumes

Add named volumes to check whether your planned sizes fit within effective usable capacity.  
The **WAC Size (GB)** column is the exact value to enter in Windows Admin Center when creating each volume (Windows uses GiB internally).

> **Tip:** The health check will raise an error if the combined volume footprint exceeds your available capacity.

### Workloads

Six toggleable scenario cards match the Excel "Workload Planner" sheet:

| Scenario | What it sizes |
|---|---|
| **AVD** | Azure Virtual Desktop session hosts. Click the link to go to the full AVD sizing page. |
| **AKS on Azure Local** | Arc-enabled AKS control-plane nodes + worker pools |
| **Infrastructure VMs** | Always-on VMs (AD, DNS, WSUS, monitoring, etc.) |
| **Dev / Test VMs** | Non-production, generally lower density |
| **Backup / Archive** | Storage-only estimate for backup target capacity |
| **Custom VMs** | Any other workload not covered above |

Enable only the scenarios that apply. Disabled scenarios contribute zero to utilization.

### AVD Planning

Sizes [Azure Virtual Desktop](https://learn.microsoft.com/azure/virtual-desktop/) session hosts on Azure Local:

| Workload | Users/host (multi-session) | vCPUs/host | RAM/host |
|---|---|---|---|
| Light (Office / browser) | 16 | 2 | 8 GB |
| Medium (Office + light GPU) | 8 | 4 | 16 GB |
| Heavy (3D / power users) | 4 | 8 | 32 GB |
| Power / VDI (single-session) | 1 | 8 | 32 GB |

Profile storage (FSLogix containers) is calculated separately and added to storage totals.

### SOFS

Sizes a Scale-Out File Server guest cluster for FSLogix profile storage.  
Add the SOFS total storage to your volume plan when deploying FSLogix over SMB.

### Health Check

The health check runs automatically and flags:

| Code | Meaning |
|---|---|
| `HC_MIN_NODES` | Cluster has fewer nodes than resiliency requires |
| `HC_DUAL_PARITY_REQUIRES_4_NODES` | Dual-parity volume on < 4-node cluster |
| `HC_OVER_CAPACITY` | Sum of volume sizes exceeds effective usable |
| `HC_WORKLOAD_OVER_VCPU` | Total workload vCPUs exceed usable vCPUs |
| `HC_WORKLOAD_OVER_MEMORY` | Total workload RAM exceeds usable RAM |
| `HC_SINGLE_NODE` | A single node cluster cannot form a pool |

### Final Report & Export

The final report page assembles a single-page summary. Export options:

| Format | Contents |
|---|---|
| **Excel (.xlsx)** | All sheets: hardware, capacity, volumes, compute, workloads, AVD |
| **PDF** | Printable report with tables |
| **Markdown** | Copy-paste into GitHub/Confluence/ADO wiki |
| **PowerShell** | `New-Volume` commands ready to run against the cluster |

---

## Common Questions

**Q: Why does the drive size shown differ from what I see in Windows?**  
A: Drive manufacturers label in decimal TB (1 TB = 10¹² bytes). Windows reports in binary TiB (1 TiB = 2⁴⁰ bytes). Surveyor shows both: the **TB** column uses the manufacturer label; the **TiB** column is what Windows Admin Center shows. Always use the TiB number when sizing volumes in WAC.

**Q: What is the "reserve drive" deduction?**  
A: Storage Spaces Direct always holds back `min(nodeCount, 4)` drives' worth of capacity as an internal pool reserve. This is a fixed S2D behavior — it cannot be changed. Surveyor calculates this automatically.

**Q: Why can't I select dual parity on a 2-node cluster?**  
A: Dual parity requires at least 4 nodes. The health check will flag this as an error if you try. Use two-way mirror for 2- and 3-node clusters.

**Q: What does "effective usable" actually mean?**  
A: It's the answered question: "given my drives, my resiliency choice, and the reserved overhead — how much can I actually put data into?" It's the number to use when planning volume sizes and quoting storage to end users.

**Q: The AX-660, AX-4510, and AX-4520 presets are missing. Why?**  
A: Specs for those models are not yet in the presets library. The current Dell presets are the AX-670 and AX-770 (current Premier Solutions catalog). If you have the specs for older models, open a GitHub issue with the node BOM and they will be added.

**Q: How do I plan for a stretched cluster?**  
A: Use **Nested two-way mirror** resiliency (25% efficiency). This reflects the double-mirroring overhead of a stretch deployment across two sites.

**Q: My SOFS cluster uses separate hardware. Should I include it in the Azure Local node count?**  
A: No. Size the SOFS guest VMs under the Workloads → Infrastructure VMs scenario, and add a corresponding volume entry for the SOFS CSV storage.

**Q: How accurate are the AVD host counts?**  
A: The sizing follows Microsoft's [published guidance](https://learn.microsoft.com/azure/virtual-desktop/remote-session-environment-spec). Actual concurrency varies — add ~10–15 % headroom for production deployments.

---

## Tips

- Start conservative: pick **three-way mirror** unless you are capacity-constrained and have ≥ 4 nodes.
- The TiB column in Capacity Report is useful for the **Volume size (GB)** prompt in WAC — convert: `TiB × 1024 = GiB`.
- Use the **Export → PowerShell** option to generate `New-Volume` commands — paste them directly into an elevated PowerShell session on the cluster.
- Check the **Health Check** tab before finalising. A green health check means your volume plan fits the storage budget.
- Hyperthreading is enabled by default because most Azure Local–certified hardware ships with it on. Verify in the server BIOS before disabling.
- Dual parity offers significantly better efficiency than three-way mirror at scale (16-node: 80 % vs 33 %). Consider it for all-flash capacity-optimised clusters.
- The infra volume (0.25 TB default) is a system requirement and cannot be removed. You can increase it if workloads write to the default cluster shared volume.

---

## Docs Structure

```
docs/
  index.md               ← This page — How to use the app
  engine/
    capacity.md          ← Capacity model formula walk-through
    volumes.md           ← Volume sizing and WAC GB explanation
    workloads.md         ← Generic VM workload planner
    avd.md               ← AVD session host sizing
    sofs.md              ← SOFS guest cluster sizing
    compute.md           ← CPU / memory model
    healthcheck.md       ← Validation rules
  reference/
    formula-map.md       ← Excel sheet ↔ TypeScript function mapping
    parity-tests.md      ← 20 golden scenario descriptions
```

## Serving locally

```bash
pip install mkdocs-material
mkdocs serve
```

Open `http://127.0.0.1:8000`.
