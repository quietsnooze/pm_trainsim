import * as THREE from 'three'
import type { Train } from '../sim/train'
import { RAIL_TOP_Y } from './trackMesh'

// Palette (loosely LNER): garter blue body, red wheels, teak coaches.
const GARTER_BLUE = '#2b4a8b'
const UNDERFRAME = '#20242c'
const WHEEL_RED = '#8b2f2b'
const TEAK = '#6d4a2f'
const ROOF_WHITE = '#d8d5cc'
const BRASS = '#c8a24a'

interface Vehicle {
  group: THREE.Group
  /** Distance from the head of the train to this vehicle's centre. */
  centerOffset: number
  /** Spacing between the two path samples used to orient the body. */
  axleSpan: number
}

function box(w: number, h: number, d: number, color: string, roughness = 0.45): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness }),
  )
  mesh.castShadow = true
  return mesh
}

/**
 * A plaque with text drawn on a canvas — numberplates, nameplates,
 * lettering. Returns a group holding one plane per side (±z), each facing
 * outward so the text reads correctly from both sides of the train.
 */
function textPlaque(
  text: string,
  w: number,
  h: number,
  halfWidth: number,
  opts: { bg: string; fg: string; border?: string },
): THREE.Group {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = Math.max(32, Math.round((256 * h) / w))
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = opts.bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (opts.border) {
    ctx.strokeStyle = opts.border
    ctx.lineWidth = canvas.height * 0.06
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, canvas.width - ctx.lineWidth, canvas.height - ctx.lineWidth)
  }
  ctx.fillStyle = opts.fg
  ctx.font = `700 ${Math.round(canvas.height * 0.66)}px -apple-system, 'Segoe UI', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + canvas.height * 0.03)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const geo = new THREE.PlaneGeometry(w, h)
  const mat = new THREE.MeshBasicMaterial({ map: texture }) // unlit: always legible
  const group = new THREE.Group()
  const right = new THREE.Mesh(geo, mat)
  right.position.z = halfWidth + 0.0006
  group.add(right)
  const left = new THREE.Mesh(geo, mat)
  left.position.z = -halfWidth - 0.0006
  left.rotation.y = Math.PI
  group.add(left)
  return group
}

/**
 * LNER A4 4468 "Mallard": streamlined casing, garter blue, red wheels,
 * the number big on the cab sides and the name on the boiler.
 */
function buildLoco(): THREE.Group {
  const g = new THREE.Group()
  const width = 0.026
  const half = width / 2

  // Underframe and full-length valance skirt.
  const frame = box(0.1, 0.006, width - 0.004, UNDERFRAME, 0.8)
  frame.position.set(0, 0.004, 0)
  g.add(frame)
  const valance = box(0.1, 0.011, width, GARTER_BLUE)
  valance.position.set(0, 0.0125, 0)
  g.add(valance)

  // Streamlined boiler casing.
  const boiler = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.0125, 0.062, 6, 14),
    new THREE.MeshStandardMaterial({ color: GARTER_BLUE, roughness: 0.32 }),
  )
  boiler.rotation.z = Math.PI / 2
  boiler.position.set(0.005, 0.0285, 0)
  boiler.castShadow = true
  g.add(boiler)

  // The famous sloping nose: a tilted capsule melting into the front,
  // squashed sideways so it blends into the casing instead of ballooning.
  const nose = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.0095, 0.016, 6, 12),
    new THREE.MeshStandardMaterial({ color: GARTER_BLUE, roughness: 0.32 }),
  )
  nose.rotation.z = Math.PI / 2 - 0.34
  nose.position.set(0.0375, 0.0235, 0)
  nose.scale.z = 0.92
  nose.castShadow = true
  g.add(nose)

  // Cab with the number on both sides.
  const cab = box(0.024, 0.023, width, GARTER_BLUE)
  cab.position.set(-0.038, 0.0295, 0)
  g.add(cab)
  const numberPlate = textPlaque('4468', 0.02, 0.011, half, {
    bg: GARTER_BLUE,
    fg: '#f3efe4',
    border: BRASS,
  })
  numberPlate.position.set(-0.038, 0.0295, 0)
  g.add(numberPlate)

  // Brass nameplate at mid-boiler height, clear of the casing's curve.
  const namePlate = textPlaque('MALLARD', 0.026, 0.0045, 0.0128, {
    bg: BRASS,
    fg: '#3a2c14',
  })
  namePlate.position.set(0.012, 0.0295, 0)
  g.add(namePlate)

  // Red driving wheels peeking below the valance.
  for (const x of [-0.022, 0.001, 0.024]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0075, 0.0075, width - 0.005, 14),
      new THREE.MeshStandardMaterial({ color: WHEEL_RED, roughness: 0.6 }),
    )
    wheel.rotation.x = Math.PI / 2
    wheel.position.set(x, 0.0075, 0)
    g.add(wheel)
  }

  // Chimney nub and front buffer beam.
  const chimney = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0028, 0.0036, 0.004, 10),
    new THREE.MeshStandardMaterial({ color: UNDERFRAME, roughness: 0.5 }),
  )
  chimney.position.set(0.028, 0.0425, 0)
  chimney.castShadow = true
  g.add(chimney)
  const bufferBeam = box(0.003, 0.008, width - 0.006, WHEEL_RED, 0.6)
  bufferBeam.position.set(0.0505, 0.009, 0)
  g.add(bufferBeam)

  return g
}

/** The A4's corridor tender, lettered L N E R. */
function buildTender(): THREE.Group {
  const g = new THREE.Group()
  const width = 0.025
  const body = box(0.05, 0.023, width, GARTER_BLUE)
  body.position.y = 0.0225
  g.add(body)
  const chassis = box(0.046, 0.009, width - 0.004, UNDERFRAME, 0.8)
  chassis.position.y = 0.0045
  g.add(chassis)
  const lettering = textPlaque('L N E R', 0.04, 0.009, width / 2, {
    bg: GARTER_BLUE,
    fg: BRASS,
  })
  lettering.position.set(0, 0.024, 0)
  g.add(lettering)
  return g
}

/** Teak coach. */
function buildCoach(): THREE.Group {
  const g = new THREE.Group()
  const body = box(0.09, 0.02, 0.025, TEAK)
  body.position.y = 0.016
  g.add(body)
  const roof = box(0.086, 0.004, 0.022, ROOF_WHITE)
  roof.position.y = 0.028
  g.add(roof)
  const chassis = box(0.084, 0.008, 0.02, UNDERFRAME, 0.8)
  chassis.position.y = 0.004
  g.add(chassis)
  return g
}

/**
 * The whole rake — loco, tender, coaches — posed along the track by sampling
 * the travelled path either side of each vehicle's centre.
 */
export class TrainMesh {
  readonly group = new THREE.Group()
  private readonly vehicles: Vehicle[] = []

  constructor(private readonly train: Train) {
    const consist: Array<{ build: () => THREE.Group; length: number }> = [
      { build: buildLoco, length: 0.112 },
      { build: buildTender, length: 0.058 },
      { build: buildCoach, length: 0.098 },
      { build: buildCoach, length: 0.098 },
    ]
    let offset = 0
    for (const { build, length } of consist) {
      const vehicle = build()
      this.group.add(vehicle)
      this.vehicles.push({
        group: vehicle,
        centerOffset: offset + length / 2,
        axleSpan: length * 0.6,
      })
      offset += length
    }
    this.update()
  }

  /** Re-pose every vehicle from the sim's current position. */
  update(): void {
    for (const v of this.vehicles) {
      const a = this.train.sampleBehindHead(v.centerOffset - v.axleSpan / 2).position
      const b = this.train.sampleBehindHead(v.centerOffset + v.axleSpan / 2).position
      v.group.position.set((a.x + b.x) / 2, RAIL_TOP_Y, (a.z + b.z) / 2)
      v.group.rotation.y = Math.atan2(-(a.z - b.z), a.x - b.x)
    }
  }
}
