# Single node and rack aware clusters

Surveyor models hyperconverged Azure Local: **1 to 16 machines** (8 when rack aware). Disaggregated deployments on an external SAN scale to 64 machines and are **out of scope**; the hardware page says so. Sources are in the in-app References page (facts registry, `src/engine/facts.ts`), checked 2026-10-15 against Azure Local 12.2609.

## Single node

| Topic | What Surveyor enforces |
| --- | --- |
| Resiliency | Two-way mirror only (copies across drives). Three-way, parity and nested are unavailable. |
| Cache | Not supported. Cache media is forced to none; cache drives are an error. |
| Drives | One flash type (NVMe or SSD), at least 2 capacity drives. HDD is an error. |
| Reserve | `min(1, 4) x drive size`: one drive. |
| Availability | Warning: no live-migration target, no N+1, and updates that restart the host interrupt every workload. N+1 or N+2 leaves no workload node and is reported on the Fit page. |

Worked example: 1 node, 4 x 3.84 TB. Raw 15.36 TB; pool 15.36 x 0.99 = 15.2064; reserve 3.84; infrastructure volume 0.25 / 0.5 = 0.5 footprint; available 15.2064 - 3.84 - 0.5 = 10.8664 TB; usable at 50% = 5.4332 TB.

## Rack aware clusters

Turn on **Rack aware cluster** on the hardware page. The node count is split into two equal zones.

| Zones | Nodes | Volumes | Efficiency | Fault tolerance (Learn) |
| --- | --- | --- | --- | --- |
| 1+1 | 2 | Two-way mirror | 50% | One fault: drive, node or rack |
| 2+2, 3+3, 4+4 | 4, 6, 8 | Four-way mirror (rack level nested mirror) | 25% | Three drive or node faults; after a rack failure the survivor tolerates one more |

Rules enforced: node count 2, 4, 6 or 8; all-flash data drives; no three-way mirror, parity or nested volumes. Prerequisites shown as an information note: new deployments only (no conversion), **Active Directory identity only**, a cloud witness, a dedicated storage network, round-trip latency of 1 ms or less, and a 1+1 cluster cannot be expanded in this release.

Worked example (2+2): 4 nodes x 8 x 3.84 TB. Raw 122.88; pool 121.6512; reserve `min(4, 4) x 3.84` = 15.36; infrastructure 0.25 / 0.25 = 1; available 105.2912 TB; usable at 25% = 26.3228 TB.

Assumption to know: Learn does not publish a rack-aware-specific reserve, so Surveyor applies the standard rule (one drive per machine up to 4). The Fit page also checks whether **one zone alone** has the CPU and memory for the full demand.

## Dual parity efficiency

Learn publishes two tables and Surveyor uses the one that matches the capacity media.

| Nodes | All-flash | Hybrid (HDD capacity) |
| --- | --- | --- |
| 4 to 6 | 50% | 50% |
| 7 to 8 | 66.7% | 66.7% |
| 9 to 11 | 75% | 66.7% |
| 12 to 15 | 75% | 72.7% |
| 16 | 80% | 72.7% |

## Drive and cache rules

- At least 2 capacity drives per node (each 500 GB or more).
- A cache tier needs at least 2 cache drives and 4 capacity drives per node.
- Hybrid (HDD): cache of 32 GB or more per device, cache at least 15% of capacity, capacity drives a whole multiple of cache drives. All-HDD without cache is not supported.
- All-flash with a cache tier warns below about 5% cache (guidance, not a requirement).
