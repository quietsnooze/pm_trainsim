import { describe, expect, it } from 'vitest'
import { TrackGraph } from './graph'
import { makeOvalGraph } from './layouts'
import { StraightSegment } from './track'

/** A simple Y: approach segment into a point that fans to two diverging legs. */
function makeYJunction(): TrackGraph {
  const g = new TrackGraph()
  g.addSegment('approach', new StraightSegment({ x: 0, z: 0 }, { x: 0.3, z: 0 }))
  g.addSegment('legA', new StraightSegment({ x: 0.3, z: 0 }, { x: 0.6, z: 0.05 }))
  g.addSegment('legB', new StraightSegment({ x: 0.3, z: 0 }, { x: 0.6, z: -0.05 }))
  g.addPoint('p1', { seg: 'approach', end: 'b' }, [
    { seg: 'legA', end: 'a' },
    { seg: 'legB', end: 'a' },
  ])
  g.spawn = { seg: 'approach', s: 0, dir: 1 }
  return g
}

const STRAIGHT = 0.5
const RADIUS = 0.22
const OVAL_LENGTH = 2 * STRAIGHT + 2 * Math.PI * RADIUS

describe('track graph: oval loop', () => {
  it('a cursor advances continuously around the loop and returns home', () => {
    const graph = makeOvalGraph(STRAIGHT, RADIUS)
    const cursor = graph.createCursor(graph.spawn)

    const start = cursor.sample()
    let prev = start
    const step = 0.005
    let travelled = 0
    while (travelled < OVAL_LENGTH) {
      const ds = Math.min(step, OVAL_LENGTH - travelled)
      cursor.advance(ds)
      travelled += ds
      const cur = cursor.sample()
      // Continuity: no jumps bigger than the step (with slack for arcs).
      const jump = Math.hypot(cur.position.x - prev.position.x, cur.position.z - prev.position.z)
      expect(jump).toBeLessThan(step * 1.5)
      // Unit tangent throughout.
      expect(Math.hypot(cur.tangent.x, cur.tangent.z)).toBeCloseTo(1, 6)
      prev = cur
    }
    // One full lap lands back at the start, same heading.
    const end = cursor.sample()
    expect(end.position.x).toBeCloseTo(start.position.x, 3)
    expect(end.position.z).toBeCloseTo(start.position.z, 3)
    expect(end.tangent.x).toBeCloseTo(start.tangent.x, 3)
    expect(end.tangent.z).toBeCloseTo(start.tangent.z, 3)
  })
})

describe('track graph: points', () => {
  it('routes a facing cursor down the leg the point is set for', () => {
    const g = makeYJunction()

    const viaA = g.createCursor(g.spawn)
    viaA.advance(0.4) // 0.3 through the approach + 0.1 into a leg
    expect(viaA.sample().position.z).toBeGreaterThan(0.005) // on legA (+z side)

    g.setPoint('p1', 1)
    const viaB = g.createCursor(g.spawn)
    viaB.advance(0.4)
    expect(viaB.sample().position.z).toBeLessThan(-0.005) // on legB (-z side)
  })

  it('a trailing move from either leg runs through to the approach regardless of state', () => {
    const g = makeYJunction()
    g.setPoint('p1', 1) // set against legA
    // Start on legA facing back towards the junction.
    const cursor = g.createCursor({ seg: 'legA', s: 0.1, dir: -1 })
    cursor.advance(0.2)
    const { position } = cursor.sample()
    // Ran through the point onto the approach segment.
    expect(position.z).toBeCloseTo(0, 6)
    expect(position.x).toBeCloseTo(0.2, 3)
  })
})
