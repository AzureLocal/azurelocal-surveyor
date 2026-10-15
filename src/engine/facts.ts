/**
 * Facts registry: every Azure Local platform fact encoded in src/engine, with its
 * Microsoft Learn source and the date it was last checked against that page.
 * The References page renders this list; engine code cites facts by id.
 *
 * Planning assumptions (not Learn requirements) are listed separately in
 * PLANNING_ASSUMPTIONS so the UI never presents them as platform rules.
 */

export const RELEASE_LABEL = 'Azure Local 12.2609'
export const FACTS_VERIFIED = '2026-10-15'

export type FactId =
  | 'nodes-hci-1-16' | 'single-node-two-way' | 'single-node-no-cache' | 'mirror-efficiency' | 'nested-two-node'
  | 'dual-parity' | 'volume-size' | 'pool-reserve' | 'min-capacity-drives' | 'cache-min-drives' | 'hybrid-rules'
  | 'no-cache-same-type' | 'rack-aware-zones' | 'rack-aware-resiliency' | 'rack-aware-drives' | 'rack-aware-identity'

export interface PlatformFact {
  id: FactId
  topic: 'Cluster size' | 'Resiliency' | 'Drives and cache' | 'Rack aware' | 'Volumes and reserve' | 'Single node'
  statement: string
  url: string
  verified: string
}

const L = 'https://learn.microsoft.com/azure/azure-local/'
const W = 'https://learn.microsoft.com/windows-server/storage/storage-spaces/'

export const PLATFORM_FACTS: PlatformFact[] = [
  { id: 'nodes-hci-1-16', topic: 'Cluster size', statement: 'Hyperconverged Azure Local supports 1 to 16 machines per instance (8 for rack aware). Disaggregated deployments on an external SAN scale to 64 machines and are out of scope for Surveyor.', url: L + 'scalability-deployments', verified: FACTS_VERIFIED },
  { id: 'single-node-two-way', topic: 'Single node', statement: 'A single machine runs two-way mirror volumes (the add-node path from one machine to two keeps two-way mirror). There is no second machine for live migration or failover, so updates that restart the host interrupt workloads.', url: L + 'manage/add-server', verified: FACTS_VERIFIED },
  { id: 'single-node-no-cache', topic: 'Single node', statement: 'The storage pool cache is not supported in a single-machine deployment; only a flat all-NVMe or all-SSD configuration of one drive type is supported.', url: W + 'storage-spaces-direct-hardware-requirements', verified: FACTS_VERIFIED },
  { id: 'mirror-efficiency', topic: 'Resiliency', statement: 'Two-way mirror stores two copies (50% efficiency). Three-way mirror stores three copies (33.3%) and needs three machines.', url: L + 'concepts/plan-volumes', verified: FACTS_VERIFIED },
  { id: 'nested-two-node', topic: 'Resiliency', statement: 'Two-machine clusters can use nested resiliency: 25% efficiency for nested two-way mirror (about 35-40% for nested mirror-accelerated parity).', url: L + 'concepts/plan-volumes', verified: FACTS_VERIFIED },
  { id: 'dual-parity', topic: 'Resiliency', statement: 'Dual parity needs four or more machines. All-flash efficiency (Learn fault-tolerance table): 4-6 machines 50%, 7-8 66.7%, 9-15 75%, 16 80%. Hybrid (HDD capacity) table: 4-6 50%, 7-11 66.7%, 12-16 72.7%. Surveyor uses the table that matches the capacity media.', url: L + 'concepts/plan-volumes', verified: FACTS_VERIFIED },
  { id: 'volume-size', topic: 'Volumes and reserve', statement: 'Limit each volume to 64 TB; keep the cluster to 64 volumes or fewer; create at least one volume per machine.', url: L + 'concepts/plan-volumes', verified: FACTS_VERIFIED },
  { id: 'pool-reserve', topic: 'Volumes and reserve', statement: 'Reserve the equivalent of one capacity drive per machine, up to 4 drives, so in-place repair can start immediately after a drive failure.', url: L + 'concepts/plan-volumes', verified: FACTS_VERIFIED },
  { id: 'min-capacity-drives', topic: 'Drives and cache', statement: 'At least two data drives per machine, each at least 500 GB. All-NVMe, all-SSD or all-persistent-memory capacity needs a minimum of 2 drives per machine on Azure Local.', url: L + 'concepts/system-requirements-23h2', verified: FACTS_VERIFIED },
  { id: 'cache-min-drives', topic: 'Drives and cache', statement: 'When a cache tier is used, every machine needs at least 2 cache drives plus at least 4 capacity drives (for example 2 NVMe + 4 HDD).', url: W + 'storage-spaces-direct-hardware-requirements', verified: FACTS_VERIFIED },
  { id: 'hybrid-rules', topic: 'Drives and cache', statement: 'Hybrid (HDD capacity with NVMe or SSD cache): cache devices of 32 GB or more, cache-to-capacity ratio of 15% or more, and a capacity drive count that is a whole multiple of the cache drive count. All-HDD without cache is not supported.', url: L + 'concepts/system-requirements-23h2', verified: FACTS_VERIFIED },
  { id: 'no-cache-same-type', topic: 'Drives and cache', statement: 'When all drives are the same type no cache is configured automatically, and every drive contributes capacity. Cache drives never contribute usable capacity.', url: W + 'cache', verified: FACTS_VERIFIED },
  { id: 'rack-aware-zones', topic: 'Rack aware', statement: 'Rack aware clusters use two local zones with an equal number of machines per zone (1+1, 2+2, 3+3, 4+4). New deployments only; growth is in pairs (2+2 to 3+3 to 4+4); a 1+1 cluster cannot be expanded in this release.', url: L + 'concepts/rack-aware-cluster-requirements', verified: FACTS_VERIFIED },
  { id: 'rack-aware-resiliency', topic: 'Rack aware', statement: '1+1: two-way mirror, 50% efficiency, tolerates a single fault (drive, node or rack). 2+2, 3+3 and 4+4: four-way mirror (rack level nested mirror), 25% efficiency, tolerates three faults of drive or node; if one rack fails the survivor tolerates one more drive or node fault. Three-way mirror cannot be created.', url: L + 'concepts/rack-aware-cluster-requirements', verified: FACTS_VERIFIED },
  { id: 'rack-aware-drives', topic: 'Rack aware', statement: 'Data drives must be all-flash (NVMe or SSD). Round-trip latency between racks must be 1 ms or less, with a dedicated storage network; a cloud witness is required.', url: L + 'concepts/rack-aware-cluster-requirements', verified: FACTS_VERIFIED },
  { id: 'rack-aware-identity', topic: 'Rack aware', statement: 'Rack aware clusters deploy with Active Directory only; local identity with Azure Key Vault is not supported in this release.', url: L + 'deploy/rack-aware-cluster-deploy-portal', verified: FACTS_VERIFIED },
]

