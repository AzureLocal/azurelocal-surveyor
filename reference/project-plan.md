# Azure Local Surveyor — Project Plan

> Plan your Azure Local cluster before you rack it. Capacity, volumes, and workload sizing in your browser.

**Repo:** `AzureLocal/azurelocal-surveyor`
**Lifecycle position:** Scout (discover) → **Surveyor (plan)** → Ranger (audit)
**Owner:** Kristopher Turner / AzureLocal org
**Source of truth (today):** `S2D_Capacity_Calculator.xlsx` (15 sheets, ~879 formulas)

---

## 1. What you have today

The existing workbook is a remarkably complete planning tool. Inventory of the 15 sheets, with formula counts and role:

| Sheet | Formulas | Role | Migrates to |
|---|---:|---|---|
| How to Use | 0 | Onboarding text | `/docs` MkDocs page |
| Hardware Inputs | 21 | Step 1 — node count, drive media, drive size, cache config | `engine/hardware.ts` + `<HardwareForm/>` |
| Workload Planner | 121 | Scenario-based VM sizing across multiple workloads | `engine/workloads.ts` + `<WorkloadPlanner/>` |
| AVD Planning | 80 | Single source of truth for AVD session host & profile sizing | `engine/avd.ts` + `<AvdPlanner/>` |
| SOFS Planner | 25 | SOFS guest cluster sizing (FSLogix scale-out) | `engine/sofs.ts` + `<SofsPlanner/>` |
| Volume Detail | 95 | Per-volume layout with WAC/PowerShell-ready sizes | `engine/volumes.ts` + `<VolumeTable/>` |
| Capacity Report | 14 | Executive capacity summary | `<CapacityReport/>` |
| Compute Report | 98 | CPU/vCPU oversubscription, NUMA, memory | `engine/compute.ts` + `<ComputeReport/>` |
| **Final Report** | **238** | Master output, all sections rolled up | `<FinalReport/>` + PDF export |
| Drive Layout Comparison | 53 | Compare current config to alternative drive layouts | `<LayoutCompare/>` |
| Thin Provisioning | 0 | Guidance/risk text | Static doc page |
| Volume Health Check | 52 | Validates planned volumes against pool reserve & resiliency rules | `engine/healthcheck.ts` + `<HealthCheck/>` |
| References | 0 | MS doc links | Static |
| Advanced Settings | 82 | Capacity efficiency factor, reserve %, overrides | `<AdvancedSettings/>` drawer |
| To Do | 0 | Personal backlog | Move to GitHub Issues |

**Total: ~879 formulas across 15 sheets.** Cross-sheet dependencies flow: `Hardware Inputs` → (`Workload Planner`, `AVD Planning`, `SOFS Planner`, `Advanced Settings`) → `Volume Detail` → (`Capacity Report`, `Compute Report`, `Volume Health Check`) → `Final Report`. This is a clean DAG, which is good news — it maps directly onto a pure-functional TypeScript engine with no circular state.

**Strengths to preserve:**
- AVD planning is already consolidated to one tab (single source of truth) — keep that pattern.
- Volume Detail explicitly distinguishes "calculator-only TB" from "value to enter in WAC/PowerShell" — that distinction must survive the port; it's the most error-prone part of real S2D planning.
- Advanced Settings exposes the 92% capacity efficiency factor and reserve as user-tunable — keep this, default it, hide it behind a drawer.
- Drive Layout Comparison is a killer feature competitors don't have.

**Weaknesses Excel can't fix (Surveyor will):**
- No scenario sharing — emailing .xlsx files around loses state.
- No OEM SKU presets — users hand-enter Dell/Lenovo/HPE/DataON drive specs every time.
- No validation against Azure Local supported configs (min nodes, cache:capacity ratios, sub-4-node resiliency rules).
- No PowerShell/WAC command export.
- Conditional formatting and cross-sheet references are fragile.
- Can't be embedded in a blog post or linked from a customer proposal.

---

## 2. What I'm suggesting (recommended path)

