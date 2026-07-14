/**
 * Sound scheduling logic — no WebAudio here. The director decides *when*
 * sounds happen (chuffs timed to distance rolled, whistle, point clunk)
 * and a backend decides *how* they sound. Injecting a fake backend makes
 * the timing fully testable.
 */

export interface SoundBackend {
  /** One exhaust beat; intensity 0..1 scales volume/brightness. */
  chuff(intensity: number): void
  whistle(): void
  clunk(): void
}

/** Top speed used to normalise chuff intensity (matches train kinematics). */
const MAX_SPEED = 0.25

export class SoundDirector {
  muted = false
  private distanceSinceChuff = 0

  constructor(
    private readonly backend: SoundBackend,
    /** How many exhaust beats per metre of travel. */
    private readonly chuffsPerMetre = 20,
  ) {}

  /** Advance by dt seconds at the given wheel speed (m/s). */
  update(dt: number, speed: number): void {
    if (speed <= 0) return
    this.distanceSinceChuff += speed * dt
    const interval = 1 / this.chuffsPerMetre
    while (this.distanceSinceChuff >= interval) {
      this.distanceSinceChuff -= interval
      if (!this.muted) {
        this.backend.chuff(Math.min(speed / MAX_SPEED, 1))
      }
    }
  }

  whistle(): void {
    if (!this.muted) this.backend.whistle()
  }

  pointClunk(): void {
    if (!this.muted) this.backend.clunk()
  }
}
