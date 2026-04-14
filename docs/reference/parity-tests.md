# Parity Tests

Golden-scenario tests validate that each TypeScript engine module produces the same results as the Excel workbook reference (`S2D_Capacity_Calculator.xlsx`).

Run all parity tests with `npm test`.

## Tolerance

Storage comparisons use a tolerance of **±0.02 TB** for all modules.

---

## Capacity parity — 20 scenarios

File: `src/engine/__tests__/capacity.parity.test.ts`

Tests `computeCapacity()` in `src/engine/capacity.ts`. Covers raw pool, resiliency factor, efficiency factor, reserve volumes, and effective usable TB across all four resiliency types and a range of node + drive configurations.

| # | Nodes | Drives/node | Cap (TB) | Resiliency | Reserve | Expected (TB) |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | 2 | 4 | 4.0 | 2-way | 0 | 12.32 |
| 02 | 4 | 6 | 8.0 | 2-way | 0 | 73.92 |
| 03 | 4 | 8 | 10.0 | 3-way | 1 | 65.87 |
| 04 | 6 | 8 | 10.0 | 3-way | 0 | 123.20 |
| 05 | 8 | 10 | 10.0 | 2-way | 2 | 246.40 |
| 06 | 8 | 12 | 12.0 | MAP | 0 | 443.52 |
| 07 | 16 | 24 | 3.84 | 2-way | 4 | 1,053.27 |
| 08 | 4 | 4 | 2.0 | 2-way | 0 | 12.32 |
| 09 | 6 | 6 | 2.0 | 3-way | 0 | 18.48 |
| 10 | 8 | 8 | 4.0 | MAP | 0 | 98.56 |
| 11 | 4 | 6 | 4.0 | 3-way | 1 | 29.33 |
| 12 | 2 | 8 | 8.0 | 2-way | 0 | 49.28 |
| 13 | 4 | 12 | 6.0 | MAP | 0 | 110.88 |
| 14 | 6 | 10 | 12.0 | 3-way | 2 | 109.73 |
| 15 | 8 | 16 | 4.0 | 2-way | 0 | 197.12 |
| 16 | 16 | 8 | 2.0 | 3-way | 0 | 131.07 |
| 17 | 4 | 6 | 6.0 | 2-way | 0 | 55.44 |
| 18 | 2 | 4 | 4.0 | 2-way | 0 | 12.32 |
| 19 | 4 | 8 | 8.0 | MAP | 1 | 73.52 |
| 20 | 8 | 12 | 8.0 | 3-way | 0 | 164.57 |

---

## AVD parity — 12 scenarios

File: `src/engine/__tests__/avd.parity.test.ts`

Tests `computeAvd()` in `src/engine/avd.ts`. Covers session host density and count, vCPU and memory totals, profile storage sizing, user type mix weighted average, growth buffer, Office Container, data disk per host, concurrent vs total user sizing split, `avdSessionHostsNeeded` override, and single-session VDI mode.

| # | Workload | Users | Concurrent | Notes |
| --- | --- | --- | --- | --- |
| 01 | light | 100 | — | sessionHostCount=7, vCPUs=14, profile=3.91 TB |
| 02 | light | 1,000 | 200 | host sizing from concurrent; profile from totalUsers |
| 03 | medium | 500 | — | sessionHostCount=63, vCPUs=252 |
| 04 | medium | 500 | — | user type mix 30/50/20 → effectiveProfileSizeGB=41 |
| 05 | heavy | 200 | — | sessionHostCount=50, vCPUs=400 |
| 06 | power | 50 | — | sessionHostCount=25, OS disk=6.25 TB |
| 07 | medium | 100 | — | single-session VDI: usersPerHost=1, hosts=100 |
| 08 | medium | 100 | — | 20% growth buffer → profile=4.69 TB |
| 09 | medium | 100 | — | Office Container 20 GB enabled |
| 10 | medium | 100 | — | avdSessionHostsNeeded override = 20 |
| 11 | medium | 100 | — | 100 GB data disk per host |
| 12 | medium | 100 | 0 | concurrentUsers=0 falls back to totalUsers |

---

## SOFS parity — 8 scenarios

File: `src/engine/__tests__/sofs.parity.test.ts`

Tests `computeSofs()` in `src/engine/sofs.ts`. Covers profile demand sizing, internal mirror compounding (1×/2×/3×), `sofsProfileDemandTb` override, IOPS with concurrent users vs fallback to userCount, auto-size drive calculation, and redirected folder storage additive to total.

| # | Users | Mirror | Notes |
| --- | --- | --- | --- |
| 01 | 500 | three-way | profile=19.53 TB, footprint=58.59 TB |
| 02 | 500 | two-way | footprint=39.06 TB |
| 03 | 500 | simple | footprint = totalStorage (factor=1) |
| 04 | 500 | three-way | sofsProfileDemandTb override=10 TB → footprint=30 TB |
| 05 | 500 | three-way | 200 concurrent users → steadyStateIops=2000, stormIops=10000 |
| 06 | 500 | three-way | concurrentUsers=0 → fallback to userCount → steadyStateIops=5000 |
| 07 | 500 | three-way | auto-size: 4 drives/node × 2 nodes → required drive size=7.32 TB |
| 08 | 500 | three-way | 5 GB redirected folders → totalStorage=21.97 TB, footprint=65.92 TB |

---

## Compute parity — 6 scenarios

File: `src/engine/__tests__/compute.parity.test.ts`

Tests `computeCompute()` in `src/engine/compute.ts`. Covers hyperthreading enabled vs disabled (logical vCPU doubling), N+1 one-node-loss model, system reserved RAM per-node scaling, NUMA domain estimate, and vCPU oversubscription ratio.

| # | Nodes | Cores/node | HT | Notes |
| --- | --- | --- | --- | --- |
| 01 | 4 | 16 | yes | logicalCores=128, usableVCpus=496 |
| 02 | 4 | 16 | no | logicalCores=64, usableVCpus=240 (half) |
| 03 | 4 | 16 | yes | N+1: usableVCpusN1=372, usableMemoryGBN1=744 |
| 04 | 4 | 16 | yes | systemReservedMemoryGB=32 → usableMemoryGB=896 |
| 05 | 6 | 16 | yes | numaDomainsEstimate=12 |
| 06 | 4 | 16 | yes | ratio=8 → usableVCpus=1008, usableVCpusN1=756 |
