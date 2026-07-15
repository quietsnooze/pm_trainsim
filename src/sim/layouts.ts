/**
 * Layout builders: each returns a TrackGraph ready to run trains on.
 * (Grows into the declarative layout catalogue in a later slice.)
 */
import { TrackGraph } from './graph'
import { ArcSegment, StraightSegment } from './track'

/** The starter oval: two straights joined by two semicircles, as a graph. */
export function makeOvalGraph(straightLength = 0.5, radius = 0.22): TrackGraph {
  const g = new TrackGraph()
  const l = straightLength / 2
  const r = radius

  // Same geometry as the original closed-loop oval.
  g.addSegment('far', new StraightSegment({ x: -l, z: r }, { x: l, z: r }))
  g.addSegment('rightArc', new ArcSegment({ x: l, z: 0 }, r, Math.PI / 2, -Math.PI))
  g.addSegment('near', new StraightSegment({ x: l, z: -r }, { x: -l, z: -r }))
  g.addSegment('leftArc', new ArcSegment({ x: -l, z: 0 }, r, -Math.PI / 2, -Math.PI))

  g.connect({ seg: 'far', end: 'b' }, { seg: 'rightArc', end: 'a' })
  g.connect({ seg: 'rightArc', end: 'b' }, { seg: 'near', end: 'a' })
  g.connect({ seg: 'near', end: 'b' }, { seg: 'leftArc', end: 'a' })
  g.connect({ seg: 'leftArc', end: 'b' }, { seg: 'far', end: 'a' })

  // Spawn on the straight nearest the default camera, head towards +x.
  g.spawn = { seg: 'far', s: 0.45, dir: 1 }
  return g
}

/** z of the siding straight (exported for tests and the scene layer). */
export const SIDING_Z = 0.3

/**
 * The oval plus a siding off the camera-side straight: a point ('p1') whose
 * diverging route S-curves out to a parallel dead-end road with a buffer
 * stop. Route 0 = round the loop, route 1 = into the siding.
 */
export function makeOvalSidingGraph(straightLength = 0.5, radius = 0.22): TrackGraph {
  const g = new TrackGraph()
  const l = straightLength / 2
  const r = radius
  const mainZ = r

  // Main oval, with the camera-side straight split at the turnout.
  const toeX = -0.05
  g.addSegment('far1', new StraightSegment({ x: -l, z: mainZ }, { x: toeX, z: mainZ }))
  g.addSegment('far2', new StraightSegment({ x: toeX, z: mainZ }, { x: l, z: mainZ }))
  g.addSegment('rightArc', new ArcSegment({ x: l, z: 0 }, r, Math.PI / 2, -Math.PI))
  g.addSegment('near', new StraightSegment({ x: l, z: -r }, { x: -l, z: -r }))
  g.addSegment('leftArc', new ArcSegment({ x: -l, z: 0 }, r, -Math.PI / 2, -Math.PI))

  // Diverging route: an S of two equal arcs shifting the track out to the
  // siding's z, then the dead-end road itself.
  const turnR = 0.12
  const offset = SIDING_Z - mainZ
  const theta = Math.acos(1 - offset / (2 * turnR))
  const dx = 2 * turnR * Math.sin(theta)
  g.addSegment('sCurveA', new ArcSegment({ x: toeX, z: mainZ + turnR }, turnR, -Math.PI / 2, theta))
  g.addSegment(
    'sCurveB',
    new ArcSegment({ x: toeX + dx, z: SIDING_Z - turnR }, turnR, Math.PI / 2 + theta, -theta),
  )
  g.addSegment('siding', new StraightSegment({ x: toeX + dx, z: SIDING_Z }, { x: 0.42, z: SIDING_Z }))

  g.addPoint('p1', { seg: 'far1', end: 'b' }, [
    { seg: 'far2', end: 'a' },
    { seg: 'sCurveA', end: 'a' },
  ])
  g.connect({ seg: 'far2', end: 'b' }, { seg: 'rightArc', end: 'a' })
  g.connect({ seg: 'rightArc', end: 'b' }, { seg: 'near', end: 'a' })
  g.connect({ seg: 'near', end: 'b' }, { seg: 'leftArc', end: 'a' })
  g.connect({ seg: 'leftArc', end: 'b' }, { seg: 'far1', end: 'a' })
  g.connect({ seg: 'sCurveA', end: 'b' }, { seg: 'sCurveB', end: 'a' })
  g.connect({ seg: 'sCurveB', end: 'b' }, { seg: 'siding', end: 'a' })
  // siding end 'b' is deliberately unconnected: the buffer stop.

  g.spawn = { seg: 'far2', s: 0.25, dir: 1 }
  return g
}

/**
 * A figure-of-eight: two lobes joined by diagonals that cross at the
 * middle on a flat diamond crossing (the classic starter-set piece).
 * One lobe runs clockwise, the other anticlockwise.
 */
