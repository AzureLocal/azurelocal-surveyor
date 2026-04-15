# Azure Local Surveyor

> Azure Local S2D capacity planning and workload sizing — a TypeScript port of the Excel-based `S2D_Capacity_Calculator.xlsx`.

**Live app:** [surveyor.azurelocal.cloud](https://surveyor.azurelocal.cloud)

## Related tool

Already deployed your cluster? Use [Azure Local S2DCartographer](https://github.com/AzureLocal/azurelocal-s2d-cartographer) to inventory disks, pools, and volumes on a running Azure Local cluster; generate HTML, Word, PDF, and Excel reports; and validate what was actually built. Surveyor plans before deployment; S2DCartographer verifies after deployment.

---

## What's new in v2.0

**v2.0** is a comprehensive quality overhaul that delivers multi-workload planning end-to-end:

| Area | What changed |
|---|---|
| **AKS Multi-Cluster** | Plan multiple independent AKS clusters; each gets its own OS-disk and PVC volumes |
| **VM Storage Groups** | Organize VMs into named groups; one volume suggestion per group |
| **SOFS Volume Layout** | Choose `shared` (1+1 volumes) or `per-vm` (N+N volumes); OS disk per VM sized separately |
| **Per-Volume Resiliency** | Each volume carries its own resiliency type; pool footprint reflects per-volume resiliency |
| **Per-Volume Provisioning** | Each volume is `fixed` or `thin`; health check enforces fixed-only capacity constraint |
| **Quick Start Reference** | Two-row hardware reference (three-way + two-way); 1 GiB safety margin on WAC sizes |
| **Compute Health Check** | Dedicated compute-tier checks: HC_VCPU_HIGH, HC_VCPU_OVER_SUBSCRIBED, HC_MEMORY_HIGH, HC_MEMORY_EXCEEDED |
| **Reports Page** | Conditional tabs for AVD, AKS, MABS, and SOFS; each tab shows a full solution summary |
| **Arc → AKS Integration** | Arc-enabled service preset storage folds into AKS-ArcServices-PVC when AKS is enabled |
| **Custom Workloads** | Internal mirror factor applied to data volume sizing; OS disk volume generated per VM |
| **Store Migration** | Full v2→v9 migration chain; exports `migratePersistedState` for direct testing |
| **Test Coverage** | 115 automated tests (up from 63) covering all engine functions and migration logic |

---

## What it does

Azure Local Surveyor gives you a browser-based, shareable version of the S2D capacity calculator. You enter your hardware inputs once and the engine computes:

| Sheet | Formulas | What it answers |
|---|---|---|
| Hardware Inputs | 12 | Physical drive counts, sizes, resiliency |
| Capacity Report | 45 | Effective usable TB using your resiliency + efficiency |
| Volume Detail | 95 | Per-volume WAC-ready sizes (Calculator TB vs WAC GB) |
| Workload Planner | 38 | Generic VM vCPU / memory / storage totals |
| AVD Planning | 80 | Session host count, FSLogix profile storage |
| SOFS Planner | 25 | Guest cluster sizing for redirected folders |
| Compute Report | 60 | Physical → usable vCPU/memory with oversubscription |
| Drive Layout Comparison | 53 | Current vs alternative drive layout delta |
| Advanced Settings | 82 | Custom efficiency, reserve drives, oversubscription |
| Health Check | 52 | Pass/fail validation with severity levels |

## Quick start

```bash
git clone https://github.com/AzureLocal/azurelocal-surveyor.git
cd azurelocal-surveyor
npm install
npm run dev
```

Open `http://localhost:5173`.

## Tests

The engine ships with 115 automated tests, including 20+ golden-scenario parity tests validated against the source Excel workbook and 39 new Phase 14 verification tests:

```bash
npm test
```

Tests live in `src/engine/__tests__/` and `src/state/`. All must pass before any change is merged.

**Test scope:**
- Capacity parity — 20 golden scenarios vs Excel
- AVD parity — 12 golden scenarios
- SOFS parity — 8 golden scenarios
- Compute parity — 6 golden scenarios
- Engine tests — volume suggestions, health checks, AKS, SOFS layouts, Arc integration
- Custom workloads — mirror factor, OS disk generation, disabled exclusion
- Quick Start Reference — rounding, 1 GiB margin, volume count cap
- Store migration — full v2→v9 chain, each transformation individually tested

## Sharing scenarios

Hit **Share** on any page to copy a URL encoding your full state as a base64url query parameter. Anyone with the link can open your exact scenario.

## Exporting

From the Reports page:

- **PDF** — printable customer proposal
- **XLSX** — round-trip workbook with all sheets
- **PowerShell** — `New-Volume` commands with WAC-ready sizes
- **Markdown** — table output for wikis or documentation

## Reference workbook

The source Excel file is not committed to this repo. Copy it from `azurelocal-toolkit`:

```
E:\git\azurelocal-toolkit\tools\planning\S2D_Capacity_Calculator.xlsx
→ reference\S2D_Capacity_Calculator.xlsx
```

See [reference/README.md](reference/README.md) for details.

## Stack

| Layer | Technology |
|---|---|
| Framework | Vite 5 + React 18 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand (persisted) |
| Validation | Zod |
| PDF export | jsPDF + autoTable |
| XLSX export | SheetJS |
| Tests | Vitest |
| Deploy | GitHub Actions → GitHub Pages |

## License

MIT — see [LICENSE](LICENSE).
