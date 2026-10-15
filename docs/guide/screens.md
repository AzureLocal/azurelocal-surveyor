# Screen guide

What each screen answers, what it needs, and what it does not claim. Every screen plans against **Azure Local 12.2609 (latest)**; the Microsoft Learn facts behind the rules are listed on the in-app References page with the date each was last checked.

## Fit and Recommendations

Question: does my combined workload demand fit this hardware, and how many same-spec nodes would it take?

- **Inputs:** hardware, every enabled workload source (individual VM inventory, quick VM groups, specialized services), the volume layout, and the **maintenance reserve** (none, N+1, N+2).
- **Reads:** vCPU, memory and storage-pool footprint against what the hardware provides, and a node-count comparison for 1 to 16 nodes (2, 4, 6 and 8 for rack aware).
- **N+1 and N+2** are planning choices, not platform limits. N+1 keeps compute for the largest single failure (one node down). N+2 covers one node in maintenance while another fails. They reduce CPU and memory only; storage keeps the per-drive rebuild reserve instead.
- **Single node:** the page reports that N+1 cannot be met and why.
- **Rack aware:** also shows whether the surviving zone can run the full demand if one rack fails.
- **Not claimed:** per-VM placement, storage performance, networking or hardware support. A VM larger than one host is reported separately because more nodes cannot fix it.
- **Built vs sized** (linked from the page) compares the same demand with hardware that was actually built. See [As-built comparison](./as-built-fit.md).

## Recommendations (Hardware options)

Question: which reviewed OEM planning configurations could carry this demand?

- **Inputs:** minimum and maximum node count (1 to 16), additional headroom percentage, optional vendor filter.
- **Reads:** each reviewed preset is evaluated with the same fit engine. A preset is listed only when CPU, memory and storage footprint meet the demand plus your headroom.
- **Sorting:** fewest nodes, then cores, memory and raw storage. It is not a price ranking.
- **Not claimed:** presets are editable examples with a source and review date, not certified bills of materials. Confirm in the Azure Local catalog. A preset with cache drives is never offered for a single node because the cache is unsupported there.

## Thin provisioning

Question: what are the risks of thin volumes on Azure Local, and how do I monitor them?

- A reference page: pool exhaustion behaviour, monitoring commands and a deployment checklist. It does not change your numbers.
- In the planner, thin volumes are still **checked at full planned consumption** for fit, because over-committing removes the free space that repair needs.

## References

Question: where does each rule come from?

- **Platform facts** table: every Azure Local rule the engine encodes, its Microsoft Learn link and the date it was verified.
- **Planning assumptions** list: defaults Surveyor chose that are not Microsoft requirements (8 GB host memory reserve, 4 host vCPUs, oversubscription ratio, N+1/N+2, 1% pool metadata, infrastructure volume size, the all-flash cache-ratio guidance).
- Then the catalogue of Learn pages for storage, compute, AVD, AKS and backup planning.

## About

- The version, release history and what is included. The sidebar badge and every report show the planning basis, **Azure Local 12.2609 (latest)**.

## Projects (Open and Compare)

- **Download project** saves the active area (storage or workload) as a `.surveyor.json` file; **Open or compare** previews a file against the current plan before restoring it. Plan manifests from Export JSON also open here.
- Files are described by [JSON Schemas](../reference/plan-manifest.md#json-schemas). Browser storage is not a backup; see [privacy and data](../reference/privacy-and-data.md).

## Single node and rack aware plans

Read [Single node and rack aware clusters](./single-node-and-rack-aware.md) for what the hardware page enforces.
