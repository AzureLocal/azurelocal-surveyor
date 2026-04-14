# Volumes

The volume planner converts logical planned sizes into two different numbers:

- **Calculator TB**: the logical size used by Surveyor for planning math.
- **WAC GB**: the floor-rounded value you actually type into Windows Admin Center or `New-Volume -Size`.

The conversion logic lives in `src/engine/volumes.ts`.

## Why Surveyor shows two sizes

Storage planning breaks if you use the logical planner number directly in Windows Admin Center. WAC expects a binary GB value and rounds internally. If you over-specify the size, volume creation can fail.

Surveyor handles that by converting this way:

```text
plannedSizeTB -> plannedSizeTB * 1024 -> floor() -> WAC GB
```

## Pool footprint vs logical size

Each volume consumes more pool capacity than its logical size depending on resiliency:

- Two-way mirror: logical size / 0.5
- Three-way mirror: logical size / 0.333...
- Dual parity: logical size / factor based on node count
- Nested two-way mirror: logical size / 0.25

That pool-footprint calculation is why volume totals can exceed effective usable capacity even when the sum of logical TB still looks reasonable.

## Guidance

- Use the **WAC GB** column when creating volumes.
- Keep individual volumes at or below **64 TB**.
- Prefer a volume count that is a multiple of node count for balanced slab distribution.
- Keep overall utilization below **70%** so S2D retains rebuild headroom.