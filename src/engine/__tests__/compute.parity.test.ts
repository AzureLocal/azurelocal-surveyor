/**
 * Compute parity test suite — 6 golden scenarios.
 *
 * Formula chain from compute.ts:
 *   physicalCores       = coresPerNode × nodeCount
 *   logicalCoresPerNode = coresPerNode × 2  (HT enabled) | coresPerNode  (HT disabled)
 *   logicalCores        = logicalCoresPerNode × nodeCount
 *   rawVCpus            = logicalCores × vCpuOversubscriptionRatio
 *   usableVCpus         = rawVCpus − (systemReservedVCpus × nodeCount)
 *
 * N+1 failover (one node down):
 *   rawVCpusN1    = logicalCoresPerNode × (nodeCount − 1) × ratio
 *   usableVCpusN1 = rawVCpusN1 − systemReservedVCpus × (nodeCount − 1)
 *
 * Memory:
 *   physicalMemoryGB  = memoryPerNodeGB × nodeCount
 *   usableMemoryGB    = physicalMemoryGB − (systemReservedMemoryGB × nodeCount)
 *   usableMemoryGBN1  = memoryPerNodeGB × (n−1) − systemReservedMemoryGB × (n−1)
 *
 * NUMA: numaDomainsEstimate = nodeCount × 2
 *
 * Default settings (DEFAULT_ADVANCED_SETTINGS):
 *   vCpuOversubscriptionRatio = 4
 *   systemReservedVCpus       = 4 per node
 *   systemReservedMemoryGB    = 8 per node
 */

import { describe, it, expect } from 'vitest'
import { computeCompute } from '../compute'
import type { HardwareInputs, AdvancedSettings } from '../types'

const BASE_HW: HardwareInputs = {
  nodeCount: 4,
  coresPerNode: 16,
  memoryPerNodeGB: 256,
  hyperthreadingEnabled: true,
  capacityDrivesPerNode: 8,
  capacityDriveSizeTB: 4,
  cacheDrivesPerNode: 0,
  cacheDriveSizeTB: 0,
  cacheMediaType: 'none',
  capacityMediaType: 'nvme',
}

const BASE_SETTINGS: AdvancedSettings = {
  capacityEfficiencyFactor: 0.92,
  infraVolumeSizeTB: 0.25,
  vCpuOversubscriptionRatio: 4,
  systemReservedVCpus: 4,
  systemReservedMemoryGB: 8,
  defaultResiliency: 'three-way-mirror',
  overrides: {},
}

describe('Compute parity — 6 golden scenarios', () => {
  // ── Scenario 01: HT enabled — logical vCPUs double ──
  // physicalCores = 16×4 = 64
  // logicalCoresPerNode = 16×2 = 32  (HT doubles)
  // logicalCores = 32×4 = 128
  // rawVCpus = 128×4 = 512
  // usableVCpus = 512 − 4×4 = 496
  it('01 — HT enabled: logicalCores = 2× physicalCores', () => {
    const r = computeCompute(BASE_HW, BASE_SETTINGS)
    expect(r.physicalCores).toBe(64)
    expect(r.logicalCoresPerNode).toBe(32)
    expect(r.logicalCores).toBe(128)
    expect(r.hyperthreadingEnabled).toBe(true)
    expect(r.usableVCpus).toBe(496)
  })

  // ── Scenario 02: HT disabled — logical vCPUs equal physical ──
  // logicalCoresPerNode = 16  (no doubling)
  // logicalCores = 16×4 = 64
  // rawVCpus = 64×4 = 256
  // usableVCpus = 256 − 16 = 240
  it('02 — HT disabled: logicalCores = physicalCores, usableVCpus halved', () => {
    const r = computeCompute({ ...BASE_HW, hyperthreadingEnabled: false }, BASE_SETTINGS)
    expect(r.logicalCoresPerNode).toBe(16)
    expect(r.logicalCores).toBe(64)
    expect(r.usableVCpus).toBe(240)
    expect(r.numaDomainsEstimate).toBe(8)  // NUMA is node-count, not HT dependent
  })

  // ── Scenario 03: N+1 one-node-loss model ──
  // Full cluster (4 nodes): usableVCpus = 496, usableMemoryGB = 992
  // N+1 (3 nodes): rawVCpusN1 = 32×3×4 = 384, reserved = 4×3 = 12 → usableVCpusN1 = 372
  // Memory N+1: 256×3 − 8×3 = 768 − 24 = 744
  it('03 — N+1 failover: one-node-loss vCPU and memory', () => {
    const r = computeCompute(BASE_HW, BASE_SETTINGS)
    expect(r.usableVCpus).toBe(496)
    expect(r.usableVCpusN1).toBe(372)
    expect(r.usableMemoryGB).toBe(992)
    expect(r.usableMemoryGBN1).toBe(744)
  })

  // ── Scenario 04: System reserved RAM scales per node ──
  // systemReservedMemoryGB = 32 per node
  // usableMemoryGB = 4×256 − 4×32 = 1024 − 128 = 896
  // usableMemoryGBN1 = 3×256 − 3×32 = 768 − 96 = 672
  it('04 — system reserved RAM scales per node', () => {
    const r = computeCompute(BASE_HW, { ...BASE_SETTINGS, systemReservedMemoryGB: 32 })
    expect(r.physicalMemoryGB).toBe(1024)
    expect(r.systemReservedMemoryGB).toBe(128)  // 32×4
    expect(r.usableMemoryGB).toBe(896)
    expect(r.usableMemoryGBN1).toBe(672)
  })

  // ── Scenario 05: NUMA estimate = nodeCount × 2 ──
  // 6-node cluster → numaDomainsEstimate = 12
  // physicalCores = 16×6 = 96
  it('05 — NUMA estimate = nodeCount × 2', () => {
    const r = computeCompute({ ...BASE_HW, nodeCount: 6 }, BASE_SETTINGS)
    expect(r.numaDomainsEstimate).toBe(12)
    expect(r.physicalCores).toBe(96)
    expect(r.nodeCount).toBe(6)
  })

  // ── Scenario 06: vCPU oversubscription ratio scales usable vCPUs ──
  // ratio = 8 (instead of default 4)
  // rawVCpus = 128×8 = 1024, usableVCpus = 1024 − 16 = 1008
  // N+1: rawVCpusN1 = 32×3×8 = 768, usableVCpusN1 = 768 − 12 = 756
  it('06 — vCPU oversubscription ratio scales usable and N+1 vCPUs', () => {
    const r = computeCompute(BASE_HW, { ...BASE_SETTINGS, vCpuOversubscriptionRatio: 8 })
    expect(r.usableVCpus).toBe(1008)
    expect(r.usableVCpusN1).toBe(756)
  })
})
