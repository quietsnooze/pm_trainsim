import { describe, expect, it } from 'vitest'
import { makeOvalSidingGraph, SIDING_Z } from './layouts'
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