### Stack
- **Vite + React 18 + TypeScript** — same family as `azurelocal-azloflows` and `odinforazurelocal`, so the org has consistent tooling.
- **Tailwind CSS + shadcn/ui** — matches the design language you've been using on Hybrid Cloud Solutions branding.
- **Zustand** for state (lighter than Redux, perfect for a single-document calculator).
- **Zod** for input validation and schema-driven URL/JSON serialization.
- **Vitest** for unit tests against the engine.
- **MkDocs Material** for `/docs` (matches Ranger's planned doc stack).
- **GitHub Actions** → **GitHub Pages** deploy. Custom domain `surveyor.azurelocal.cloud`.

### Architectural principle: engine-first, UI second
```
src/
├── engine/                 # Pure TypeScript. Zero React. 100% unit-tested.
│   ├── hardware.ts         # Node/drive math
│   ├── capacity.ts         # Pool capacity, reserve, efficiency
│   ├── volumes.ts          # Resiliency math (2-way/3-way mirror, mirror-accelerated parity)
│   ├── workloads.ts        # Generic workload planner
│   ├── avd.ts              # AVD-specific sizing
│   ├── sofs.ts             # SOFS guest cluster sizing
│   ├── compute.ts          # CPU/memory/oversubscription
│   ├── healthcheck.ts      # Volume health validation
│   ├── presets/
│   │   ├── dell-ax.ts      # Dell AX node SKUs
│   │   ├── lenovo-mx.ts    # Lenovo ThinkAgile MX
│   │   ├── hpe-proliant.ts
│   │   └── dataon.ts
│   └── __tests__/          # Parity tests vs. the .xlsx (golden values)
├── components/             # React UI
├── pages/                  # Route-level views (Hardware, Workloads, AVD, SOFS, Volumes, Reports)
├── state/                  # Zustand store + URL serializer
└── exporters/
    ├── pdf.ts              # jsPDF — Final Report
    ├── xlsx.ts             # SheetJS — round-trip back to Excel
    ├── powershell.ts       # New-Volume / Set-StoragePool commands
    └── markdown.ts         # For pasting into customer docs
```

### Phase 0 — Formula extraction & parity harness (Week 1)
**This is the highest-leverage work and must come first.** Before any UI:
1. Script-extract every formula from the workbook into `engine-spec.json` (cell address → formula → dependencies).
2. Build a dependency graph; confirm the DAG.
3. Pick **20 golden scenarios** (2-node all-NVMe, 4-node hybrid, 8-node all-flash AVD, etc.). Record every input and every output cell value.
4. Re-implement the math in TypeScript. Vitest assertion: every golden scenario matches Excel to within ±0.01 TB.
5. Only after 20/20 pass do we touch the UI.

This is non-negotiable. Without parity tests, every UI bug becomes a math bug and trust evaporates.

### Phase 1 — MVP (Weeks 2–3)
- Hardware Inputs form (with OEM presets)
- Capacity engine + Capacity Report view
- Volume Detail table with per-volume resiliency picker
- URL state serialization (shareable scenarios)
- Dark mode, print stylesheet
- GitHub Pages deploy + custom domain

### Phase 2 — Workload planners (Weeks 4–5)
- Workload Planner (generic VMs)
- AVD Planner (port the 80 formulas)
- SOFS Planner
- Volume Health Check

### Phase 3 — Reports & exports (Week 6)
- Final Report view (the big one — 238 formulas)
- Compute Report
- PDF export, XLSX round-trip, PowerShell command export, Markdown export
- Drive Layout Comparison view

### Phase 4 — Polish & launch (Week 7)
- MkDocs site
- Blog post on thisismydemo.cloud
- Demo video
- MVP Summit / MMS talk material

---

## 3. What's also possible (stretch / future)

- **MCP server wrapper** — `@azurelocal/surveyor-mcp` so Claude/Copilot can call the calculator from chat. ("Size a 1,500-user AVD environment on Dell AX-760.") Fits your existing MCP and Claude work.
- **Scout integration** — import a Scout JSON inventory to pre-populate Hardware Inputs from a real discovered cluster. Closes the loop between discover and plan.
- **Ranger integration** — export a "planned baseline" that Ranger can audit against. Closes the loop between plan and audit.
- **PWA / offline mode** — works on a plane to a customer site.
- **Embeddable iframe widget** — drop a mini-calculator into a thisismydemo.cloud blog post.
- **Azure Static Web Apps + tiny Function** — if you ever want anonymous telemetry (which configs are most popular), SWA gives you a free Function tier without abandoning the static-first model.
- **Blazor WASM port** — if a customer demands a .NET-only stack. Engine is pure TS, so a port is mechanical.
- **PowerShell companion module** — `AzureLocal.Surveyor` on PSGallery, wraps the same engine logic via a Node-hosted CLI or a hand-port. Gives CLI users the same answers.
- **Validated against Microsoft sizing guidance** — automated CI check that pulls the latest Azure Local hardware requirements and flags drift.
- **Multi-scenario compare view** — three columns side-by-side (2-node vs 4-node vs 8-node), one-click "promote this scenario to primary."

---

## 4. Repo scaffold

```
azurelocal-surveyor/
├── .github/workflows/
│   ├── ci.yml              # Lint, typecheck, vitest, parity tests
│   └── deploy.yml          # Build + deploy to gh-pages
├── docs/                   # MkDocs Material
├── public/
│   └── CNAME               # surveyor.azurelocal.cloud
├── src/                    # (see Phase 0 layout above)
├── reference/
│   └── S2D_Capacity_Calculator.xlsx   # Original workbook, frozen
├── engine-spec.json        # Extracted formulas (Phase 0 output)
├── README.md
├── PROJECT_PLAN.md         # This file
├── CONTRIBUTING.md
├── LICENSE                 # MIT
└── package.json
```

---

## 5. Risks & open questions

- **Formula parity drift** — mitigated by golden-scenario tests in Phase 0.
- **OEM SKU data licensing** — drive specs are public, but vendor names/logos need care. Use neutral SKU strings + a disclaimer.
- **Conditional formatting** — won't translate 1:1; reimplement as Tailwind conditional classes.
- **`Volume Detail` "calculator TB vs WAC TB" distinction** — must be surfaced loudly in UI, not buried.
- **Maintenance load** — engine + UI + docs + MCP wrapper is real work. Phase gating prevents scope creep.

---

## 6. Definition of done (v1.0)

- 20/20 golden scenarios pass parity tests.
- All 15 sheet equivalents implemented or explicitly deferred.
- Deployed to `surveyor.azurelocal.cloud`.
- PDF, XLSX, and PowerShell exports working.
- README, MkDocs site, and one blog post published.
- Linked from AzureLocal org README alongside Scout and Ranger.