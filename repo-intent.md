# Repo intent — azurelocal-surveyor

**Azure Local S2D capacity planning and workload sizing — a TypeScript port of the Excel-based S2D_Capacity_Calculator.xlsx, extended for Azure Local 12.2609.**

## What this repo is

A pre-deployment capacity planning tool for hyperconverged Azure Local (1 to 16 nodes, including single node and rack aware clusters). **Live app:** https://azurelocal.cloud/azurelocal-surveyor/

Two planning areas share one engine: **Storage Sizing** (hardware, resiliency, volumes, no workloads needed) and **Workload Planning** (VM inventory, AVD, AKS, SOFS, MABS, fit and OEM configuration options, built-vs-sized comparison). Every platform rule in `src/engine` is recorded with its Microsoft Learn source and verification date in `src/engine/facts.ts`.

It is a static, in-browser tool: no backend, no network calls, no stored credentials.

## How it relates to other repos

- **`azurelocal-s2d-cartographer`** — verifies what was actually built *after* deployment; this repo plans capacity *before* deployment. The two are explicitly designed as a before/after pair.
- **Plan and project JSON** (versioned schemas in `docs/reference`) are consumed by downstream design tools; keep the documented import contract (schemaVersion 1) stable.

## Status

Active. Current release: see `package.json` and `CHANGELOG.md`.
