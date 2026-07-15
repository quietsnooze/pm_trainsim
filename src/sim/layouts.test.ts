import { describe, expect, it } from 'vitest'
import { TrackGraph } from './graph'
import { LAYOUTS, makeFigureEightGraph, makeOvalSidingGraph, SIDING_Z, validateLoop } from './layouts'
import { StraightSegment } from './track'
import { Train } from './train'

function driveUntil(train: Train, done: () => boolean, cap = 8000): void {
  for (let i = 0; i < cap; i++) {
    train.update(1 / 60)
    if (done()) return
  }
  throw new Error('driveUntil: condition never met')
}

describe('oval + siding layout', () => {
  it('with the point set to main, the train laps the loop and comes home', () => {
    const g = makeOvalSidingGraph()
    const train = new Train(g)
    const start = train.sampleBehindHead(0).position
    train.throttle = 1
    // Leave the start area, then come back around to it.
    driveUntil(train, () => {
      const p = train.sampleBehindHead(0).position
      return Math.hypot(p.x - start.x, p.z - start.z) > 0.3
    })
    driveUntil(train, () => {
      const p = train.sampleBehindHead(0).position
      return Math.hypot(p.x - start.x, p.z - start.z) < 0.02
    })
    // Never wandered onto the siding.
    expect(train.speed).toBeGreaterThan(0)
  })

  it('with the point set to siding, the train buffer-stops in the siding and can reverse out', () => {
    const g = makeOvalSidingGraph()
    g.setPoint('p1', 1)
    const train = new Train(g)
    train.throttle = 1
    // Runs into the siding and eases to a halt at the buffer.
    driveUntil(train, () => train.speed === 0 && train.throttle === 1)
    const head = train.sampleBehindHead(0)
    expect(head.position.z).toBeCloseTo(SIDING_Z, 3)

    // Reverse back out to the main line.
    train.throttle = 0
    train.update(1 / 60)
    expect(train.setDirection(-1)).toBe(true)
    train.throttle = 1
    driveUntil(train, () => Math.abs(train.sampleBehindHead(0).position.z - SIDING_Z) > 0.05)
    expect(train.speed).toBeGreaterThan(0)
  })

  it('exposes its point to the scene layer with a usable toe position', () => {
    const g = makeOvalSidingGraph()
    const points: Array<{ id: string; x: number; z: number }> = []
    g.forEachPoint((id, info) => points.push({ id, x: info.position.x, z: info.position.z }))
    expect(points).toHaveLength(1)
    expect(points[0].id).toBe('p1')
    // The junction sits on the main straight nearest the camera (z = +0.22).
    expect(points[0].z).toBeCloseTo(0.22, 3)
  })
})

describe('layout catalogue', () => {
  it('every shipped layout is a sound loop', () => {
    for (const spec of LAYOUTS) {
      const result = validateLoop(spec.build())
      expect(result.ok, `${spec.id}: ${result.reason ?? ''}`).toBe(true)
    }
  })

  it('the validator rejects a broken layout (dead end on the main line)', () => {
    const g = new TrackGraph()
    g.addSegment('main', new StraightSegment({ x: 0, z: 0 }, { x: 1, z: 0 }))
    g.spawn = { seg: 'main', s: 0, dir: 1 }
    const result = validateLoop(g)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/end of line/)
  })

  it('figure-of-eight: both diagonals pass through the crossing at the middle', () => {
    const g = makeFigureEightGraph()
    const a = g.createCursor({ seg: 'diagA', s: 0, dir: 1 })
    a.advance(g.segment('diagA').length / 2)
    const b = g.createCursor({ seg: 'diagB', s: 0, dir: 1 })
    b.advance(g.segment('diagB').length / 2)
    expect(Math.hypot(a.sample().position.x, a.sample().position.z)).toBeLessThan(1e-9)
    expect(Math.hypot(b.sample().position.x, b.sample().position.z)).toBeLessThan(1e-9)
  })

  it('figure-of-eight fits the baseboard', () => {
    const g = makeFigureEightGraph()
    const cursor = g.createCursor(g.spawn)
    for (let i = 0; i < 500; i++) {
      cursor.advance(0.005)
      const { position } = cursor.sample()
      expect(Math.abs(position.x)).toBeLessThan(0.56)
      expect(Math.abs(position.z)).toBeLessThan(0.36)
    }
  })
})
