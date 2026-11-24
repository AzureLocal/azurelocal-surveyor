# Sizing Handoff

**Sizing handoff for Trailwright** on the Reports page downloads `azure-local-sizing-handoff-YYYY-MM-DD.json`: the sized cluster, and nothing else, for a design tool. [Azure Local Trailwright](https://azurelocal.cloud/azurelocal-trailwright/) imports it on **Review and export**, **Import**, and starts the design from it: the number of machines, single rack or rack aware, cores and memory per machine, the drives per machine and the volumes.

The plan manifest (**Export JSON**, see [Plan Manifest](plan-manifest.md)) stays the full record for Ranger and other automation. The handoff is smaller and uses the key names of the Azure Local Toolkit `infrastructure.yml` (schema 5), so a consumer does not have to translate Surveyor's own names.

## Contract

| Field | Meaning |
| --- | --- |
| `kind` | Always `azurelocal-sizing-handoff` |
| `schemaVersion` | `"1.1"`. Consumers check the major number only; a new optional field is a minor bump, a removed or changed field a major bump. 1.1 added `storage.volumes[].provisioning_type` |
| `generatedBy`, `surveyorVersion`, `generatedAt` | Who wrote the file and when |
| `targetRelease` | The Azure Local release the plan was checked against, for example `Azure Local 12.2611` |
| `plan.name`, `plan.purpose` | The plan name, and `buy` (sizing new hardware) or `existing` |
| `cluster.node_count` | Machines in the instance, 1 to 16 |
| `cluster.topology` | `standard` or `rack_aware` (two local zones with `node_count / 2` machines each) |
| `hardware.cpu_cores`, `hardware.memory_gib` | Per machine: physical cores and memory (infrastructure.yml `hardware.cpu_cores`, `hardware.memory_gib`) |
| `hardware.hyperthreading` | Whether the sizing counted two logical processors per core |
| `hardware.drives.capacity`, `hardware.drives.cache` | Per machine: `media` (`nvme`, `ssd`, `hdd`), `count`, `size_tb` (infrastructure.yml `hardware.drives`). `cache` is absent without a cache tier |
| `storage.default_resiliency` | The resiliency the capacity was computed with, in the schema 5 spelling |
| `storage.infrastructure_volume_tb` | The infrastructure volume the sizing set aside |
| `storage.volumes[]` | `name`, `size_gib` (the planned size, decimal TB, in GiB rounded down: the size to give `New-Volume`), `resiliency` and `provisioning_type` (`fixed` or `thin`). `provisioning` carries the same value for 1.0 readers and is removed in 2.0 |
| `sizing.*` | The results the plan was judged on, frozen at export: raw pool, effective usable capacity, volume footprint and utilization, usable vCPUs and memory (also with one machine down), the workload totals, and the health check (passed, error and warning counts, and the issues) |

Resiliency values: `two_way`, `three_way`, `four_way` (rack aware only), `parity` (Surveyor's dual parity) and `nested_two_way`.

The JSON schema is [`sizing-handoff.schema.json`](sizing-handoff.schema.json) and an example is [`sizing-handoff.example.json`](sizing-handoff.example.json). A unit test (`src/exporters/sizing-handoff.test.ts`) checks that Surveyor's output follows the schema and that the example is what Surveyor writes today; Trailwright tests its import against a copy of the example.

## What it does not carry

Names, addresses, network ports, identity and Azure details are not part of sizing; Trailwright asks for them. Workload detail (virtual machines, AVD, AKS, inventory) stays in the plan manifest; the handoff carries only its totals.
