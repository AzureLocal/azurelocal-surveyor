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
| Two-way mirror | 0.5 | 2 |
| Three-way mirror | 0.333... | 3 |
| Dual parity | 0.5 to 0.8 depending on node count | 4 |
| Nested two-way mirror | 0.25 | 2 |

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

The default efficiency factor in Surveyor is `0.92`, matching the current engine default in `src/engine/types.ts`.

## Calculator TB vs WAC GB

`effectiveUsableTB` is in **Calculator TB** (1 TB = 1,000,000,000,000 bytes in the Excel model).
When you create a volume in Windows Admin Center, you must enter **WAC GB** — the floor-to-nearest-GB conversion.

$$\text{WAC GB} = \lfloor \text{Calculator TB} \times 1000 \rfloor$$

This distinction is surfaced on every volume row and on the final export.
