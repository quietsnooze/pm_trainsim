/**
 * Sound scheduling logic — no WebAudio here. The director decides *when*
 * sounds happen and a backend decides *how* they sound. Injecting a fake
 * backend makes the timing fully testable.
 */

import type { SoundFlavour } from './trains'

export interface SoundBackend {
  /**
   * One exhaust beat. `speedNorm` is the train's speed as 0..1 of top
   * speed; the backend voices it (slow = loud and laboured, fast =
   * quicker and quieter).
   */
  chuff(speedNorm: number): void
  whistle(): void
  clunk(): void
  /** Continuous traction hum level, 0..1 (0 = silent). Electric trains. */
  hum(level: number): void
  horn(): void
}

/** Top speed used to normalise (matches train kinematics). */
const MAX_SPEED = 0.25

export class SoundDirector {
  muted = false
  /** Steam chuffs and whistles; electric hums and hoots. */
  flavour: SoundFlavour = 'steam'
  /**
   * Fired on every exhaust beat regardless of mute — visual listeners
   * (smoke puffs) hang off this; mute only gates the audio backend.
   */
  onBeat?: (speedNorm: number) => void
  private phase = 0

  constructor(
    private readonly backend: SoundBackend,
    /** Exhaust beats per second at full speed. */
    private readonly maxChuffRate = 5,
  ) {}

  /**
   * Advance by dt seconds at the given speed (m/s). The chuff rate follows
   * a square-root curve: barely-moving gives slow deliberate beats, but a
   * modest crawl already has a lively rhythm, and doubling speed does not
   * double the beat.
   */
  update(dt: number, speed: number): void {
    if (this.flavour === 'electric') {
      const level = this.muted || speed <= 0 ? 0 : Math.min(speed / MAX_SPEED, 1)
      this.backend.hum(level)
      return
    }
    this.backend.hum(0) // silence any leftover hum after a swap to steam
    if (speed <= 0) return
    const speedNorm = Math.min(speed / MAX_SPEED, 1)
    const rate = this.maxChuffRate * Math.sqrt(speedNorm)
    this.phase += rate * dt
    while (this.phase >= 1) {
      this.phase -= 1
      this.onBeat?.(speedNorm)
      if (!this.muted) this.backend.chuff(speedNorm)
    }
  }

  whistle(): void {
    if (this.muted) return
    if (this.flavour === 'electric') this.backend.horn()
    else this.backend.whistle()
  }

  pointClunk(): void {
    if (!this.muted) this.backend.clunk()
  }
}
