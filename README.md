# Azure Local Surveyor

> Azure Local S2D capacity planning and workload sizing — a TypeScript port of the Excel-based `S2D_Capacity_Calculator.xlsx`.

**Live website:** [Azure Local Surveyor](https://azurelocal.cloud/azurelocal-surveyor/)

GitHub Actions tests and builds every push to `main`, publishes the website and its
documentation to GitHub Pages, and verifies the deployed commit and browser workflow.
The workflow only turns green after the public website passes verification.

## Planning areas in v2.9.0

Choose **Storage Sizing** for the standalone calculator: Hardware & Drives → Capacity & Resiliency → Volume Planning → Storage Report. No workloads are required. Storage reports export to PDF, XLSX, Markdown, project JSON and a volume creation script.

Choose **Workload Planning** to answer either **What hardware do I need?** or **What can my existing hardware run?** Import or enter workloads, compare reviewed OEM configurations, or assess available hardware and remaining headroom. Specialized planners are grouped under **Specialized Workloads**.

Each area keeps its own project name and browser state. **Save project** and **Open / Compare** are available throughout each plan. Explicit reviewed copy actions transfer hardware or a storage design between areas. Existing browser plans and older project files open in Workload Planning.

See the [planning guide](docs/guide/planning-areas.md) for both workflows, project handling and sizing assumptions, the [screen guide](docs/guide/screens.md), the [RVTools import guide](docs/guide/rvtools-import.md) and [single node and rack aware clusters](docs/guide/single-node-and-rack-aware.md).

## Workload planning

Start with **Workloads** to import an RVTools workbook or vInfo CSV, or add individual VMs manually.
Review the import preview, VM inclusion, and suggested tiers. Powered-off VMs remain included until
you exclude them. Individual inventory and specialized workload groups are additive: enter each machine once.

Use **Attach performance** with the downloadable CSV template to add aggregate P95 measurements.
Allocation remains the default. Measured sizing falls back independently for missing CPU and memory
metrics and assumes approved right-sizing. The safety multiplier, confidence score, and growth percentage
are planning assumptions. Consumed-storage sizing requires thin provisioning or disk reclamation and does
not automatically reserve the gap to provisioned capacity.

**Fit & Recommendations** checks combined demand against your hardware, including the selected N+1/N+2 compute
reserve, and compares same-spec node counts for hyperconverged Azure Local (1 to 16 nodes; 2, 4, 6 and 8 for rack aware).
Disaggregated SAN deployments of up to 64 nodes are not modeled. It evaluates workload volume suggestions and
the edited volume plan separately; the larger footprint controls the capacity check. It does not certify
per-VM placement, storage performance, networking, or hardware support.

**Save project** downloads the complete planning inputs and inventory evidence. Use **Open / Compare** to open another project to
compare it before restoring. JSON plan manifests can also be reopened. Use downloaded files to retain named
scenarios; browser persistence alone is not a backup. Existing grouped RVTools imports remain grouped when
older saved state is loaded, so no duplicate individual inventory is manufactured.

## Related tool

Already deployed your cluster? Use [Azure Local S2DCartographer](https://github.com/AzureLocal/azurelocal-s2d-cartographer) to inventory disks, pools, and volumes on a running Azure Local cluster; generate HTML, Word, PDF, and Excel reports; and validate what was actually built. Surveyor plans before deployment; S2DCartographer verifies after deployment.

---

## What's new in v2.9.0

Surveyor 2.9.0 plans against **Azure Local 12.2609 (latest)**. Every platform rule it encodes is listed with its Microsoft Learn link and verification date on the in-app References page.

| Area | What changed |
|---|---|
| **Single node** | 1 to 16 nodes. A single node is two-way mirror only, with no cache and no N+1; the planner warns and explains. |
| **Rack aware clusters** | 1+1 (two-way mirror) and 2+2 to 4+4 (four-way mirror, 25%); zone checks, rack-loss compute check, four-way volumes. |
| **Drive and cache rules** | 2 capacity drives minimum; cache needs 2 cache and 4 capacity drives; hybrid 15% ratio, 32 GB and multiple rules; Learn's all-flash and hybrid dual-parity tables. |
| **Facts registry** | `src/engine/facts.ts`: each platform fact with a Learn URL and a verified date, plus a list of planning assumptions that are not Microsoft requirements. |
| **Built vs sized** | Paste an as-built hardware JSON and compare it with sized demand and N+1 headroom. |
| **JSON Schemas** | Versioned schemas for the project and plan files in `docs/reference`, validated by tests. Project `stateVersion` is now 11 (10 still opens). |
| **Security** | SheetJS 0.20.3 (pinned) replaces xlsx 0.18.5; jsPDF 4. A privacy guard test blocks network calls. |
| **Documentation** | Screen guide, RVTools import guide, as-built guide, privacy and data page. |

Earlier highlights: v2.8.0 separated Storage Sizing and Workload Planning; v2.0 added AKS multi-cluster, VM groups, SOFS layouts and per-volume resiliency. See the [changelog](CHANGELOG.md).

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

The engine and application ship with automated tests (run `npm test`): golden-scenario parity tests against the source Excel workbook, Learn-derived tests for single node, rack aware and dual-parity tables (the arithmetic is in the test names), RVTools import parity, project and plan JSON schema validation, a PDF smoke test and a privacy guard.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tests live in `src/engine/__tests__/`, `src/state/` and `src/exporters/`. All must pass before any change is merged. Browser tests (`npx playwright test`, files in `tests/browser`) run in CI against the built site.

## Saving and privacy

Surveyor makes no network calls; the plan lives in your browser's local storage and in the project files you download. There is no share-by-URL feature in this version. See [privacy and data](docs/reference/privacy-and-data.md).

## Exporting

From the Reports page:

- **PDF** — printable customer proposal
- **XLSX** — round-trip workbook with all sheets
- **JSON** — versioned plan manifest ([schema](docs/reference/plan-manifest.schema.json)); **Save project** writes the project file ([schema](docs/reference/project.schema.json))
- **PowerShell** — `New-Volume` commands with WAC-ready sizes
- **Markdown** — table output for wikis or documentation

## Reference workbook

The source Excel file is not committed to this repo. Copy it from `azurelocal-toolkit`:

```
<your clone of azurelocal-toolkit>/tools/planning/S2D_Capacity_Calculator.xlsx
→ reference/S2D_Capacity_Calculator.xlsx
```

See [reference/README.md](reference/README.md) for details.

## Stack

| Layer | Technology |
|---|---|
| Framework | Vite 5 + React 18 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand (persisted) |
| Validation | Zod |
| PDF export | jsPDF 4 + autoTable 5 |
| XLSX import and export | SheetJS 0.20.3 (pinned tarball) |
| Tests | Vitest |
| Deploy | GitHub Actions → GitHub Pages |

## License

MIT — see [LICENSE](LICENSE).
