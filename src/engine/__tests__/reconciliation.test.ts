/**
 * Cross-tool reconciliation test — Wave 3 keystone (AB#4633 child).
 *
 * Validates Surveyor's capacity engine against the SHARED golden-cluster
 * fixture (`fixtures/golden-clusters.json`). An IDENTICAL copy of that
 * fixture lives in the S2D Cartographer repo, whose Pester suite asserts the
 * same expected byte values from its PowerShell engine.
 *
 * The fixture is the contract: if this suite is green AND Cartographer's
 * Reconciliation.Tests.ps1 is green, the two tools agree on the canonical
 * capacity model (docs/capacity-model.md) within ±2% — by construction,
 * with no need to run PowerShell from a TS test or vice versa.
 *
 * All fixture expectations are in BYTES (the universal unit). Surveyor's
 * engine works in decimal TB, so each output is converted ×10^12 before
 * comparison.
 */

import { describe, it, expect } from 'vitest'
import {
  computeCapacity,
  DEFAULT_ADVANCED_SETTINGS,
  type HardwareInputs,
  type AdvancedSettings,
  type ResiliencyType,
} from '../index'
import golden from './fixtures/golden-clusters.json'

const TB = golden._meta.units.TB // 1e12 bytes
const TOL_PCT = golden.tolerancePct

/** True when `actual` is within `pct`% of `expected`. */
function withinPct(actual: number, expected: number, pct: number): boolean {
  if (expected === 0) return Math.abs(actual) < 1
  return Math.abs(actual - expected) / Math.abs(expected) <= pct / 100
}

describe('Cross-tool reconciliation — golden clusters (AB#4633)', () => {
  for (const cluster of golden.clusters) {
    describe(`${cluster.id} — ${cluster.description}`, () => {
      const hw: HardwareInputs = {
        nodeCount: cluster.hardware.nodeCount,
        capacityDrivesPerNode: cluster.hardware.capacityDrivesPerNode,
        capacityDriveSizeTB: cluster.hardware.capacityDriveSizeTB,
        cacheDrivesPerNode: 0,
        cacheDriveSizeTB: 0,
        cacheMediaType: 'none',
        capacityMediaType: 'nvme',
        coresPerNode: 32,
        memoryPerNodeGB: 256,
        hyperthreadingEnabled: true,
      }
      const settings: AdvancedSettings = {
        ...DEFAULT_ADVANCED_SETTINGS,
        defaultResiliency: cluster.hardware.resiliency as ResiliencyType,
        infraVolumeSizeTB: cluster.hardware.infraVolumeSizeTB,
      }
      const result = computeCapacity(hw, settings)
      const exp = cluster.expected

      // Sanity: the fixture must not request a resiliency invalid for the node
      // count — that would clamp and silently break reconciliation. Catch it here.
      it('resiliency is valid for the node count (not clamped)', () => {
        expect(result.resiliencyClamped).toBe(false)
      })

      it('raw matches canonical', () => {
        expect(withinPct(result.rawPoolTB * TB, exp.rawBytes, TOL_PCT)).toBe(true)
      })

      it('pool-after-metadata matches canonical', () => {
        expect(withinPct(result.totalUsableTB * TB, exp.poolAfterMetaBytes, TOL_PCT)).toBe(true)
      })

      it('reserve matches canonical', () => {
        expect(withinPct(result.reserveTB * TB, exp.reserveBytes, TOL_PCT)).toBe(true)
      })

      it('infrastructure-volume footprint matches canonical', () => {
        expect(withinPct(result.infraVolumeTB * TB, exp.infraFootprintBytes, TOL_PCT)).toBe(true)
      })

      it('available-for-volumes (footprint) matches canonical', () => {
        expect(
          withinPct(result.availableForVolumesTB * TB, exp.availableForVolumesBytes, TOL_PCT)
        ).toBe(true)
      })

      it('usable (data) matches canonical', () => {
        expect(withinPct(result.effectiveUsableTB * TB, exp.usableBytes, TOL_PCT)).toBe(true)
      })
    })
  }
})
