/**
 * Azure service workload preset catalog.
 *
 * Each entry defines representative resource defaults for a common Arc-enabled
 * or AKS-based service on Azure Local. Defaults are representative mid-range
 * configurations — confirm with Microsoft sizing guidance before quoting.
 *
 * Service presets are independent of the AKS planner. They represent
 * the full resource footprint of the service (compute + storage) as a
 * standalone workload card in the Workload Planner.
 *
 * Last-verified dates indicate when defaults were checked against
 * Microsoft documentation.
 */
import type { ResiliencyType } from './types'

export interface ServicePresetCatalogEntry {
  id: string
  name: string
  shortName: string
  description: string
  category: 'data-services' | 'iot' | 'ai' | 'containers'
  lastVerified: string
  learnUrl: string
  defaultVCpusPerInstance: number
  defaultMemoryGBPerInstance: number
  defaultStorageTBPerInstance: number
  defaultPvcResiliency: ResiliencyType
  notes: string
}

export const SERVICE_PRESET_CATALOG: ServicePresetCatalogEntry[] = [
  // ── Data Services ─────────────────────────────────────────────────────────
  {
    id: 'arc-sql-mi-gp',
    name: 'Arc SQL Managed Instance — General Purpose',
    shortName: 'Arc SQL MI (GP)',
    description: 'Azure Arc-enabled SQL Managed Instance, General Purpose tier. Runs on AKS on Azure Local. Includes data controller, SQL MI pods, and persistent volume storage.',
    category: 'data-services',
    lastVerified: 'April 2026',
    learnUrl: 'https://learn.microsoft.com/azure/azure-arc/data/create-sql-managed-instance',
    defaultVCpusPerInstance: 16,
    defaultMemoryGBPerInstance: 64,
    defaultStorageTBPerInstance: 0.5,
    defaultPvcResiliency: 'three-way-mirror',
    notes: 'Includes data controller overhead. Scale vCPUs and storage to match your database workload. GP tier does not provide HA replicas.',
  },
  {
    id: 'arc-sql-mi-bc',
    name: 'Arc SQL Managed Instance — Business Critical',
    shortName: 'Arc SQL MI (BC)',
    description: 'Azure Arc-enabled SQL Managed Instance, Business Critical tier. Includes multiple SQL replicas for HA and faster failover. Higher compute and storage than GP.',
    category: 'data-services',
    lastVerified: 'April 2026',
    learnUrl: 'https://learn.microsoft.com/azure/azure-arc/data/create-sql-managed-instance',
    defaultVCpusPerInstance: 32,
    defaultMemoryGBPerInstance: 128,
    defaultStorageTBPerInstance: 1,
    defaultPvcResiliency: 'three-way-mirror',
    notes: 'Business Critical tier includes 2 additional readable secondary replicas. Storage shown is per primary replica — total footprint is higher with replicas.',
  },
  {
    id: 'arc-iot-operations',
    name: 'Azure IoT Operations',
    shortName: 'IoT Operations',
    description: 'Azure IoT Operations on AKS on Azure Local. Includes MQTT broker, data processor pipeline, OPC UA broker, and Azure Arc connectivity components.',
    category: 'iot',
    lastVerified: 'April 2026',
    learnUrl: 'https://learn.microsoft.com/azure/iot-operations/overview-iot-operations',
    defaultVCpusPerInstance: 12,
    defaultMemoryGBPerInstance: 32,
    defaultStorageTBPerInstance: 0.1,
    defaultPvcResiliency: 'three-way-mirror',
    notes: 'Resources vary with message throughput and pipeline complexity. Add headroom for observability agents (Azure Monitor, OTEL collector).',
  },
  {
    id: 'arc-ai-foundry-local',
    name: 'Azure AI Foundry Local',
    shortName: 'AI Foundry Local',
    description: 'Azure AI Foundry Local for on-premises model inference on Azure Local. Includes model serving, inference endpoints, and optional fine-tuning workloads.',
    category: 'ai',
    lastVerified: 'April 2026',
    learnUrl: 'https://learn.microsoft.com/azure/ai-foundry/overview',
    defaultVCpusPerInstance: 32,
    defaultMemoryGBPerInstance: 128,
    defaultStorageTBPerInstance: 0.5,
    defaultPvcResiliency: 'three-way-mirror',
    notes: 'Compute is for CPU-based inference. GPU-accelerated models require additional planning — ensure your Azure Local hardware has GPU passthrough support. Model weights are not included in storage estimate.',
  },
  {
    id: 'arc-container-apps',
    name: 'Azure Container Apps (Connected)',
    shortName: 'Container Apps',
    description: 'Azure Container Apps Connected Environment on AKS on Azure Local. Includes Envoy ingress controller, KEDA event-driven scaling, and Dapr runtime.',
    category: 'containers',
    lastVerified: 'April 2026',
    learnUrl: 'https://learn.microsoft.com/azure/container-apps/azure-local-overview',
    defaultVCpusPerInstance: 8,
    defaultMemoryGBPerInstance: 32,
    defaultStorageTBPerInstance: 0.05,
    defaultPvcResiliency: 'two-way-mirror',
    notes: 'Baseline infrastructure sizing. Scale worker nodes based on your container workload density and expected replica counts.',
  },
]

export interface ServicePresetInstance {
  id: string          // unique instance id (uuid-like)
  catalogId: string   // references SERVICE_PRESET_CATALOG entry
  enabled: boolean
  instanceCount: number
  // Optional per-instance overrides — undefined = use catalog default
  vCpusOverride?: number
  memoryGBOverride?: number
  storageTBOverride?: number
}

export interface ServicePresetTotals {
  totalVCpus: number
  totalMemoryGB: number
  totalStorageTB: number
}

export function getCatalogEntry(catalogId: string): ServicePresetCatalogEntry | undefined {
  return SERVICE_PRESET_CATALOG.find((e) => e.id === catalogId)
}

export function computeServicePreset(
  instance: ServicePresetInstance,
): ServicePresetTotals {
  const entry = getCatalogEntry(instance.catalogId)
  if (!entry || !instance.enabled || instance.instanceCount <= 0) {
    return { totalVCpus: 0, totalMemoryGB: 0, totalStorageTB: 0 }
  }
  const n = instance.instanceCount
  const vCpus   = (instance.vCpusOverride   ?? entry.defaultVCpusPerInstance)    * n
  const memGB   = (instance.memoryGBOverride ?? entry.defaultMemoryGBPerInstance) * n
  const storTB  = round2((instance.storageTBOverride ?? entry.defaultStorageTBPerInstance) * n)
  return { totalVCpus: vCpus, totalMemoryGB: memGB, totalStorageTB: storTB }
}

export function computeAllServicePresets(instances: ServicePresetInstance[]): ServicePresetTotals {
  return instances.reduce(
    (acc, inst) => {
      const t = computeServicePreset(inst)
      return {
        totalVCpus:    acc.totalVCpus    + t.totalVCpus,
        totalMemoryGB: acc.totalMemoryGB + t.totalMemoryGB,
        totalStorageTB: round2(acc.totalStorageTB + t.totalStorageTB),
      }
    },
    { totalVCpus: 0, totalMemoryGB: 0, totalStorageTB: 0 },
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
