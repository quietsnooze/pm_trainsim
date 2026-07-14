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
