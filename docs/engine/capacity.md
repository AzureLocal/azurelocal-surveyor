# Capacity Model

The capacity engine lives in [`src/engine/capacity.ts`](https://github.com/AzureLocal/azurelocal-surveyor/blob/main/src/engine/capacity.ts).

## Formula flow

```
Raw Pool TB
  └─ subtract reserve drives     (reserveDrives × driveCapacityTB)
       └─ apply efficiency factor (default 0.77)
            └─ apply resiliency   (2-way = ×0.5, 3-way = ×1/3, MAP = ×2/3)
                 └─ effectiveUsableTB
```

## Resiliency factors

| Mode | Factor | Min nodes |
|---|---|---|
| Two-way mirror | 0.5 | 2 |
| Three-way mirror | 0.333… | 3 |
| Mirror-accelerated parity (MAP) | 0.666… | 4 |

## Key outputs

| Field | Description |
|---|---|
| `rawPoolTB` | Total physical capacity before any deduction |
| `reservedTB` | Capacity held by reserve drives |
| `netPoolTB` | After reserve deduction |
| `resiliencyFactor` | Fraction of net pool that becomes usable storage |
| `effectiveUsableTB` | Final usable TB; feed into volume planner |

## Calculator TB vs WAC GB

`effectiveUsableTB` is in **Calculator TB** (1 TB = 1,000,000,000,000 bytes in the Excel model).
When you create a volume in Windows Admin Center, you must enter **WAC GB** — the floor-to-nearest-GB conversion.

$$\text{WAC GB} = \lfloor \text{Calculator TB} \times 1000 \rfloor$$

This distinction is surfaced on every volume row and on the final export.
