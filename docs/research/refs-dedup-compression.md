# ReFS Deduplication and Compression — Capacity Planning Impact

**Status:** Research complete — follow-on implementation issue pending  
**Milestone:** v2.1.0  
**Related issue:** [#141](https://github.com/AzureLocal/azurelocal-surveyor/issues/141)

---

## Background

Azure Local S2D pools host ReFS-formatted CSVs. ReFS supports two storage-efficiency features that can meaningfully change the amount of usable space a given disk pool provides:

| Feature | Description | Availability |
|---|---|---|
| ReFS Deduplication ("ReFS Dedup") | Block-level deduplication on ReFS volumes. Eliminates duplicate blocks across files — most effective where many files share common data (e.g. VDI golden-image clones). | Windows Server 2019 / Azure Local 20H2+ |
| ReFS Compression | Transparent per-block LZ4 compression applied at the ReFS layer. CPU overhead is low; compression happens inline. Microsoft quotes ~2:1 for typical mixed workloads. | Azure Local 23H2+ (Windows Server 2025+) |

Both features are opt-in per volume and only apply to specific workloads. Neither is currently accounted for in the Surveyor capacity model — all sizing assumes raw block consumption with no data-reduction.

---

## Research Findings

### 1. Workloads that benefit from ReFS Deduplication

| Workload | Dedup benefit | Typical savings ratio | Source |
|---|---|---|---|
| VDI / AVD session host OS disks | High — many clones from the same golden image share large amounts of identical data | 1.5:1 to 3:1 | [Microsoft Learn: ReFS dedup](https://learn.microsoft.com/windows-server/storage/refs/refs-deduplication) |
| SOFS profile containers (FSLogix VHDXs) | Medium — profile containers share OS files and common app data across users | 1.3:1 to 1.8:1 | FSLogix sizing guidance |
| Windows software repositories / WSUS | Very high — patches contain many shared binaries | 3:1 to 10:1 | Microsoft documentation |
| MABS backup data | Medium — backup streams of similar VMs contain common blocks | 1.3:1 to 2:1 | MABS sizing guidance |

**Platform requirements for ReFS Dedup:**
- Minimum: Windows Server 2019 / Azure Local 20H2
- Supported resiliency: Two-Way Mirror, Three-Way Mirror, Dual Parity  
- Does NOT interact with S2D tiering in any unsupported way — safe to use on NVMe-only and NVMe+SSD pools

### 2. Workloads that benefit from ReFS Compression

Microsoft quotes a typical compression ratio of **2:1** for mixed workloads. Per-workload estimates:

| Workload | Compression benefit | Typical ratio | Notes |
|---|---|---|---|
| General-purpose VMs | Moderate | 1.5:1 to 2:1 | Mixed file content compresses well |
| MABS backup data | Good | 1.5:1 to 2.5:1 | Backup streams compress effectively; already-compressed backup targets won't benefit |
| AKS PVC with text/log/JSON workloads | Good | 2:1 to 3:1 | Structured text compresses very well |
| AVD session host OS disks | Moderate | 1.3:1 to 1.8:1 | Better combined with dedup |

**Platform requirements for ReFS Compression:**
- Minimum: **Azure Local 23H2 (build 25398.x) / Windows Server 2025**  
- Not available on Windows Server 2019 or 2022 — Surveyor must surface this requirement when a user enables compression

### 3. Workloads where dedup/compression should NOT be used

| Workload | Reason |
|---|---|
| SQL Server OLTP (high-IOPS volumes) | CPU overhead of dedup/compression adds latency that is unacceptable for sub-millisecond OLTP workloads |
| Already-compressed data (video, images, ZIP, encrypted volumes) | Compression ratio ≈ 1:1 — no savings, pure overhead |
| Databases with native page compression | Double-compressing already-compressed data yields no benefit |
| Latency-sensitive AKS PVCs | Similar to SQL — block-level overhead may violate SLA |

### 4. Capacity Planning Model Implications

Three implementation options were evaluated for Surveyor:

#### Option A — Per-volume savings ratio field *(Recommended)*

Add an optional `estimatedSavingsRatio?: number` to `VolumeSpec`. When set, Surveyor divides the volume's pool footprint by the savings ratio before computing utilization.

**Pros:**
- Granular — different savings ratios per volume matches real-world configuration
- Fits naturally with the existing per-volume architecture introduced in v2.0
- Non-breaking — unset field defaults to `1.0` (no savings, current behavior)

**Cons:**
- User must estimate their own savings ratio (no auto-suggestion)

#### Option B — Per-workload toggle

Add dedup/compression toggles to each workload planner (AVD, SOFS, MABS, VMs) and apply a workload-appropriate default ratio.

**Pros:** Easier UX for users unfamiliar with ratios  
**Cons:** Harder to maintain as workload types evolve; defaults may mislead

#### Option C — Global `dataReductionRatio` in Advanced Settings

Apply a single ratio to all volumes when set.

**Pros:** Simplest to implement  
**Cons:** Inaccurate — different volumes benefit very differently

**Decision: Option A is recommended.** It aligns with the per-volume architecture, is non-breaking, and allows accurate mixed configurations (e.g. dedup on VDI volumes, no savings on SQL volumes).

### 5. Health Check Implications

Two new health check codes should be considered in the follow-on implementation issue:

| Code | Severity | Trigger |
|---|---|---|
| `HC_DEDUP_UNSUPPORTED_WORKLOAD` | `warning` | `estimatedSavingsRatio` set on a volume whose source workload is unlikely to benefit (e.g. a volume flagged as video/encrypted storage) |
| `HC_COMPRESSION_REQUIRES_23H2` | `info` | Compression savings ratio applied to any volume, reminding the user that 23H2+ is required |

### 6. Quick Start Reference Implications

The Quick Start Reference currently shows a single "Effective usable" number per resiliency type. With data reduction enabled per-volume, the reference rows could optionally show:
- A "No savings" baseline (current behavior)
- An "Estimated with savings" column when any volumes have `estimatedSavingsRatio > 1`

This is an optional enhancement — the per-volume annotation is sufficient for v2.1.x.

### 7. Platform Version Requirements

| Feature | Minimum Azure Local build | Minimum Windows Server |
|---|---|---|
| ReFS Deduplication | 20H2 (build 17784) | Windows Server 2019 |
| ReFS Compression | 23H2 (build 25398) | Windows Server 2025 |

Surveyor should display a callout when compression savings are configured, noting the 23H2 requirement.

---

## Recommended Engine Changes (for follow-on issue)

### `src/engine/types.ts`

```typescript
export interface VolumeSpec {
  id: string
  name: string
  resiliency: ResiliencyType
  provisioning: 'fixed' | 'thin'
  plannedSizeTB: number
  estimatedSavingsRatio?: number  // 1.0 = no savings (default); 2.0 = 2:1 dedup/compression
}
```

### `src/engine/volumes.ts` — `computeVolumeSummary`

```typescript
// Pool footprint adjusted for savings ratio when set
const factor = getResiliencyFactor(v.resiliency, capacity.nodeCount)
const savingsRatio = v.estimatedSavingsRatio && v.estimatedSavingsRatio > 1 ? v.estimatedSavingsRatio : 1
return sum + (v.plannedSizeTB / factor) / savingsRatio
```

### `src/engine/healthcheck.ts`

Add `HC_COMPRESSION_REQUIRES_23H2` and `HC_DEDUP_UNSUPPORTED_WORKLOAD` rules (see section 5 above).

### `src/components/VolumeTable.tsx`

Add an optional "Savings ratio" column to the volume table that appears when any volume has `estimatedSavingsRatio` set. Show effective pool footprint after savings.

---

## Follow-On Issue

A separate implementation issue should be created and linked to #141, covering:

1. Add `estimatedSavingsRatio?: number` to `VolumeSpec`
2. Update `computeVolumeSummary` to apply savings ratio to pool footprint calculation
3. Update `VolumeTable.tsx` to show savings ratio column and adjusted footprint
4. Add `HC_COMPRESSION_REQUIRES_23H2` health check
5. Update Quick Start Reference to show "effective with savings" column when applicable

---

## References

- [ReFS deduplication on Azure Local — Microsoft Learn](https://learn.microsoft.com/windows-server/storage/refs/refs-deduplication)
- [ReFS compression — Microsoft Learn](https://learn.microsoft.com/windows-server/storage/refs/refs-compression)
- [Storage Spaces Direct capacity planning — Microsoft Learn](https://learn.microsoft.com/windows-server/storage/storage-spaces/plan-volumes)
- [Azure Local sizing guides — Azure documentation](https://learn.microsoft.com/azure/azure-local/)
