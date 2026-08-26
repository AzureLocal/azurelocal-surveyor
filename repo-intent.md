# Repo intent — azurelocal-surveyor

**Azure Local S2D capacity planning and workload sizing — a TypeScript port of the Excel-based S2D_Capacity_Calculator.xlsx.**

## What this repo is

A pre-deployment capacity planning tool. **Live app:** surveyor.azurelocal.cloud.
v2.0 is a comprehensive quality overhaul delivering multi-workload planning
end-to-end: AKS multi-cluster planning (independent clusters, each with its own
OS-disk/PVC volumes), VM storage groups, SOFS volume layout (`shared` vs
`per-vm`), and per-volume resiliency typing.

## How it relates to other repos

- **`azurelocal-s2d-cartographer`** — verifies what was actually built *after*
  deployment; this repo plans capacity *before* deployment. The two are
  explicitly designed as a before/after pair.

## Status

Active, v2.0 released.
