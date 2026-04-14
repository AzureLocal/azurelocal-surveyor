/**
 * JSON exporter — versioned plan manifest (#118).
 *
 * Produces a machine-readable SurveyorPlan artifact containing:
 *   - schema identity and provenance metadata
 *   - verbatim input snapshot (all store slices)
 *   - frozen computed outputs (capacity, compute, workloads, health, per-scenario results)
 *
 * This is the primary handoff artifact for Ranger and any downstream automation.
 * Schema versioning: schemaVersion "1.0" — Ranger checks the major version only.
 */

import type { SurveyorState, VolumeMode } from '../state/store'
import type {
  HardwareInputs,
  AdvancedSettings,
  VolumeSpec,
  AvdInputs,
  SofsInputs,
  MabsInputs,
  AksInputs,
  VmScenario,
  CustomWorkload,
  CapacityResult,
  ComputeResult,
  VolumeSummaryResult,
  WorkloadSummaryResult,
  HealthCheckResult,
  AvdResult,
  SofsResult,
  AksResult,
  MabsResult,
} from '../engine/types'
import type { ServicePresetInstance } from '../engine/service-presets'
import { computeCapacity } from '../engine/capacity'
import { computeVolumeSummary } from '../engine/volumes'
import { computeCompute } from '../engine/compute'
import { computeAvd } from '../engine/avd'
import { computeSofs } from '../engine/sofs'
import { computeAks } from '../engine/aks'
import { computeMabs } from '../engine/mabs'
import { runHealthCheck } from '../engine/healthcheck'
import { computeWorkloadTotals } from '../engine/workloads'

// ─── Provenance ───────────────────────────────────────────────────────────────

export type ProvenanceSource = 'manual' | 'imported' | 'url-share'

export interface SurveyorPlanProvenance {
  /** How the inputs were created. */
  source: ProvenanceSource
  /** Free-text annotation — e.g. customer name, site, engagement context. */
  notes?: string
  /** Name or email of the person who approved this as a baseline. */
  approvedBy?: string
  /** ISO 8601 UTC timestamp of approval. Set by Ranger or hand-edit. */
  approvedAt?: string
  /** Human-readable label for the baseline artifact — e.g. "Pre-deployment baseline — Site A". */
  baselineLabel?: string
}

// ─── Plan Manifest ────────────────────────────────────────────────────────────

export interface SurveyorPlan {
  /** Schema version — Ranger checks the major number only. Bump MAJOR on breaking changes. */
  schemaVersion: '1.0'
  /** Surveyor app version that generated this file. */
  surveyorVersion: string
  /** ISO 8601 UTC timestamp of when the file was generated. */
  generatedAt: string

  provenance: SurveyorPlanProvenance

  /** Verbatim copy of all user-entered inputs at export time. */
  inputs: {
    hardware: HardwareInputs
    advanced: AdvancedSettings
    volumes: VolumeSpec[]
    volumeMode: VolumeMode
    avdEnabled: boolean
    avd: AvdInputs
    sofsEnabled: boolean
    sofs: SofsInputs
    mabsEnabled: boolean
    mabs: MabsInputs
    aks: AksInputs
    virtualMachines: VmScenario
    servicePresets: ServicePresetInstance[]
    customWorkloads: CustomWorkload[]
  }

  /**
   * Computed outputs frozen at export time.
   * Downstream consumers (Ranger) can trust these directly without re-running the engine.
   * Per-scenario results are only present when the scenario was enabled at export time.
   */
  outputs: {
    capacity: CapacityResult
    compute: ComputeResult
    volumeSummary: VolumeSummaryResult
    workloadTotals: WorkloadSummaryResult
    health: HealthCheckResult
    avd?: AvdResult
    sofs?: SofsResult
    aks?: AksResult
    mabs?: MabsResult
  }
}

// ─── Exporter ─────────────────────────────────────────────────────────────────

type ExportState = Pick<
  SurveyorState,
  | 'hardware' | 'advanced' | 'volumes' | 'volumeMode'
  | 'avd' | 'avdEnabled'
  | 'sofs' | 'sofsEnabled'
  | 'mabs' | 'mabsEnabled'
  | 'aks' | 'virtualMachines'
  | 'servicePresets' | 'customWorkloads'
>

export interface ExportJsonOptions {
  provenance?: Partial<SurveyorPlanProvenance>
}

export function exportJson(state: ExportState, options?: ExportJsonOptions): void {
  // ── Compute all engine outputs ───────────────────────────────────────────
  const capacity      = computeCapacity(state.hardware, state.advanced)
  const volumeSummary = computeVolumeSummary(state.volumes, capacity)
  const compute       = computeCompute(state.hardware, state.advanced)
  const avd           = computeAvd(state.avd, state.advanced.overrides)
  const sofs          = computeSofs(state.sofs, state.advanced.overrides)
  const aks           = computeAks(state.aks)
  const mabs          = computeMabs(state.mabs)
  const workloadTotals = computeWorkloadTotals({
    avdEnabled:      state.avdEnabled,
    avd,
    aksEnabled:      state.aks.enabled,
    aks,
    virtualMachines: state.virtualMachines,
    sofsEnabled:     state.sofsEnabled,
    sofs,
    mabsEnabled:     state.mabsEnabled,
    mabs,
    servicePresets:  state.servicePresets,
    customWorkloads: state.customWorkloads,
  })
  const health        = runHealthCheck({
    hardware:        state.hardware,
    settings:        state.advanced,
    volumes:         state.volumes,
    capacity,
    compute,
    workloadSummary: workloadTotals,
  })

  // ── Assemble manifest ────────────────────────────────────────────────────
  const plan: SurveyorPlan = {
    schemaVersion:   '1.0',
    surveyorVersion: '1.3.0',
    generatedAt:     new Date().toISOString(),

    provenance: {
      source: 'manual',
      ...options?.provenance,
    },

    inputs: {
      hardware:        state.hardware,
      advanced:        state.advanced,
      volumes:         state.volumes,
      volumeMode:      state.volumeMode,
      avdEnabled:      state.avdEnabled,
      avd:             state.avd,
      sofsEnabled:     state.sofsEnabled,
      sofs:            state.sofs,
      mabsEnabled:     state.mabsEnabled,
      mabs:            state.mabs,
      aks:             state.aks,
      virtualMachines: state.virtualMachines,
      servicePresets:  state.servicePresets,
      customWorkloads: state.customWorkloads,
    },

    outputs: {
      capacity,
      compute,
      volumeSummary,
      workloadTotals,
      health,
      ...(state.avdEnabled  && { avd }),
      ...(state.sofsEnabled && { sofs }),
      ...(state.aks.enabled && { aks }),
      ...(state.mabsEnabled && { mabs }),
    },
  }

  // ── Trigger browser download ─────────────────────────────────────────────
  const date     = new Date().toISOString().slice(0, 10)
  const filename = `azure-local-plan-${date}.json`
  const blob     = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
  const url      = URL.createObjectURL(blob)
  const a        = document.createElement('a')
  a.href         = url
  a.download     = filename
  a.click()
  URL.revokeObjectURL(url)
}
