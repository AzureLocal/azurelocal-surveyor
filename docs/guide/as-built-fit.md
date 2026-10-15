# As-built comparison (built vs sized)

Surveyor sizes demand and proposes hardware. After the hardware is racked you can check what was built against that demand: open **Fit and Recommendations**, then **Compare with as-built hardware**.

## What you paste

A small JSON record. It is read in the browser, compared and shown; it is not saved into the project and nothing is uploaded.

```json
{
  "kind": "azurelocal-surveyor-asbuilt",
  "schemaVersion": 1,
  "source": "typed from the build sheet",
  "capturedAt": "2026-10-15",
  "hardware": {
    "nodeCount": 4,
    "coresPerNode": 32,
    "memoryPerNodeGB": 512,
    "capacityDrivesPerNode": 8,
    "capacityDriveSizeTB": 3.84,
    "capacityMediaType": "nvme",
    "cacheDrivesPerNode": 0,
    "cacheDriveSizeTB": 0,
    "cacheMediaType": "none",
    "hyperthreadingEnabled": true
  }
}
```

Other shapes are accepted: a bare hardware object, a saved Surveyor project, or a plan manifest (its `inputs.hardware` is used). Unknown keys are ignored, so a manifest produced by other tooling can be pasted if it carries these hardware fields. `rackAware: true` marks a rack aware build. **Insert the planned hardware as a template** fills the box from the current plan so you only edit what differs.

Values are validated: 1 to 16 nodes, positive cores, memory and drive sizes, at least one capacity drive.

## What you get

| Column | Meaning |
| --- | --- |
| Sized demand | vCPU, memory and storage pool footprint from the plan |
| Planned hardware | capacity of the hardware in the plan |
| Built hardware | capacity of the as-built record, using the plan's reserves and oversubscription |
| Built, one node down | the same with N+1 applied (compute only; storage is unchanged) |
| Built headroom | (built capacity minus demand) divided by built capacity |

The verdict is one of: fits with N+1, fits without N+1, does not fit, or no demand. It reuses the same engine as the Fit page, so the same reserves, volume layout and resiliency rules apply (single node, rack aware and hybrid dual parity included).

## Limits

An aggregate estimate. It does not place individual VMs, test networking or measure performance, and it trusts the numbers you typed.
