# Capacity Model

The capacity engine lives in [`src/engine/capacity.ts`](https://github.com/AzureLocal/azurelocal-surveyor/blob/main/src/engine/capacity.ts).

## Formula flow

```
Raw Pool TB
  └─ apply per-drive efficiency   (driveSizeTB × 0.92 by default)
       └─ subtract reserve drives (min(nodeCount, 4) × usablePerDriveTB)
            └─ subtract infra CSV footprint
                 └─ apply resiliency factor
                      └─ effectiveUsableTB
```

## Resiliency factors

| Mode | Factor | Min nodes |
|---|---|---|
| Two-way mirror | 0.5 | 1 (the only option on a single node) |
| Three-way mirror | 0.333... | 3 |
| Dual parity | 0.5 to 0.8 all-flash, 0.5 to 0.727 with HDD capacity, by node count | 4 |
| Nested two-way mirror | 0.25 | 2 |
| Four-way mirror | 0.25 | 4, rack aware clusters only (2+2 to 4+4) |

A rack aware 1+1 cluster uses two-way mirror. See [single node and rack aware clusters](../guide/single-node-and-rack-aware.md) for the rules and worked numbers, and the in-app References page for the Learn source of each.

## Key outputs

| Field | Description |
|---|---|
| `rawPoolTB` | Total physical capacity before any deduction |
| `usablePerDriveTB` | Per-drive usable capacity after the efficiency factor |
| `reserveTB` | Capacity held back by reserve drives |
| `infraVolumeTB` | Pool footprint of the cluster infrastructure volume |
| `availableForVolumesTB` | Pool space available for user volumes before resiliency |
| `netPoolTB` | After reserve deduction |
| `resiliencyFactor` | Fraction of available pool that becomes usable storage |
| `effectiveUsableTB` | Final usable TB; feed into volume planner |

There is no blended efficiency factor: the old `0.92` constant was removed in 2.4.1. Raw drive bytes go through the pipeline above and the TB to TiB conversion happens once, at display.

## Calculator TB vs WAC GB

`effectiveUsableTB` is in **Calculator TB** (1 TB = 1,000,000,000,000 bytes in the Excel model).
When you create a volume in Windows Admin Center, you must enter **WAC GB** — the floor-to-nearest-GB conversion.

$$\text{WAC GB} = \lfloor \text{Calculator TB} \times 1000 \rfloor$$

This distinction is surfaced on every volume row and on the final export.
