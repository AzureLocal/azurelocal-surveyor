# Issue Audit & Discovery Report — 2026-04-12

Audit of your pasted feedback/question block against the existing
GitHub issues for `AzureLocal/azurelocal-surveyor`.

## Summary

- 12 distinct requests extracted from your text
- **10** were already turned into issues (7 closed with verified code changes, 3 open on track)
- **2** gaps where issues existed but only partially delivered on the request
- **3** requests had no follow-on issue at all (research closed, but implementation never filed)
- **Result:** 5 new issues opened (#100 – #104)

## Coverage matrix

| R# | Request | Issue | State | Accurate? | Resolved in code? | Gap |
|---|---|---|---|---|---|---|
| R1 | AVD concurrent users vs FSLogix storage | #96 | CLOSED | yes | yes | none |
| R2 | MABS scratch vs backup per-volume resiliency | #97 | OPEN | yes | partial (engine splits, single resiliency) | open on track |
| R3a | Quick-Start — add MS Learn links | #98 | CLOSED | yes | yes | none |
| R3b | Quick-Start — `FAIL` label is scary | #98 | CLOSED | partial | **no** — bare `FAIL` still shown | → **#100** |
| R3c | Quick-Start vs Health Check contradiction | #98 | CLOSED | yes | yes | none |
| R3d | Expand-to-show-why pass/fail | #98 | CLOSED | partial | **no** — only one banner sentence | → **#100** |
| R4 | Edge white-screen on some pages | #83 | CLOSED | yes | yes | none |
| R5 | "Resiliency" field ambiguous; AVD missing | #91 | CLOSED | yes | yes (labels reworded, AVD note added) | none |
| R6 | AVD profile size should flow to SOFS | #92 | CLOSED | yes | yes | none |
| R7 | Align AVD ↔ SOFS data collection | #92 | CLOSED | yes | yes | none |
| R8 | Multi-host-pool AVD | #95 | CLOSED (research) | research only | no implementation | → **#101** |
| R9 | AVD RemoteApp / published apps | #95 | CLOSED (research) | research only | no implementation | → **#102** |
| R10 | Docs — advanced architecture deep dives | #90 | OPEN | yes | no (expected) | open on track |
| R11 | AKS — preset auto-enable, storage resiliency | #89 | CLOSED (research) | research only | partial (resiliency fixed, dep logic not built) | → **#103** |
| R12 | SOFS planner confusion + dedicated report | #88 | CLOSED | yes | yes (but `(#70)` still leaks into MABS label) | → **#104** (small cleanup) |

## New issues opened

| # | Title | Priority |
|---|---|---|
| [#100](https://github.com/AzureLocal/azurelocal-surveyor/issues/100) | [UX] Quick-Start Volumes — expand fit-check to show per-input breakdown and rename FAIL | P2 |
| [#101](https://github.com/AzureLocal/azurelocal-surveyor/issues/101) | [Feature] AVD multi-host-pool support — per-pool workload type, session mode, and storage | P2 |
| [#102](https://github.com/AzureLocal/azurelocal-surveyor/issues/102) | [Research] AVD RemoteApp (published applications) sizing on Azure Local | P3 |
| [#103](https://github.com/AzureLocal/azurelocal-surveyor/issues/103) | [Feature] Service preset → AKS dependency handling | P2 |
| [#104](https://github.com/AzureLocal/azurelocal-surveyor/issues/104) | [UX] Remove internal issue reference (#70) from MABS planner label | P3 |

## Detailed findings on the closed-but-incomplete gaps

### #98 → split into #100 (Quick-Start fit-check)

What you asked for: **when the reference scenario fails, show why** — not just aggregate pool-footprint vs available-space. You also called out that rendering `FAIL` in red is confusing because the user can't edit this table.

What shipped in #98:
- Reassurance banner reworded (`VolumesPage.tsx:270-278`) ✓
- MS Learn links added (`VolumesPage.tsx:365-370`) ✓
- "Difference from Volume Health Check" paragraph (`:358-361`) ✓

What is still missing:
- Last column still prints bare red `FAIL` (`VolumesPage.tsx:321-325`)
- No per-input math breakdown (raw pool → efficiency → reserve → resiliency)
- `HealthCheck.tsx` already has a per-volume detail model that Quick-Start could mirror

→ Captured in #100.

### #95 → split into #101 (multi-pool) and #102 (RemoteApp)

#95 was scoped as research and closed accordingly. But your original text was asking for the *capability*, not just the research. No follow-on implementation issues existed. #101 files the multi-pool feature with a concrete data-model proposal; #102 files RemoteApp as a research issue because Azure Local support needs to be confirmed before we build.

### #89 → split into #103 (AKS dependency handling)

#89 correctly fixed the `aks.resiliency` wiring bug and clarified the "AKS sizes base infrastructure only" scope. But your question about auto-enabling AKS when an IoT Operations / SQL MI preset is added was never turned into a work item. #103 files it with a concrete design (dependency banner, one-click enable, disable-protection warning).

### #88 → small cleanup in #104

#88 was a big rewrite and did excellent work on SOFS. Missed one user-visible leak: the MABS planner still shows `Storage Spaces mirror (#70)` at `MabsPage.tsx:105`. All other `(#NN)` occurrences in the repo are inside JSX/JS comments and are not user-visible, so they can stay as traceability.

## Healthy / no action needed

- **#97** (MABS volume layout research) — open, accurately captures R2. Prioritize when you're ready.
- **#90** (Docs deep-dive) — open, accurately captures R10.
- **#92** (AVD ↔ SOFS sync) — delivered exactly what R6/R7 asked for. The sync is bidirectional in the UI (AvdPlanner → syncToSofs button, and SofsPlanner shows an in-sync/out-of-sync badge when AVD targets SOFS).
- **#96** (AVD concurrent users clarification) — the AVD planner now explains up front that concurrent users drive sizing but total users drive profile storage, and has a burst-headroom warning when `concurrent < 70% × total`. Matches R1.
- **#81** (Service presets) — delivered a catalog + instance model. R11's auto-enable dependency piece is *not* this — that's why #103 is a separate feature.

## Process recommendation

When closing a research-type issue in future, before hitting close, ask: *did this research conclude with an implementation ask? If yes, file that as a separate issue and link back.* That would have caught #101, #102, and #103 at the time #95 and #89 closed.
