/**
 * Track as a graph of geometric segments joined end-to-end, with points
 * (turnouts) as switchable junctions. No Three.js imports.
 *
 * Segment ends are named 'a' (local s = 0) and 'b' (local s = length).
 * A Cursor walks the graph by arc length, resolving each end-crossing via
 * the graph's connections and current point states.
 */
import type { PathSample, TrackSegment } from './track'

export type EndName = 'a' | 'b'

export interface EndRef {
  seg: string
  end: EndName
}

/** A cursor's position: segment, local arc length, direction of travel. */
export interface CursorState {
  seg: string
  s: number
  /** +1 = travelling towards end 'b', -1 = towards end 'a'. */
  dir: 1 | -1
}

function endKey(ref: EndRef): string {
  return `${ref.seg}:${ref.end}`
}

interface Point {
  toe: EndRef
  legs: [EndRef, EndRef]
  route: 0 | 1
}

export class TrackGraph {
  private readonly segments = new Map<string, TrackSegment>()
  private readonly links = new Map<string, EndRef>()
  private readonly points = new Map<string, Point>()
  /** endKey -> point id, for both the toe and each leg. */
  private readonly pointEnds = new Map<string, string>()
  /** Where trains start; set by the layout builder. */
  spawn: CursorState = { seg: '', s: 0, dir: 1 }

  addSegment(id: string, geometry: TrackSegment): void {
    this.segments.set(id, geometry)
  }

  segment(id: string): TrackSegment {
    const seg = this.segments.get(id)
    if (!seg) throw new Error(`unknown segment: ${id}`)
    return seg
  }

  /** Enumerate segments (for the scene layer to build meshes from). */
  forEachSegment(cb: (id: string, geometry: TrackSegment) => void): void {
    for (const [id, geom] of this.segments) cb(id, geom)
  }

  /** Join two segment ends so trains roll straight through. */
  connect(x: EndRef, y: EndRef): void {
    this.links.set(endKey(x), y)
    this.links.set(endKey(y), x)
  }

  /**
   * A point (turnout): leaving via the toe end takes the leg the point is
   * set for; leaving via either leg always runs through to the toe.
   */
  addPoint(id: string, toe: EndRef, legs: [EndRef, EndRef]): void {
    this.points.set(id, { toe, legs, route: 0 })
    this.pointEnds.set(endKey(toe), id)
    this.pointEnds.set(endKey(legs[0]), id)
    this.pointEnds.set(endKey(legs[1]), id)
  }

  setPoint(id: string, route: 0 | 1): void {
    const p = this.points.get(id)
    if (!p) throw new Error(`unknown point: ${id}`)
    p.route = route
  }

  getPoint(id: string): 0 | 1 {
    const p = this.points.get(id)
    if (!p) throw new Error(`unknown point: ${id}`)
    return p.route
  }

  /** The end reached when leaving via `from`, or null at end-of-line. */
  resolveExit(from: EndRef): EndRef | null {
    const pointId = this.pointEnds.get(endKey(from))
    if (pointId) {
      const p = this.points.get(pointId)!
      const key = endKey(from)
      return key === endKey(p.toe) ? p.legs[p.route] : p.toe
    }
    return this.links.get(endKey(from)) ?? null
  }

  createCursor(state: CursorState): Cursor {
    return new Cursor(this, { ...state })
  }
}

export class Cursor {
  constructor(
    private readonly graph: TrackGraph,
    private readonly state: CursorState,
  ) {}

  snapshot(): CursorState {
    return { ...this.state }
  }

  sample(): PathSample {
    const geom = this.graph.segment(this.state.seg)
    const { position, tangent } = geom.sampleAt(this.state.s)
    // Tangent always faces the direction of travel.
    return this.state.dir === 1
      ? { position, tangent }
      : { position, tangent: { x: -tangent.x, z: -tangent.z } }
  }

  /**
   * Move forward (in the cursor's direction of travel) by ds >= 0,
   * crossing segment ends as needed. Returns the distance actually moved
   * (less than ds only when hitting an end-of-line).
   */
  advance(ds: number): number {
    let remaining = ds
    while (remaining > 1e-12) {
      const geom = this.graph.segment(this.state.seg)
      const room = this.state.dir === 1 ? geom.length - this.state.s : this.state.s
      if (remaining <= room) {
        this.state.s += this.state.dir * remaining
        remaining = 0
        break
      }
      // Consume this segment and cross the end we're heading for.
      remaining -= room
      const exitEnd: EndName = this.state.dir === 1 ? 'b' : 'a'
      const next = this.graph.resolveExit({ seg: this.state.seg, end: exitEnd })
      if (!next) {
        // End of line (e.g. a buffer stop): park exactly at the end.
        this.state.s = this.state.dir === 1 ? geom.length : 0
        return ds - remaining
      }
      const nextGeom = this.graph.segment(next.seg)
      this.state.seg = next.seg
      if (next.end === 'a') {
        this.state.s = 0
        this.state.dir = 1
      } else {
        this.state.s = nextGeom.length
        this.state.dir = -1
      }
    }
    return ds
  }
}
