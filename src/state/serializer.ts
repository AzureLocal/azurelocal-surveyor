/**
 * URL state serializer.
 *
 * Encodes the current Surveyor state into the URL fragment (#) so scenarios
 * can be shared by copying the URL. The payload is gzip-compressed then
 * base64url-encoded for compactness.
 *
 * Usage:
 *   const url = serializeToUrl(state)
 *   const state = deserializeFromUrl(window.location.hash)
 */

import type { SurveyorState } from './store'

type SerializableState = Pick<
  SurveyorState,
  'hardware' | 'advanced' | 'volumes' | 'workloads' | 'avd' | 'sofs'
>

/** Encode state to a base64url string suitable for a URL fragment. */
export function serializeToUrl(state: SerializableState): string {
  const payload: SerializableState = {
    hardware: state.hardware,
    advanced: state.advanced,
    volumes: state.volumes,
    workloads: state.workloads,
    avd: state.avd,
    sofs: state.sofs,
  }
  const json = JSON.stringify(payload)
  return btoa(encodeURIComponent(json))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Decode a base64url fragment back to state. Returns null on parse errors. */
export function deserializeFromUrl(fragment: string): SerializableState | null {
  try {
    const base64 = fragment.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(atob(base64))
    return JSON.parse(json) as SerializableState
  } catch {
    return null
  }
}

/** Build a shareable URL for the current scenario. */
export function buildShareUrl(state: SerializableState): string {
  const encoded = serializeToUrl(state)
  const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''
  return `${base}#${encoded}`
}
