import type { Cursor, CursorState, TrackGraph } from './graph'
import type { PathSample } from './track'

import type { KinematicsProfile } from './trains'

/** Default character: Mallard-ish. */
const DEFAULT_PROFILE: KinematicsProfile = { maxSpeed: 0.25, accel: 2.5 }
/** Breadcrumb spacing along the travelled path. */
const RIBBON_STEP = 0.01
/** Extra ribbon kept beyond each end of the train. */
const MARGIN = 0.06

export type Direction = 1 | -1

/** One breadcrumb: pose plus the graph cursor state that produced it. */
interface Crumb {
  x: number
  z: number
  tx: number
  tz: number
  /** Cursor state at this spot, facing ribbon-forward (towards the head). */
  state: CursorState
}

function flip(state: CursorState): CursorState {
  return { ...state, dir: (state.dir * -1) as Direction }
}

/**
 * A train on the track graph.
 *
 * The core trick is the travelled-path ribbon: a breadcrumb trail of where
 * the head of the train has actually been. Vehicles sample the ribbon at
 * fixed distances behind the head, so the whole rake always follows the
 * route the locomotive took — flipping a point behind a moving train can
 * never split it. Only the ribbon's two ends ever consult the graph (and
 * therefore the current point states).
 */
export class Train {
  speed = 0
  direction: Direction = 1
  /** 0..1, set by the controller. */
  throttle = 0

  private crumbs: Crumb[] = []
  /** Ribbon coordinate of crumbs[0]; coordinates increase towards the head. */
  private dFirst = 0
  /** Ribbon coordinate of the head of the train. */
  private headD = 0
  private headCursor: Cursor
  private tailCursor: Cursor

  constructor(
    readonly graph: TrackGraph,
    /** Path length the consist occupies behind the head. */
    readonly length = 0.45,
    /** Per-train character: top speed and how eagerly it chases it. */
    readonly profile: KinematicsProfile = DEFAULT_PROFILE,
  ) {
    // Head starts at the spawn point; walk backwards to lay ribbon under
    // where the coaches will sit.
    this.headCursor = graph.createCursor(graph.spawn)
    const back = graph.createCursor(flip(graph.spawn))
    const tailward: Crumb[] = []
    const steps = Math.ceil((this.length + MARGIN) / RIBBON_STEP)
    for (let i = 0; i < steps; i++) {
      if (back.advance(RIBBON_STEP) < RIBBON_STEP - 1e-9) break
      tailward.push(this.crumbFrom(back, true))
    }
    this.crumbs = tailward.reverse()
    this.crumbs.push(this.crumbFrom(this.headCursor, false))
    this.headD = (this.crumbs.length - 1) * RIBBON_STEP
    this.dFirst = 0
    this.tailCursor = graph.createCursor(flip(this.crumbs[0].state))
  }

  /** Pose at `d` behind the head (0 = head), tangent facing ribbon-forward. */
  sampleBehindHead(d: number): PathSample {
    return this.sampleAt(this.headD - d)
  }

  /**
   * Signed distance rolled since spawn (decreases when reversing) — what
   * the scene layer spins the wheels by.
   */
  get travelled(): number {
    return this.headD
  }

  /** Reversing is only allowed once the train has (nearly) stopped. */
  setDirection(dir: Direction): boolean {
    if (Math.abs(this.speed) > 0.005) return false
    this.direction = dir
    return true
  }

  update(dt: number): void {
    const target = this.throttle * this.profile.maxSpeed
    const blend = 1 - Math.exp(-this.profile.accel * dt)
    this.speed += (target - this.speed) * blend
    if (this.speed < 0.0005 && this.throttle === 0) this.speed = 0
    const delta = this.speed * dt
    if (delta <= 0) return
    if (this.direction === 1) this.moveForward(delta)
    else this.moveBackward(delta)
  }

  // --- ribbon internals ---

  private crumbFrom(cursor: Cursor, movingTailward: boolean): Crumb {
    const { position, tangent } = cursor.sample()
    const sign = movingTailward ? -1 : 1
    const state = movingTailward ? flip(cursor.snapshot()) : cursor.snapshot()
    return { x: position.x, z: position.z, tx: sign * tangent.x, tz: sign * tangent.z, state }
  }

  private get dLast(): number {
    return this.dFirst + (this.crumbs.length - 1) * RIBBON_STEP
  }

  private sampleAt(d: number): PathSample {
    const clamped = Math.min(Math.max(d, this.dFirst), this.dLast)
    const f = (clamped - this.dFirst) / RIBBON_STEP
    const i = Math.min(Math.floor(f), this.crumbs.length - 2)
    const a = this.crumbs[Math.max(i, 0)]
    const b = this.crumbs[Math.min(Math.max(i, 0) + 1, this.crumbs.length - 1)]
    const t = Math.min(Math.max(f - i, 0), 1)
    const tx = a.tx + (b.tx - a.tx) * t
    const tz = a.tz + (b.tz - a.tz) * t
    const norm = Math.hypot(tx, tz) || 1
    return {
      position: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t },
      tangent: { x: tx / norm, z: tz / norm },
    }
  }

  /** Grow the ribbon headwards to cover `target`; false if track ran out. */
  private extendHeadTo(target: number): boolean {
    while (this.dLast < target) {
      if (this.headCursor.advance(RIBBON_STEP) < RIBBON_STEP - 1e-9) return false
      this.crumbs.push(this.crumbFrom(this.headCursor, false))
    }
    return true
  }

  /** Grow the ribbon tailwards to cover `target`; false if track ran out. */
  private extendTailTo(target: number): boolean {
    while (this.dFirst > target) {
      if (this.tailCursor.advance(RIBBON_STEP) < RIBBON_STEP - 1e-9) return false
      this.crumbs.unshift(this.crumbFrom(this.tailCursor, true))
      this.dFirst -= RIBBON_STEP
    }
    return true
  }

  private moveForward(delta: number): void {
    const blocked = !this.extendHeadTo(this.headD + delta)
    this.headD = Math.min(this.headD + delta, this.dLast)
    if (blocked) this.speed = 0 // buffer stop: ease to rest, no drama
    // Trim ribbon we no longer need behind the train.
    let drop = 0
    while (this.dFirst + (drop + 1) * RIBBON_STEP < this.headD - this.length - MARGIN) drop++
    if (drop > 0) {
      this.crumbs.splice(0, drop)
      this.dFirst += drop * RIBBON_STEP
      this.tailCursor = this.graph.createCursor(flip(this.crumbs[0].state))
    }
  }

  private moveBackward(delta: number): void {
    const rearTarget = this.headD - this.length - delta
    const blocked = !this.extendTailTo(rearTarget)
    this.headD = Math.max(this.headD - delta, this.dFirst + this.length)
    if (blocked) this.speed = 0
    // Trim ribbon we no longer need ahead of the train.
    let drop = 0
    while (this.dLast - (drop + 1) * RIBBON_STEP > this.headD + MARGIN) drop++
    if (drop > 0) {
      this.crumbs.splice(this.crumbs.length - drop, drop)
      this.headCursor = this.graph.createCursor(this.crumbs[this.crumbs.length - 1].state)
    }
  }
}
