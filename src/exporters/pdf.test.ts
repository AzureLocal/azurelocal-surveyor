import { describe, expect, it, vi } from 'vitest'
import { exportPdf } from './pdf'
import { normalizePersistedState, useSurveyorStore } from '../state/store'

const captured = vi.hoisted(() => [] as ArrayBuffer[])

// The node build of jsPDF cannot download; capture the finished document instead of saving it.
vi.mock('jspdf', async (importOriginal) => {
  const mod = await importOriginal<{ default: new (...args: unknown[]) => { output: (t: string) => ArrayBuffer; save: (name?: string) => unknown } }>()
  class Capturing extends mod.default {
    constructor(...args: unknown[]) {
      super(...args)
      this.save = () => { captured.push(this.output('arraybuffer')); return this }
    }
  }
  return { ...mod, default: Capturing, jsPDF: Capturing }
})

/** Smoke test for the PDF path after the jsPDF 4 / jspdf-autotable 5 upgrade (security advisories). */
describe('PDF export', () => {
  it('renders a PDF for a standard and a rack aware plan', () => {
    exportPdf({ ...useSurveyorStore.getState() })
    const rack = normalizePersistedState({ hardware: { ...useSurveyorStore.getState().hardware, nodeCount: 4, rackAware: true, cacheMediaType: 'none', cacheDrivesPerNode: 0 } })
    exportPdf({ ...useSurveyorStore.getState(), ...rack })
    expect(captured).toHaveLength(2)
    for (const buf of captured) {
      expect(buf.byteLength).toBeGreaterThan(5000)
      expect(new TextDecoder().decode(new Uint8Array(buf).slice(0, 5))).toBe('%PDF-')
    }
  })
})
