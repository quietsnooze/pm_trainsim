import { describe, expect, it } from 'vitest'
import { TrackGraph } from './graph'
import { makeOvalGraph } from './layouts'
import { StraightSegment } from './track'
import { Train } from './train'

/** Long approach into a Y junction; legs diverge in ±z. */
function makeLongY(): TrackGraph {
  const g = new TrackGraph()
  g.addSegment('approach', new StraightSegment({ x: -1, z: 0 }, { x: 0.3, z: 0 }))
  g.addSegment('legA', new StraightSegment({ x: 0.3, z: 0 }, { x: 1.3, z: 0.15 }))
  g.addSegment('legB', new StraightSegment({ x: 0.3, z: 0 }, { x: 1.3, z: -0.15 }))
  g.addPoint('p1', { seg: 'approach', end: 'b' }, [
    { seg: 'legA', end: 'a' },
    { seg: 'legB', end: 'a' },
  ])
  g.spawn = { seg: 'approach', s: 0.6, dir: 1 }
  return g
}

/** Run updates until `done()` or the safety cap trips. */
function driveUntil(train: Train, done: () => boolean, cap = 5000): void {
  for (let i = 0; i < cap; i++) {
    train.update(1 / 60)
    if (done()) return
  }
  throw new Error('driveUntil: condition never met')
}

function dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

describe('Train on the oval', () => {
  it('keeps vehicle spacing through curves (samples behind head stay path-spaced)', () => {
    const train = new Train(makeOvalGraph())
    train.throttle = 1
    // Drive long enough to be mid-curve at some point; check as we go.
    for (let i = 0; i < 600; i++) {
      train.update(1 / 60)
      const head = train.sampleBehindHead(0).position
      const mid = train.sampleBehindHead(0.1).position
      const rear = train.sampleBehindHead(0.2).position
      // Chord distance: exactly the path spacing on straights, slightly
      // less on the r=0.22 curves, never more.
      for (const gap of [dist(head, mid), dist(mid, rear)]) {
        expect(gap).toBeLessThanOrEqual(0.1 + 1e-6)
        expect(gap).toBeGreaterThan(0.09)
      }
    }
  })
})

describe('Train through points', () => {
  it('coaches follow the route the loco took, even if the point flips behind it', () => {
    const g = makeLongY()
    const train = new Train(g, 0.2)
    train.throttle = 1

    // Drive until the head is clearly onto legA (+z side).
    driveUntil(train, () => train.sampleBehindHead(0).position.z > 0.02)
    // Flip the point against the route the train is straddling.
    g.setPoint('p1', 1)
    // Keep driving until the whole train has cleared the junction.
    driveUntil(train, () => train.sampleBehindHead(0.2).position.x > 0.35)
    // Every part of the train is on legA — nobody peeled off to legB.
    for (const d of [0, 0.05, 0.1, 0.15, 0.2]) {
      expect(train.sampleBehindHead(d).position.z).toBeGreaterThan(0)
    }
  })

  it('after running back out, the next approach honours the new point setting', () => {
    const g = makeLongY()
    const train = new Train(g, 0.2)

    // Out onto legA, then flip the point behind the train.
    train.throttle = 1
    driveUntil(train, () => train.sampleBehindHead(0.2).position.x > 0.35)
    g.setPoint('p1', 1)

    // Stop, reverse back through the junction (running through, along the
    // route we came in on), until fully back on the approach.
    train.throttle = 0
    driveUntil(train, () => train.speed === 0)
    expect(train.setDirection(-1)).toBe(true)
    train.throttle = 1
    driveUntil(train, () => train.sampleBehindHead(0).position.x < 0.2)

    // Stop and head out again: this time the point sends us down legB.
    train.throttle = 0
    driveUntil(train, () => train.speed === 0)
    expect(train.setDirection(1)).toBe(true)
    train.throttle = 1
    driveUntil(train, () => train.sampleBehindHead(0).position.x > 0.4)
    expect(train.sampleBehindHead(0).position.z).toBeLessThan(-0.005)
  })
})

describe('Train kinematics', () => {
  it('accelerates gently towards the throttle and coasts to a stop', () => {
    const train = new Train(makeOvalGraph())
    train.throttle = 1
    const speeds: number[] = []
    for (let i = 0; i < 300; i++) {
      train.update(1 / 60)
      speeds.push(train.speed)
    }
    expect(train.speed).toBeGreaterThan(0.2)
    // Monotonic-ish spin-up: no jerks.
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1] - 1e-9)
    train.throttle = 0
    driveUntil(train, () => train.speed === 0)
  })

  it('refuses to reverse while moving, allows it when stopped', () => {
    const train = new Train(makeOvalGraph())
    train.throttle = 1
    for (let i = 0; i < 60; i++) train.update(1 / 60)
    expect(train.setDirection(-1)).toBe(false)
    train.throttle = 0
    driveUntil(train, () => train.speed === 0)
    expect(train.setDirection(-1)).toBe(true)
  })
})

describe('Train at a buffer stop', () => {
  it('eases to rest at the end of the line and never passes it', () => {
    const g = new TrackGraph()
    g.addSegment('main', new StraightSegment({ x: 0, z: 0 }, { x: 1, z: 0 }))
    g.spawn = { seg: 'main', s: 0.5, dir: 1 }
    const train = new Train(g, 0.2)
    train.throttle = 1
    driveUntil(train, () => train.speed === 0)
    const head = train.sampleBehindHead(0).position
    expect(head.x).toBeLessThanOrEqual(1)
    expect(head.x).toBeGreaterThan(0.95) // got close before resting
    // And it can still pull away again in the other direction.
    expect(train.setDirection(-1)).toBe(true)
    train.throttle = 1
    driveUntil(train, () => train.sampleBehindHead(0).position.x < 0.9)
  })
})

describe('Train reversing beyond its history', () => {
  it('backs around the whole oval smoothly', () => {
    const train = new Train(makeOvalGraph())
    expect(train.setDirection(-1)).toBe(true)
    train.throttle = 1
    let prev = train.sampleBehindHead(0).position
    let travelled = 0
    for (let i = 0; i < 1500 && travelled < 2.5; i++) {
      train.update(1 / 60)
      const cur = train.sampleBehindHead(0).position
      const step = dist(prev, cur)
      expect(step).toBeLessThan(0.01) // continuous, no teleports
      travelled += step
      prev = cur
    }
    expect(travelled).toBeGreaterThan(2.4) // more than one full lap
  })
})
