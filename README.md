# Azure Local Surveyor

> Azure Local S2D capacity planning and workload sizing — a TypeScript port of the Excel-based `S2D_Capacity_Calculator.xlsx`.

**Live app:** [surveyor.azurelocal.cloud](https://surveyor.azurelocal.cloud)

## Related tool

Already deployed your cluster? Use [Azure Local S2DCartographer](https://github.com/AzureLocal/azurelocal-s2d-cartographer) to inventory disks, pools, and volumes on a running Azure Local cluster; generate HTML, Word, PDF, and Excel reports; and validate what was actually built. Surveyor plans before deployment; S2DCartographer verifies after deployment.

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

## Parity tests

The engine ships with 20 golden scenarios validated against the source Excel workbook:

```bash
npm test
```

Tests live in `src/engine/__tests__/`. All must pass before any UI change is merged.

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
