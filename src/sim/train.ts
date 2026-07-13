import type { TrackPath } from './track'

/** Top speed at full throttle, in tabletop metres per second. */
const MAX_SPEED = 0.25
/** How quickly actual speed chases target speed (per second). */
const ACCEL_RATE = 2.5

export type Direction = 1 | -1

/**
 * Driving state for one train: where it is along the track (`s`), how fast
 * it's actually moving, and what the controller is asking for. Purely
 * kinematic — the scene layer samples the path to pose the meshes.
 */
export class Train {
  s = 0
  speed = 0
  direction: Direction = 1
  /** 0..1, set by the controller. */
  throttle = 0

  constructor(readonly track: TrackPath) {}

  /** Reversing is only allowed once the train has (nearly) stopped. */
  setDirection(dir: Direction): boolean {
    if (Math.abs(this.speed) > 0.005) return false
    this.direction = dir
    return true
  }

  update(dt: number): void {
    const target = this.throttle * MAX_SPEED
    // Exponential approach: smooth spin-up and coast-down.
    const blend = 1 - Math.exp(-ACCEL_RATE * dt)
    this.speed += (target - this.speed) * blend
    if (this.speed < 0.0005 && this.throttle === 0) this.speed = 0
    this.s = this.track.wrap(this.s + this.speed * this.direction * dt)
  }
}