export function makeFigureEightGraph(lobeRadius = 0.16, lobeCenterX = 0.28): TrackGraph {
  const g = new TrackGraph()
  const r = lobeRadius
  const cx = lobeCenterX
  // Inner tangents to both lobes pass through the origin at ±theta.
  const theta = Math.asin((2 * r) / (2 * cx))
  const half = Math.sqrt(cx * cx - r * r) // half-length of each diagonal
  const px = half * Math.cos(theta)
  const pz = half * Math.sin(theta)

  const lobeSweep = Math.PI + 2 * theta // the long way round each lobe
  g.addSegment('diagA', new StraightSegment({ x: -px, z: -pz }, { x: px, z: pz }))
  // Right lobe, clockwise the long way round.
  g.addSegment('rightLobe', new ArcSegment({ x: cx, z: 0 }, r, Math.PI / 2 + theta, -lobeSweep))
  g.addSegment('diagB', new StraightSegment({ x: px, z: -pz }, { x: -px, z: pz }))
  // Left lobe, anticlockwise the long way round.
  g.addSegment('leftLobe', new ArcSegment({ x: -cx, z: 0 }, r, Math.PI / 2 - theta, lobeSweep))

  g.connect({ seg: 'diagA', end: 'b' }, { seg: 'rightLobe', end: 'a' })
  g.connect({ seg: 'rightLobe', end: 'b' }, { seg: 'diagB', end: 'a' })
  g.connect({ seg: 'diagB', end: 'b' }, { seg: 'leftLobe', end: 'a' })
  g.connect({ seg: 'leftLobe', end: 'b' }, { seg: 'diagA', end: 'a' })

  g.spawn = { seg: 'diagA', s: 0.1, dir: 1 }
  return g
}

/** Where trains may run: layouts as data, for the picker and the scene. */
export type LayoutId = 'oval' | 'siding' | 'eight'

export interface TreeAnchor {
  x: number
  z: number
  scale?: number
}

export interface LayoutSpec {
  id: LayoutId
  name: string
  build: () => TrackGraph
  /** Whether the wayside station suits this layout. */
  station: boolean
  /** Where trees stand, clear of the running lines. */
  trees: TreeAnchor[]
}

export const LAYOUTS: LayoutSpec[] = [
  {
    id: 'siding',
    name: 'Oval + siding',
    build: () => makeOvalSidingGraph(),
    station: true,
    trees: [
      { x: -0.12, z: 0.02, scale: 1.1 },
      { x: 0.06, z: -0.06 },
      { x: 0.16, z: 0.05, scale: 0.8 },
      { x: -0.5, z: -0.28 },
      { x: -0.45, z: -0.33, scale: 0.75 },
      { x: 0.49, z: -0.3, scale: 1.15 },
      { x: 0.53, z: 0.27, scale: 0.85 },
    ],
  },
  {
    id: 'oval',
    name: 'Oval',
    build: () => makeOvalGraph(),
    station: true,
    trees: [
      { x: -0.12, z: 0.02, scale: 1.1 },
      { x: 0.06, z: -0.06 },
      { x: 0.16, z: 0.05, scale: 0.8 },
      { x: -0.5, z: -0.28 },
      { x: 0.49, z: -0.3, scale: 1.15 },
      { x: 0.52, z: 0.28 },
      { x: -0.52, z: 0.3, scale: 0.8 },
    ],
  },
  {
    id: 'eight',
    name: 'Figure of eight',
    build: () => makeFigureEightGraph(),
    station: false,
    trees: [
      { x: -0.28, z: 0.01, scale: 1.1 },
      { x: 0.28, z: -0.01 },
      { x: 0.02, z: 0.3, scale: 0.85 },
      { x: -0.04, z: -0.3 },
      { x: -0.52, z: -0.3, scale: 0.8 },
      { x: 0.52, z: 0.3, scale: 1.15 },
    ],
  },
]

export function layoutSpec(id: LayoutId): LayoutSpec {
  const spec = LAYOUTS.find((l) => l.id === id)
  if (!spec) throw new Error(`unknown layout: ${id}`)
  return spec
}

/**
 * A layout is sound if driving forward from spawn leaves home and comes
 * back round to it without falling off the end of the track.
 */
export function validateLoop(graph: TrackGraph, maxLength = 10): { ok: boolean; reason?: string } {
  const cursor = graph.createCursor(graph.spawn)
  const start = cursor.sample().position
  const step = 0.01
  let travelled = 0
  let left = false
  while (travelled < maxLength) {
    if (cursor.advance(step) < step - 1e-9) return { ok: false, reason: 'hit an end of line' }
    travelled += step
    const p = cursor.sample().position
    const home = Math.hypot(p.x - start.x, p.z - start.z)
    if (!left && home > 0.1) left = true
    if (left && home < 0.006) return { ok: true }
  }
  return { ok: false, reason: 'never returned to start' }
}
