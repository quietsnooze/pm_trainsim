import { describe, expect, it } from 'vitest'
import { ArcSegment, StraightSegment } from './track'

describe('segment geometry', () => {
  it('straight: correct length, endpoints, and constant unit tangent', () => {
    const seg = new StraightSegment({ x: 0, z: 0 }, { x: 0.3, z: 0.4 })
    expect(seg.length).toBeCloseTo(0.5, 10)
    expect(seg.sampleAt(0).position).toEqual({ x: 0, z: 0 })
    const end = seg.sampleAt(seg.length).position
    expect(end.x).toBeCloseTo(0.3, 10)
    expect(end.z).toBeCloseTo(0.4, 10)
    const { tangent } = seg.sampleAt(0.25)
    expect(Math.hypot(tangent.x, tangent.z)).toBeCloseTo(1, 10)
    expect(tangent.x).toBeCloseTo(0.6, 10)
    expect(tangent.z).toBeCloseTo(0.8, 10)
  })

  it('arc: correct length, stays on the circle, unit tangent perpendicular to radius', () => {
    const r = 0.22
    const seg = new ArcSegment({ x: 1, z: 2 }, r, Math.PI / 2, -Math.PI)
    expect(seg.length).toBeCloseTo(Math.PI * r, 10)
    for (const s of [0, seg.length * 0.3, seg.length]) {
      const { position, tangent } = seg.sampleAt(s)
      expect(Math.hypot(position.x - 1, position.z - 2)).toBeCloseTo(r, 10)
      expect(Math.hypot(tangent.x, tangent.z)).toBeCloseTo(1, 10)
      // Tangent ⟂ radius vector.
      const dot = (position.x - 1) * tangent.x + (position.z - 2) * tangent.z
      expect(dot).toBeCloseTo(0, 10)
    }
  })
})
