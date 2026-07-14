import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Train } from '../sim/train'

/** Camera sits 70° off the loco's nose — front-three-quarter view. */
const VIEW_ANGLE = (70 * Math.PI) / 180
const DISTANCE = 0.44
/** Down at wheel height — the driving wheels are the show. */
const HEIGHT = 0.038
/** Distance from train head to the loco's visual centre. */
const LOCO_CENTER = 0.056
/** Matches train kinematics top speed, for normalising. */
const MAX_SPEED = 0.25
const SMOOTHING = 6.5
/** How long the glide back to the tabletop view takes. */
const RETURN_SECONDS = 0.9

export interface HomePose {
  position: THREE.Vector3
  target: THREE.Vector3
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * Follow mode: the camera rides alongside the engine, level with it,
 * holding a front-three-quarter angle. At speed it aims ahead of the
 * engine so the nose never outruns the frame. Switching off glides the
 * camera back to the tabletop framing rather than leaving it trackside.
 */
export class FollowCam {
  enabled = false
  private readonly lookAt = new THREE.Vector3()
  /** 0..1 while gliding home after follow mode ends; >=1 = idle. */
  private returnT = 1
  private readonly returnFromPos = new THREE.Vector3()
  private readonly returnFromLook = new THREE.Vector3()

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly orbit: OrbitControls,
    private readonly getTrain: () => Train,
    private readonly home: () => HomePose,
  ) {}

  /** True while this controller owns the camera (following or returning). */
  get active(): boolean {
    return this.enabled || this.returnT < 1
  }

  /** Returns the new enabled state. */
  toggle(): boolean {
    this.enabled = !this.enabled
    this.orbit.enabled = false
    if (this.enabled) {
      this.returnT = 1
      this.lookAt.copy(this.orbit.target)
    } else {
      // Glide back to the tabletop view from wherever we are.
      this.returnT = 0
      this.returnFromPos.copy(this.camera.position)
      this.returnFromLook.copy(this.lookAt)
    }
    return this.enabled
  }

  update(dt: number): void {
    if (this.enabled) {
      this.follow(dt)
    } else if (this.returnT < 1) {
      this.glideHome(dt)
    }
  }

  private follow(dt: number): void {
    const train = this.getTrain()
    const { position, tangent } = train.sampleBehindHead(LOCO_CENTER)
    // Anchor ahead of the engine in the direction of travel, further the
    // faster she goes, so the nose keeps clear space in front of it.
    // Lead ≈ the smoothing lag (speed / SMOOTHING) plus a little margin,
    // so the nose keeps clear space without falling out the back of frame.
    const speedNorm = Math.min(train.speed / MAX_SPEED, 1)
    const lead = (0.02 + speedNorm * 0.04) * train.direction
    const ax = position.x + tangent.x * lead
    const az = position.z + tangent.z * lead
    const heading = Math.atan2(-tangent.z, tangent.x)
    const a = heading - VIEW_ANGLE
    const want = new THREE.Vector3(ax + Math.cos(a) * DISTANCE, HEIGHT, az - Math.sin(a) * DISTANCE)
    const blend = 1 - Math.exp(-SMOOTHING * dt)
    this.camera.position.lerp(want, blend)
    this.lookAt.lerp(new THREE.Vector3(ax, 0.02, az), blend)
    this.camera.lookAt(this.lookAt)
  }

  private glideHome(dt: number): void {
    this.returnT = Math.min(this.returnT + dt / RETURN_SECONDS, 1)
    const t = smoothstep(this.returnT)
    const home = this.home()
    this.camera.position.lerpVectors(this.returnFromPos, home.position, t)
    this.lookAt.lerpVectors(this.returnFromLook, home.target, t)
    this.camera.lookAt(this.lookAt)
    if (this.returnT >= 1) {
      // Hand the camera back to the orbit, centred on the board.
      this.orbit.target.copy(home.target)
      this.orbit.enabled = true
      this.orbit.update()
    }
  }
}
