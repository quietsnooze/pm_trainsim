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
