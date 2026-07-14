import * as THREE from 'three'

const POOL_SIZE = 36
const LIFE_SECONDS = 2.2

/** Soft radial-gradient blob drawn on a canvas — no image assets. */
function makePuffTexture(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(235,232,226,0.85)')
  grad.addColorStop(0.55, 'rgba(225,222,216,0.35)')
  grad.addColorStop(1, 'rgba(220,218,212,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

interface Puff {
  sprite: THREE.Sprite
  age: number
  life: number
  velocity: THREE.Vector3
  baseScale: number
}

/**
 * Chimney smoke: a small pool of soft sprites. One puff per exhaust beat,
 * scaled by effort; puffs rise, drift, swell and fade. Bounded pool keeps
 * the cost flat.
 */
export class SmokeSystem {
  readonly group = new THREE.Group()
  private readonly puffs: Puff[] = []
  private next = 0

  constructor() {
    const material = new THREE.SpriteMaterial({
      map: makePuffTexture(),
      transparent: true,
      depthWrite: false,
    })
    for (let i = 0; i < POOL_SIZE; i++) {
      const sprite = new THREE.Sprite(material.clone())
      sprite.visible = false
      this.group.add(sprite)
      this.puffs.push({
        sprite,
        age: Infinity,
        life: LIFE_SECONDS,
        velocity: new THREE.Vector3(),
        baseScale: 1,
      })
    }
  }

  /** Emit one puff at the chimney; harder effort = bigger, livelier puff. */
  puff(at: THREE.Vector3, effort: number): void {
    const p = this.puffs[this.next]
    this.next = (this.next + 1) % POOL_SIZE
    p.age = 0
    p.life = LIFE_SECONDS * (0.8 + Math.random() * 0.4)
    p.baseScale = 0.012 + effort * 0.01 + Math.random() * 0.004
    p.velocity.set((Math.random() - 0.5) * 0.01, 0.045 + effort * 0.03, (Math.random() - 0.5) * 0.01)
    p.sprite.position.copy(at)
    p.sprite.visible = true
  }

  update(dt: number): void {
    for (const p of this.puffs) {
      if (!p.sprite.visible) continue
      p.age += dt
      if (p.age >= p.life) {
        p.sprite.visible = false
        continue
      }
      const t = p.age / p.life
      p.velocity.y *= 1 - 0.6 * dt // rising steam slows as it cools
      p.sprite.position.addScaledVector(p.velocity, dt)
      const scale = p.baseScale * (0.5 + t * 2.2) // swell as it disperses
      p.sprite.scale.set(scale, scale, 1)
      const mat = p.sprite.material as THREE.SpriteMaterial
      mat.opacity = 0.75 * (1 - t) * (0.4 + 0.6 * Math.min(t * 6, 1)) // quick in, slow out
    }
  }
}
