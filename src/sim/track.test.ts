import { describe, expect, it } from 'vitest'
import { makeOvalTrack } from './track'
import { Train } from './train'

const STRAIGHT = 0.5
const RADIUS = 0.22

describe('makeOvalTrack', () => {
  const track = makeOvalTrack(STRAIGHT, RADIUS)

  it('has the analytic total length of the oval', () => {
    expect(track.totalLength).toBeCloseTo(2 * STRAIGHT + 2 * Math.PI * RADIUS, 10)
  })

  it('is a closed loop: s wraps modulo total length', () => {
    for (const s of [0.1, 1.3, track.totalLength * 0.99]) {
      const a = track.sampleAt(s)
      const b = track.sampleAt(s + track.totalLength)
      const c = track.sampleAt(s - track.totalLength)
      expect(b.position.x).toBeCloseTo(a.position.x, 10)
      expect(b.position.z).toBeCloseTo(a.position.z, 10)
      expect(c.position.x).toBeCloseTo(a.position.x, 10)
      expect(c.position.z).toBeCloseTo(a.position.z, 10)
    }
  })

  it('is continuous in position and tangent across segment joins', () => {
    const eps = 1e-6
    // Joins occur at cumulative segment lengths.
    const joins = [
      0,
      STRAIGHT,
      STRAIGHT + Math.PI * RADIUS,
      2 * STRAIGHT + Math.PI * RADIUS,
    ]
    for (const s of joins) {
      const before = track.sampleAt(s - eps)
      const after = track.sampleAt(s + eps)
      expect(after.position.x).toBeCloseTo(before.position.x, 4)
      expect(after.position.z).toBeCloseTo(before.position.z, 4)
      expect(after.tangent.x).toBeCloseTo(before.tangent.x, 4)
      expect(after.tangent.z).toBeCloseTo(before.tangent.z, 4)
    }
  })

  it('always returns a unit tangent', () => {
    for (let i = 0; i < 100; i++) {
      const { tangent } = track.sampleAt((i / 100) * track.totalLength)
      expect(Math.hypot(tangent.x, tangent.z)).toBeCloseTo(1, 10)
    }
  })

  it('stays on the oval envelope', () => {
    // Every point is either on a straight (|z| = r) or on an end semicircle.
    for (let i = 0; i < 200; i++) {
      const { position } = track.sampleAt((i / 200) * track.totalLength)
      const onStraight =
        Math.abs(Math.abs(position.z) - RADIUS) < 1e-9 &&
        Math.abs(position.x) <= STRAIGHT / 2 + 1e-9
      const distRight = Math.hypot(position.x - STRAIGHT / 2, position.z)
      const distLeft = Math.hypot(position.x + STRAIGHT / 2, position.z)
      const onArc =
        Math.abs(distRight - RADIUS) < 1e-9 || Math.abs(distLeft - RADIUS) < 1e-9
      expect(onStraight || onArc).toBe(true)
    }
  })
})

describe('Train', () => {
  it('accelerates towards throttle and moves along the track', () => {
    const track = makeOvalTrack()
    const train = new Train(track)
    train.throttle = 1
    for (let i = 0; i < 300; i++) train.update(1 / 60)
    expect(train.speed).toBeGreaterThan(0.2)
    expect(train.s).toBeGreaterThan(0)
    expect(train.s).toBeLessThan(track.totalLength)
  })

  it('refuses to reverse while moving, allows it when stopped', () => {
    const track = makeOvalTrack()
    const train = new Train(track)
    train.throttle = 1
    for (let i = 0; i < 60; i++) train.update(1 / 60)
    expect(train.setDirection(-1)).toBe(false)
    train.throttle = 0
    for (let i = 0; i < 600; i++) train.update(1 / 60)
    expect(train.setDirection(-1)).toBe(true)
    expect(train.direction).toBe(-1)
  })
})