export interface PlanningAssumption {
  id: string
  label: string
  statement: string
}

/** Defaults Surveyor applies that are NOT Microsoft requirements. Shown wherever they are used. */
export const PLANNING_ASSUMPTIONS: PlanningAssumption[] = [
  { id: 'os-memory-reserve', label: 'OS / host memory reserve (8 GB per node)', statement: 'A planning default for the host OS, Hyper-V and Azure Local agents. It is not a Learn requirement; adjust it to your measured host overhead.' },
  { id: 'vcpu-reserve', label: 'Host vCPU reserve (4 per node)', statement: 'A planning default for host services. It is not a Learn requirement; adjust it in Advanced settings.' },
  { id: 'vcpu-overcommit', label: 'vCPU oversubscription ratio', statement: 'A workload-dependent planning choice. Microsoft does not publish a universal ratio.' },
  { id: 'maintenance-reserve', label: 'N+1 / N+2 compute reserve', statement: 'Models the largest failure plus maintenance: N+1 keeps capacity for one machine down, N+2 for one machine in maintenance while another fails. It follows Well-Architected Framework reliability guidance and is not a platform limit. It reserves compute only; the storage reserve is the per-drive rebuild reserve.' },
  { id: 'pool-metadata', label: 'Pool metadata overhead (1%)', statement: 'A planning estimate (raw x 0.99). Use the live pool size when a cluster exists.' },
  { id: 'infra-volume', label: 'Infrastructure volume (0.25 TB default)', statement: 'A planning default for the system volume; confirm the size created by your deployment.' },
  { id: 'cache-ratio-warning', label: 'Cache ratio guidance for all-flash', statement: 'The 15% ratio is a Learn requirement for hybrid (HDD) designs only. For all-flash caching Learn suggests starting near 5% of capacity; Surveyor warns below that as guidance.' },
]
