import { describe, expect, it } from 'vitest'
import { JOURNEYS, journeyArea, journeyPosition, journeyRoutes } from './journey'

describe('Journey step order', () => {
  it('orders the workload planning steps hardware → workloads → specialized → recommendations → fit → reports → projects', () => {
    expect(JOURNEYS.workload.steps.map(s => s.route)).toEqual([
      '/planning/hardware', '/planning/workloads', '/planning/specialized', '/planning/recommendations', '/planning/fit', '/planning/reports', '/planning/projects',
    ])
    expect(journeyRoutes('workload')).toContain('/planning/avd')
    expect(journeyRoutes('workload')).toContain('/planning/volumes')
  })
  it('orders the storage sizing steps hardware → volumes → drive-layout → capacity → reports → projects', () => {
    expect(JOURNEYS.storage.steps.map(s => s.route)).toEqual([
      '/storage/hardware', '/storage/volumes', '/storage/drive-layout', '/storage/capacity', '/storage/reports', '/storage/projects',
    ])
  })
  it('keeps every route unique within an area', () => {
    for (const area of ['storage', 'workload'] as const) {
      const routes = journeyRoutes(area)
      expect(new Set(routes).size).toBe(routes.length)
    }
  })
})

describe('Current step from the route', () => {
  it('finds the area from the pathname and ignores home, help and about pages', () => {
    expect(journeyArea('/planning/fit')).toBe('workload')
    expect(journeyArea('/storage/volumes')).toBe('storage')
    for (const path of ['/', '/planning', '/storage', '/help', '/about', '/references', '/thin-provisioning']) {
      expect(journeyArea(path)).toBeNull()
      expect(journeyPosition(path)).toBeNull()
    }
  })
  it('returns null for unknown routes inside an area', () => {
    expect(journeyPosition('/planning/nope')).toBeNull()
  })
  it('numbers the current step and offers previous and next', () => {
    const fit = journeyPosition('/planning/fit')!
    expect(fit.number).toBe(5)
    expect(fit.total).toBe(7)
    expect(fit.step.label).toBe('Fit')
    expect(fit.previous?.route).toBe('/planning/recommendations')
    expect(fit.next?.route).toBe('/planning/reports')
    expect(fit.subStep).toBeUndefined()
  })
  it('has no previous on the first step and no next on the last', () => {
    const first = journeyPosition('/storage/hardware')!
    expect(first.number).toBe(1)
    expect(first.previous).toBeUndefined()
    expect(first.next?.route).toBe('/storage/volumes')
    const last = journeyPosition('/storage/projects')!
    expect(last.number).toBe(6)
    expect(last.total).toBe(6)
    expect(last.next).toBeUndefined()
    expect(last.previous?.route).toBe('/storage/reports')
    expect(last.home).toBe('/storage')
  })
  it('treats the specialized planners as sub-steps of Specialized Workloads', () => {
    const avd = journeyPosition('/planning/avd')!
    expect(avd.number).toBe(3)
    expect(avd.step.route).toBe('/planning/specialized')
    expect(avd.subStep?.label).toBe('AVD Planner')
    expect(avd.previous?.route).toBe('/planning/specialized')
    expect(avd.next?.route).toBe('/planning/recommendations')
  })
  it('keeps storage design and drive layouts in workload planning under the Fit step', () => {
    expect(journeyPosition('/planning/volumes')?.step.route).toBe('/planning/fit')
    expect(journeyPosition('/planning/drive-layout')?.step.route).toBe('/planning/fit')
    expect(journeyPosition('/storage/drive-layout')?.number).toBe(3)
  })
  it('walks the whole journey with next from the first step', () => {
    for (const area of ['storage', 'workload'] as const) {
      const visited: string[] = []
      let route: string | undefined = JOURNEYS[area].steps[0].route
      while (route) {
        visited.push(route)
        route = journeyPosition(route)!.next?.route
      }
      expect(visited).toEqual(JOURNEYS[area].steps.map(s => s.route))
    }
  })
})
