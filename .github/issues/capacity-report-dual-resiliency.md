## Summary

Under the **Planning Number** section of the Capacity Report (Hardware page), only the currently-selected default resiliency is shown. A user must change the Hardware page default resiliency to see effective usable capacity under a different mirror type. Both numbers should be visible at a glance.

## Current Behavior

The Planning Number section shows:

```
Default resiliency: Three-Way Mirror (33%)   |   33.3% efficiency
Effective usable (plan workloads against this)   |   12.34 TB
```

Only one resiliency type is displayed at a time.

## Desired Behavior

Show both Three-Way Mirror and Two-Way Mirror rows simultaneously in the Planning Number section:

```
Three-Way Mirror                |   33.3% efficiency
Two-Way Mirror                  |   50.0% efficiency
Effective usable — Three-Way    |   12.34 TB   (highlighted if this is the default)
Effective usable — Two-Way      |   18.51 TB
```

The row matching the currently-selected default resiliency should be visually highlighted (bold / brand color) so the user still knows which one drives the Workload Planner.

## Why

Users sizing workloads often want to compare both options simultaneously — for example, "do I have enough headroom if I use two-way mirror for a secondary data volume?" Currently this requires two round-trips through the Hardware page dropdown. Showing both side-by-side gives the user the full picture without changing settings.

## Implementation Notes

- Pure UI change in `src/components/CapacityReport.tsx` — no engine changes needed
- `Two-Way effective usable = availableForVolumesTB × 0.5`
- `Three-Way effective usable = availableForVolumesTB × 0.333`
- If the default is `dual-parity` or `nested-two-way`, still show Three-Way and Two-Way as the reference pair (those are the most common choices)
- Update the Glossary entry for **Effective Usable** to note that it varies by resiliency type

## Acceptance Criteria

- [ ] Both Three-Way Mirror (33%) and Two-Way Mirror (50%) rows appear under Planning Number
- [ ] Both Effective usable rows appear — one per resiliency type
- [ ] The row matching the hardware-page default is visually distinguished
- [ ] No engine/state changes required
