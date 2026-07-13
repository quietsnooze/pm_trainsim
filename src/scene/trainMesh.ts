import * as THREE from 'three'
import type { Train } from '../sim/train'
import { RAIL_TOP_Y } from './trackMesh'

// Palette (loosely LNER): garter blue body, red wheels/valance shadow, teak coaches.
const GARTER_BLUE = '#2b4a8b'
const VALANCE_DARK = '#1c2740'
const WHEEL_RED = '#8b2f2b'
const TEAK = '#6d4a2f'
const ROOF_WHITE = '#d8d5cc'

interface Vehicle {
  group: THREE.Group
  /** Distance from the head of the train to this vehicle's centre. */
  centerOffset: number
  /** Spacing between the two path samples used to orient the body. */
  axleSpan: number
}

function box(w: number, h: number, d: number, color: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45 }),
  )
  mesh.castShadow = true
  return mesh
}

/** Streamlined A4-ish loco, built along +x with the nose at +x. */
function buildLoco(): THREE.Group {
  const g = new THREE.Group()
  const bodyLen = 0.085
  const bodyW = 0.026
  const bodyH = 0.02

  // Boiler casing: a horizontal capsule reads as the A4's streamlined shroud.
  const boiler = new THREE.Mesh(
    new THREE.CapsuleGeometry(bodyW / 2, bodyLen - bodyW, 6, 12),
    new THREE.MeshStandardMaterial({ color: GARTER_BLUE, roughness: 0.35 }),
  )
  boiler.rotation.z = Math.PI / 2
  boiler.position.set(0.004, 0.02, 0)
  boiler.castShadow = true
  g.add(boiler)

  // Cab.
  const cab = box(0.024, bodyH + 0.006, bodyW, GARTER_BLUE)
  cab.position.set(-bodyLen / 2 + 0.002, 0.019, 0)
  g.add(cab)

  // Skirt/valance hiding the running gear.
  const skirt = box(bodyLen + 0.02, 0.012, bodyW - 0.002, VALANCE_DARK)
  skirt.position.set(0, 0.006, 0)
  g.add(skirt)

  // A hint of red driving wheels peeking below the valance.
  for (const x of [-0.02, 0.002, 0.024]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, bodyW - 0.004, 12),
      new THREE.MeshStandardMaterial({ color: WHEEL_RED, roughness: 0.6 }),
    )
    wheel.rotation.x = Math.PI / 2
    wheel.position.set(x, 0.005, 0)
    g.add(wheel)
  }

  // Chimney nub.
  const chimney = new THREE.Mesh(
    new THREE.CylinderGeometry(0.003, 0.004, 0.005, 10),
    new THREE.MeshStandardMaterial({ color: VALANCE_DARK, roughness: 0.5 }),
  )
  chimney.position.set(bodyLen / 2 - 0.012, 0.033, 0)
  chimney.castShadow = true
  g.add(chimney)

  return g
}

/** Tender or coach body. */
function buildCar(color: string, len: number): THREE.Group {
  const g = new THREE.Group()
  const body = box(len, 0.02, 0.025, color)
  body.position.y = 0.016
  g.add(body)
  const roof = box(len - 0.004, 0.004, 0.022, ROOF_WHITE)
  roof.position.y = 0.028
  g.add(roof)
  const chassis = box(len - 0.006, 0.008, 0.02, VALANCE_DARK)
  chassis.position.y = 0.004
  g.add(chassis)
  return g
}

/**
 * The whole rake — loco, tender, coaches — posed along the track by sampling
 * the path either side of each vehicle's centre.
 */
export class TrainMesh {
  readonly group = new THREE.Group()
  private readonly vehicles: Vehicle[] = []

  constructor(private readonly train: Train) {
    const consist: Array<{ build: () => THREE.Group; length: number }> = [
      { build: buildLoco, length: 0.115 },
      { build: () => buildCar(GARTER_BLUE, 0.06), length: 0.068 },
      { build: () => buildCar(TEAK, 0.09), length: 0.098 },
      { build: () => buildCar(TEAK, 0.09), length: 0.098 },
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
