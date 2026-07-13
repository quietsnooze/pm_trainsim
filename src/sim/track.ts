/**
 * Track geometry as a parametric path addressed by arc length.
 *
 * Everything lives in the horizontal (x, z) plane of the tabletop; the scene
 * layer decides what height to draw things at. No Three.js imports here.
 */

export interface Vec2 {
  x: number
  z: number
}

/** Position and unit tangent at a point along the path. */
export interface PathSample {
  position: Vec2
  tangent: Vec2
}

export interface TrackSegment {
  readonly length: number
  /** Sample at local arc length s, 0 <= s <= length. */
  sampleAt(s: number): PathSample
}

export class StraightSegment implements TrackSegment {
  readonly length: number
  private readonly dir: Vec2

  constructor(
    private readonly start: Vec2,
    end: Vec2,
  ) {
    const dx = end.x - start.x
    const dz = end.z - start.z
    this.length = Math.hypot(dx, dz)
    this.dir = { x: dx / this.length, z: dz / this.length }
  }

  sampleAt(s: number): PathSample {
    return {
      position: {
        x: this.start.x + this.dir.x * s,
        z: this.start.z + this.dir.z * s,
      },
      tangent: { ...this.dir },
    }
  }
}

export class ArcSegment implements TrackSegment {
  readonly length: number

  /**
   * Circular arc around `center`, starting at `startAngle` (radians, measured
   * in the x-z plane: angle 0 is +x, angle pi/2 is +z) and sweeping
   * `sweep` radians (positive = towards +z, i.e. increasing angle).
   */
  constructor(
    private readonly center: Vec2,
    private readonly radius: number,
    private readonly startAngle: number,
    private readonly sweep: number,
  ) {
    this.length = Math.abs(sweep) * radius
  }

  sampleAt(s: number): PathSample {
    const dirSign = Math.sign(this.sweep)
    const a = this.startAngle + (s / this.radius) * dirSign
    return {
      position: {
        x: this.center.x + this.radius * Math.cos(a),
        z: this.center.z + this.radius * Math.sin(a),
      },
      // Derivative of position w.r.t. arc length, already unit length.
      tangent: {
        x: -Math.sin(a) * dirSign,
        z: Math.cos(a) * dirSign,
      },
    }
  }
}

/**
 * A closed loop of segments. Arc length `s` wraps modulo the total length,
 * so callers can advance a train's `s` forever in either direction.
 */
export class TrackPath {
  readonly totalLength: number
  private readonly starts: number[]

  constructor(private readonly segments: TrackSegment[]) {
    this.starts = []
    let acc = 0
    for (const seg of segments) {
      this.starts.push(acc)
      acc += seg.length
    }
    this.totalLength = acc
  }

  wrap(s: number): number {
    const t = s % this.totalLength
    return t < 0 ? t + this.totalLength : t
  }

  sampleAt(s: number): PathSample {
    const sw = this.wrap(s)
    // Linear scan is fine: layouts have a handful of segments.
    for (let i = this.segments.length - 1; i >= 0; i--) {
      if (sw >= this.starts[i]) {
        return this.segments[i].sampleAt(sw - this.starts[i])
      }
    }
    return this.segments[0].sampleAt(0)
  }
}

/** Track gauge (rail-to-rail spacing) in tabletop metres. */
export const GAUGE = 0.03

/**
 * The starter layout: a small oval, two straights joined by two semicircles,
 * centred on the origin.
 */
export function makeOvalTrack(straightLength = 0.5, radius = 0.22): TrackPath {
  const l = straightLength / 2
  const r = radius
  return new TrackPath([
    // Far straight (z = +r), running left to right.
    new StraightSegment({ x: -l, z: r }, { x: l, z: r }),
    // Right-hand semicircle, from angle +90deg down through 0 to -90deg.
    new ArcSegment({ x: l, z: 0 }, r, Math.PI / 2, -Math.PI),
    // Near straight (z = -r), running right to left.
    new StraightSegment({ x: l, z: -r }, { x: -l, z: -r }),
    // Left-hand semicircle, closing the loop.
    new ArcSegment({ x: -l, z: 0 }, r, -Math.PI / 2, -Math.PI),
  ])
}
