import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Train } from '../sim/train'

/** Camera sits 70° off the loco's nose — front-three-quarter view. */
const VIEW_ANGLE = (70 * Math.PI) / 180
const DISTANCE = 0.44
/** Roughly level with the engine (loco roof is ~0.045). */
const HEIGHT = 0.06
/** Distance from train head to the loco's visual centre. */
const LOCO_CENTER = 0.056
const SMOOTHING = 5

/**
 * Follow mode: the camera rides alongside the engine, level with it,
 * holding a front-three-quarter angle as it goes round. Smoothed so
 * curves feel like leaning, not snapping.
 */
export class FollowCam {
  enabled = false
  private readonly lookAt = new THREE.Vector3()

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly orbit: OrbitControls,
    private readonly train: Train,
  ) {}

  /** Returns the new enabled state. */
  toggle(): boolean {
    this.enabled = !this.enabled
    this.orbit.enabled = !this.enabled
    if (this.enabled) {
      this.lookAt.copy(this.orbit.target)
    } else {
      // Hand control back to the orbit, aimed where we were looking.
      this.orbit.target.copy(this.lookAt)
      this.orbit.update()
    }
    return this.enabled
  }

  update(dt: number): void {
    if (!this.enabled) return
    const { position, tangent } = this.train.sampleBehindHead(LOCO_CENTER)
    const heading = Math.atan2(-tangent.z, tangent.x)
    const a = heading - VIEW_ANGLE
    const want = new THREE.Vector3(
      position.x + Math.cos(a) * DISTANCE,
      HEIGHT,
      position.z - Math.sin(a) * DISTANCE,
    )
    const blend = 1 - Math.exp(-SMOOTHING * dt)
    this.camera.position.lerp(want, blend)
    this.lookAt.lerp(new THREE.Vector3(position.x, 0.028, position.z), blend)
    this.camera.lookAt(this.lookAt)
  }
}
