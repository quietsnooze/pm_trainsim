import * as THREE from 'three'
import { setGlowLevel } from './glow'

/** How long the day↔night transition takes, roughly. */
const TRANSITION_SECONDS = 1.6

const DAY = {
  sunIntensity: 2.2,
  sunColor: new THREE.Color('#fff2dd'),
  hemiIntensity: 0.9,
  hemiSky: new THREE.Color('#dfe8ff'),
  background: new THREE.Color('#20242b'),
}
const NIGHT = {
  sunIntensity: 0.22,
  sunColor: new THREE.Color('#b8c8e8'), // moonlight
  hemiIntensity: 0.32,
  hemiSky: new THREE.Color('#2a3450'),
  background: new THREE.Color('#0b0e14'),
}

/**
 * Day/night rig: eases the lighting between a warm afternoon and a calm
 * moonlit night, bringing the registered glow materials (lamps, windows)
 * up as the light goes down. No sudden flashes — this is a bedtime toy.
 */
export class DayNight {
  night = false
  private t = 0 // 0 = day, 1 = night

  constructor(
    private readonly scene: THREE.Scene,
    private readonly hemi: THREE.HemisphereLight,
    private readonly sun: THREE.DirectionalLight,
  ) {}

  toggle(): boolean {
    this.night = !this.night
    return this.night
  }

  update(dt: number): void {
    const target = this.night ? 1 : 0
    const step = dt / TRANSITION_SECONDS
    if (Math.abs(target - this.t) < 1e-4 && this.t !== target) this.t = target
    this.t += Math.sign(target - this.t) * Math.min(step, Math.abs(target - this.t))
    const s = this.t * this.t * (3 - 2 * this.t) // smoothstep

    this.sun.intensity = DAY.sunIntensity + (NIGHT.sunIntensity - DAY.sunIntensity) * s
    this.sun.color.lerpColors(DAY.sunColor, NIGHT.sunColor, s)
    this.hemi.intensity = DAY.hemiIntensity + (NIGHT.hemiIntensity - DAY.hemiIntensity) * s
    this.hemi.color.lerpColors(DAY.hemiSky, NIGHT.hemiSky, s)
    ;(this.scene.background as THREE.Color).lerpColors(DAY.background, NIGHT.background, s)
    setGlowLevel(s * 1.2)
  }
}
