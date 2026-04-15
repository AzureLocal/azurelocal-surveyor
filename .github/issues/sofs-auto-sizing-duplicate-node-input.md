## Summary

The **SOFS Guest Cluster Auto-Sizing** calculator (virtual drive sizer) has two UX problems:

1. It asks for a **duplicate "SOFS guest cluster nodes"** input that already exists as "SOFS guest VM count" in the Guest Cluster Configuration section above. Two separate state fields (`autoSizeNodes` and `sofsGuestVmCount`) hold the same conceptual value, causing user confusion.
2. The entire auto-sizing section is **buried below** IOPS estimates, resiliency compounding callouts, and the host volume layout recommendations — far from the Guest Cluster Configuration section it belongs to.

## The Confusion Explained

The SOFS planner has two sections:

**Section A — SOFS Guest Cluster Configuration** (higher up):
- SOFS guest VM count → `sofs.sofsGuestVmCount` (state field, used for sizing results, vCPU/RAM totals)

**Section B — SOFS Guest Cluster Auto-Sizing** (at the bottom):
- SOFS guest cluster nodes → `sofs.autoSizeNodes` (a SEPARATE state field, only used for virtual drive math)

Both default to `2`. The user sets the VM count in Section A, then scrolls to the bottom and sees what appears to be the same question asked again. There is no link or label explaining that these are different fields with different uses.

**Root cause:** `autoSizeNodes` was added independently and not wired to `sofsGuestVmCount`. They should be the same value.

## Desired Behavior

1. **Remove the duplicate node input from Auto-Sizing.** The calculator should read `sofsGuestVmCount` directly — no separate `autoSizeNodes` field needed. When the user changes "SOFS guest VM count" in the configuration section, the auto-sizing result updates automatically.

2. **Move the Auto-Sizing calculator into the Guest Cluster Configuration section**, immediately after the "SOFS guest VM count" and "Virtual drives per node" inputs. It is a direct output of those inputs and should be co-located.

3. **Remove `autoSizeNodes` from the Zustand store state** (or deprecate it silently — it can be left in the v9 migration as a no-op to avoid breaking persisted state). The `autoSizeDrivesPerNode` field stays as it is a genuine user input.

## Proposed Layout — SOFS Guest Cluster Configuration Section

```
Guest cluster data protection    [Three-Way Mirror ▼]
SOFS guest VM count              [2]
vCPUs / SOFS VM                  [4]
RAM / SOFS VM (GB)               [8]
OS disk per SOFS VM (GB)         [127]
Volume layout                    [Single shared volume ▼]
Virtual drives per node          [4]   ← keep this input

↓ Auto-sizing result (live, no extra node input needed):
┌──────────────────────────────────────────────────────┐
│ Required virtual drive size: 1.83 TB per virtual drive│
│ 4 drives × 2 nodes = 8 total virtual drives           │
│ to store 14.67 TB of guest-mirrored data on the CSV   │
└──────────────────────────────────────────────────────┘
```

## Why This Matters

- The current UX implies the user needs to "re-enter" the node count to unlock the calculator, which feels broken
- A user who sets `sofsGuestVmCount = 4` but forgets to update `autoSizeNodes` (still at 2) gets a wrong drive-size recommendation silently
- The section being at the bottom means most users never see it

## Implementation Notes

- `src/components/SofsPlanner.tsx`: Remove the `autoSizeNodes` field input from the Auto-Sizing section; replace all references to `sofs.autoSizeNodes` with `sofs.sofsGuestVmCount`; move the auto-sizing result card into the Guest Cluster Configuration section after the drives-per-node input
- `src/state/store.ts`: `autoSizeNodes` default and migration entry can remain (avoids breaking persisted state) but it will no longer be used in the UI or engine
- `src/engine/sofs.ts`: Check whether `autoSizeNodes` is used in `computeSofs()` — if so, replace with the `sofsGuestVmCount` parameter

## Acceptance Criteria

- [ ] No separate "SOFS guest cluster nodes" input exists in the Auto-Sizing section
- [ ] Auto-sizing result updates live when "SOFS guest VM count" changes
- [ ] Auto-sizing result card is displayed inside the Guest Cluster Configuration section
- [ ] Drive size calculation output is correct: `internalFootprintTB ÷ (sofsGuestVmCount × autoSizeDrivesPerNode)`
- [ ] No regression on existing SOFS engine tests
