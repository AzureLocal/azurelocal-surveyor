# Research: ReFS Deduplication and Compression — Capacity Planning Impact

**Milestone:** v2.1.0  
**Priority:** P1 — Research  
**Estimate:** M  
**Labels:** research, capacity-engine, enhancement

---

## Context

Azure Local S2D pools host ReFS-formatted CSVs. ReFS supports two storage-efficiency features that can
meaningfully change the amount of usable space a given disk pool provides:

| Feature | Description |
|---|---|
| **ReFS Deduplication** ("ReFS Dedup") | Block-level deduplication on ReFS volumes (available in Windows Server 2022+ and Azure Local 22H2+). Eliminates duplicate blocks without requiring offline processing. |
| **ReFS Compression** | Transparent per-block LZ4 compression on ReFS volumes (available in Azure Local 23H2+). Applied at write time; no offline pass needed. |

Both features are **opt-in per volume** and only apply to specific workloads. Neither is accounted for
in the current Surveyor capacity model — all sizing assumes raw block consumption with no data-reduction.

If the user enables dedup or compression on one or more volumes, the effective usable capacity they
can deliver from a fixed pool size is higher than Surveyor currently suggests. Ignoring this leads to
conservative (over-engineered) designs.

---

## Research Questions

### 1. What workloads benefit from ReFS Dedup?

- VDI / AVD session host OS disks — high duplication between golden-image clones
- SOFS profile containers (FSLogix VHDXs) — file-level patterns within containers
- Windows software repositories or WSUS data
- What are Microsoft's official guidance ratios for each workload type?
- Does dedup interact safely with S2D mirroring (tiered pools, NVMe + HDD)?

### 2. What workloads benefit from ReFS Compression?

- General-purpose VMs with typical workload data
- MABS backup data volumes — backup streams often compress well
- AKS PVC volumes with text/log/JSON-heavy workloads
- What compression ratios are realistic for each? Microsoft quotes 2:1 for typical workloads.

### 3. Are there workloads where dedup / compression should NOT be used?

- Already-compressed data (databases with native page compression, encrypted volumes, video/images)
- Latency-sensitive volumes where CPU overhead matters (SQL OLTP, high-IOPS AKS PVCs)

### 4. Capacity planning model implications

- If dedup + compression are enabled, the pool storage requirement for a given logical volume size
  shrinks by a savings ratio (e.g. 1.5:1 dedup, 2:1 compression, 2.5:1 combined).
- How should Surveyor expose this? Options:
  - **Option A — Per-volume savings ratio field:** Add optional `estimatedSavingsRatio?: number` to
    `VolumeSpec`. Surveyor uses it to adjust the pool footprint calculation for that volume only.
  - **Option B — Per-workload toggle:** Add dedup/compression enabled toggles to each workload
    planner (AVD, SOFS, MABS, VMs) and apply a workload-appropriate default ratio.
  - **Option C — Advanced Settings global override:** Add a global `dataReductionRatio` to Advanced
    Settings, applied to all volumes when set. Simpler but less accurate.
- Which option fits best with Surveyor's per-volume architecture introduced in v2.0?

### 5. Health Check implications

- Should Surveyor warn when dedup/compression are enabled on volumes with workloads that are unlikely
  to benefit (e.g. large video/image stores, encrypted databases)?
- Should there be a new HC code `HC_DEDUP_UNSUPPORTED_WORKLOAD` or similar?

### 6. Quick Start Reference implications

- Should the reference rows show both a "no savings" and an "estimated savings" column?
- Or is this purely an advanced/optional annotation?

### 7. Platform requirements

- Dedup: what minimum Azure Local build / Windows Server version is required?
- Compression: Azure Local 23H2+ only — how do we surface this requirement?

---

## Acceptance Criteria (for a follow-on implementation issue)

This is a **research issue**. Deliverables are:

- [ ] Summary document in `docs/research/refs-dedup-compression.md` covering:
  - Per-workload dedup savings ratios (cited from Microsoft documentation)
  - Per-workload compression savings ratios (cited from Microsoft documentation)
  - Workloads where dedup/compression should be avoided
  - Platform version requirements
  - Recommended capacity planning approach (which option above)
- [ ] Identified API / engine changes required in `src/engine/` (VolumeSpec, capacity.ts, healthcheck.ts)
- [ ] Decision recorded: which model option (A, B, or C) to implement
- [ ] A follow-on implementation issue created and linked here

---

## References

- [ReFS deduplication on Azure Local — Microsoft Learn](https://learn.microsoft.com/windows-server/storage/refs/refs-deduplication)
- [ReFS compression — Microsoft Learn](https://learn.microsoft.com/windows-server/storage/refs/refs-compression)
- [Storage Spaces Direct capacity planning — Microsoft Learn](https://learn.microsoft.com/windows-server/storage/storage-spaces/plan-volumes)
- Azure Local sizing guides (session host planning, MABS sizing)
