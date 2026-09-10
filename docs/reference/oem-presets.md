# OEM planning presets

Reviewed **10 September 2026**. The Hardware page contains 21 editable examples
across the four existing vendors. This is a curated sizing library, not a complete
mirror of the Microsoft catalog or a list of orderable configurations.

The CPU, RAM and drive quantities are Surveyor planning assumptions within the
documented platform options. They are not OEM default configurations or certified
bills of materials. Solution tiers describe the vendor offering. Confirm the exact
parts, firmware, networking and support package with the OEM and the
[Microsoft Azure Local Solutions Catalog](https://azurelocalsolutions.azure.microsoft.com/#/catalog).

Selecting a preset fills physical cores, RAM, capacity drives and cache drives per
node. Node count and other planning settings stay unchanged. Boot devices are
excluded from capacity. A reference panel shows the original example, source and
review date; editing the sizing fields displays a customization notice. These
examples use local S2D storage within Surveyor's existing 2–16 node model. GPU,
single-node and external SAN sizing require separate assessment.

| Vendor | Included models | Reference |
| --- | --- | --- |
| Dell Technologies | AX-670, AX-770, AX-660, AX-760 (NVMe and hybrid), AX-4510c, AX-4520c | [AX specification sheet](https://www.delltechnologies.com/asset/en-sg/products/converged-infrastructure/technical-support/ax-for-azure-local-spec-sheet.pdf) |
| HPE | DL380 Gen12, DL360 Gen12, DL380 Gen11, DL145 Gen11 | [Azure Local QuickSpecs](https://www.hpe.com/us/en/collaterals/collateral.a50007018enw.html) |
| Lenovo | MX630 V4, MX650 V4, MX650a V4, MX455 V3 Edge, MX630 V3, MX650 V3 (Premier, Integrated NVMe, Integrated hybrid) | [MX product guides](https://lenovopress.lenovo.com/servers/thinkagile/mx-series); each preset links to its specific guide |
| DataON | AZL-8208i, AZS-7224 | [AZL-8208i](https://dataon.io/product/dataon-azl-8208i-premier-solution-for-azure-local/), [AZS-7224](https://dataon.io/product/dataon-azs-7224-integrated-system-for-azure-stack-hci/) |

## Corrections in this review

- Dell AX-670/770 use Xeon 6; the former 16G/PowerEdge R660/R760 descriptions
  were wrong. AX-770 is 2U. Edge models use the vendor's `c` suffix and size each sled.
- HPE DL145 Gen11 is now Premier; Gen12 models were missing. Removed the DL380
  Gen11 HDD example because the current Azure Local QuickSpecs list flash options.
- Lenovo MX650 V3 Premier is a distinct offering from the Integrated System;
  the hybrid example remains associated with Integrated. Added the GPU-focused
  MX650a V4 and MX455 V3 Edge.
- Removed unverified DataON AZS-7248 and AZS-7224 hybrid examples. Corrected
  AZS-7224 memory to 512 GB and added the current AZL-8208i Premier offering.

## Maintaining the list

Review the OEM's Azure Local solution documentation, not only the generic server
specification. Sources sometimes contain inconsistent tables: the HPE DL380 Gen12
CPU row still mentions older Xeon generations, and the DataON AZS-7212 page labels
its specification table AZS-7112. Neither ambiguity is used to add new claims here.
Microsoft's catalog requires client-side rendering; this review uses the linked
primary OEM documentation for model and tier evidence and does not claim a
complete live catalog audit.

Each preset requires `sourceUrl`, `sourceTitle` and a manual `reviewedAt` date.
Change the date only after reviewing its source. Saved projects store hardware
values, not preset identifiers, so catalog refreshes do not overwrite saved plans.
GitHub Actions checks selection of every preset before and after publication.
