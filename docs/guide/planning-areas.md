# Storage Sizing and Workload Planning

Surveyor v2.8.0 provides two independent planning areas. Pick the area that matches the decision you need to make. The main navigation always lets you switch between them.

## Size storage without workloads

1. Open **Storage Sizing**, then **Hardware & Drives**. Enter nodes and drives manually or select an OEM planning example. Adjust its fields to match your configuration.
2. Open **Capacity & Resiliency**. Review raw capacity, deductions and usable capacity. The comparison resiliency also supplies the default for new suggestions; existing volumes retain their own resiliency.
3. Use **Volume Planning** to add volumes, select resiliency and provisioning per volume, and review the resulting pool footprint. **Compare Drive Layouts** explores drive alternatives.
4. Open **Storage Report** for capacity and volume checks. Export PDF, XLSX, Markdown or project JSON, or copy the volume creation PowerShell script.

Storage reports contain no workload demand. They remain usable without entering any VMs. Changing a workload project does not alter this storage project.

## Find hardware for workloads

1. Open **Workload Planning → Size from workloads**.
2. Add individual VMs or import an RVTools workbook or vInfo CSV. Review the preview, inclusion flags and tiers. Powered-off VMs stay included until you exclude them.
3. Add quick VM groups or services under **Specialized Workloads**. Detailed planners cover virtual desktops (AVD), Kubernetes (AKS), file services (SOFS) and backup servers (MABS). Enable a workload to count it in combined demand. Enter each workload once: inventory and specialized groups are additive.
4. Select **Find hardware options**. Filter reviewed OEM examples by vendor and node range, and specify additional headroom. Each matching option shows per-node CPU, RAM, drives and remaining resources.
5. Select an option to apply its hardware, then review **Fit & Recommendations**, **Storage Design**, and **Reports & Exports**.

Options are ordered by fewest nodes, then total physical cores, RAM and raw storage. They are not ranked by price. Surveyor compares documented example configurations; confirm the final supported bill of materials with the OEM. A missing result means no reviewed example meets the current constraints. Custom hardware can still be entered on **Hardware**.

## Assess existing hardware

1. Open **Workload Planning → Assess existing hardware** and enter installed nodes, CPU, RAM and drives.
2. Add or import the workloads you run or propose to run.
3. Review **Fit & Recommendations** for CPU, memory and storage requirements, deficits, maintenance reserve and same-spec node comparisons.
4. Use the additional VM profile to estimate how many more similar VMs aggregate headroom can accommodate. The smallest remaining CPU, RAM or storage allowance controls the answer. This does not add VMs to the inventory.
5. Review the storage design and export the resulting plan.

An inventory VM whose selected memory demand exceeds one host's usable RAM fails the fit check. Adding more equally sized hosts cannot resolve that individual VM's requirement. Aggregate fit still does not validate VM placement, storage performance, networking or hardware support.

## Understand sizing assumptions

Allocation is the default inventory sizing basis. Optional P95 measurements use the configured comfort factor and independent allocation fallback when CPU or memory evidence is missing. Measured sizing assumes the proposed right-sizing will actually be applied. Inventory growth is included before the additional hardware-option headroom percentage.

Consumed-storage sizing assumes thin provisioning or reclamation; it does not reserve the full provisioned gap. Fit checks compare workload volume suggestions and the edited volume layout separately and use the larger pool footprint. Maintenance reserve reduces available compute; storage overhead and rebuild reserves remain part of the capacity model. Surveyor models 2–16 nodes; this is the calculator's scope, not a universal platform limit.

Use **Planning assumptions** in the project header to review reserves and other calculation inputs. Changes affect only the active area.

## Save, compare and transfer projects

The project name, **Save project**, and **Open / Compare** controls are available throughout each planning area. Downloads preserve the inputs; browser persistence alone is not a backup. Opening a file shows a comparison before **Restore this project** replaces the active area's inputs.

Each project file identifies its planning area. Open a storage project in Storage Sizing and a workload project in Workload Planning. Existing browser plans, older project files without an area tag, and legacy plan manifests remain available in Workload Planning.

To transfer a design, use **Review copy** on the hardware or volume page:

- From Storage Sizing, copy hardware into the workload project. Its workloads and volume design are preserved.
- From Workload Planning, copy hardware, assumptions and volumes into the storage project. Workload demand is excluded.

The review identifies the destination inputs that will be replaced. Save the destination project first if you want to keep that design. Cancel leaves both projects unchanged; copying leaves the source intact.

## Find help

**Help & Reference** links to this documentation, calculation references, OEM sources and release information. The sidebar also links directly to **Hyper-V Surveyor** for Windows Server planning.
