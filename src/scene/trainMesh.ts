import * as THREE from 'three'
import type { Train } from '../sim/train'
import type { TrainId } from '../sim/trains'
import { RAIL_TOP_Y } from './trackMesh'

// Palette (loosely LNER): garter blue body, red wheels, teak coaches.
const GARTER_BLUE = '#2b4a8b'
const UNDERFRAME = '#20242c'
const WHEEL_RED = '#8b2f2b'
const TYRE_DARK = '#26262a'
const APPLE_GREEN = '#3d6b3a'
const SMOKEBOX = '#3a3d42'
const TEAK = '#6d4a2f'
const ROOF_WHITE = '#d8d5cc'
const BRASS = '#c8a24a'

interface Axle {
  group: THREE.Group
  radius: number
}

/** A coupling rod that orbits with the crank pins it joins. */
interface Rod {
  mesh: THREE.Mesh
  /** Crank phase offset (the two sides run 90° apart, as on a real loco). */
  phase: number
  /** Wheel radius the cranks belong to. */
  wheelRadius: number
  crankRadius: number
  base: THREE.Vector3
}

interface VehicleBuild {
  group: THREE.Group
  axles: Axle[]
  rods?: Rod[]
}

interface Vehicle extends VehicleBuild {
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
  let fontPx = Math.round(canvas.height * 0.66)
  do {
    ctx.font = `700 ${fontPx}px -apple-system, 'Segoe UI', sans-serif`
    fontPx -= 2
  } while (fontPx > 8 && ctx.measureText(text).width > canvas.width * 0.92)
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

/** Crank pin sits at this fraction of the wheel radius. */
const CRANK_FRACTION = 0.58
const STEEL = '#c8c4bc'

/**
 * A spoked wheel face in the x-y plane: dark tyre ring, red hub, red
 * spokes with daylight between them — so you can SEE it going round —
 * plus a steel crank pin for the coupling rod, poking outward.
 */
function buildSpokedWheelFace(radius: number, pinOut: number, wheelColor: string): THREE.Group {
  const g = new THREE.Group()
  const tyre = new THREE.Mesh(
    new THREE.TorusGeometry(radius - 0.0012, 0.0014, 6, 20),
    new THREE.MeshStandardMaterial({ color: TYRE_DARK, roughness: 0.55 }),
  )
  tyre.castShadow = true
  g.add(tyre)
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0022, 0.0022, 0.003, 10),
    new THREE.MeshStandardMaterial({ color: wheelColor, roughness: 0.55 }),
  )
  hub.rotation.x = Math.PI / 2
  g.add(hub)
  const spokeGeo = new THREE.BoxGeometry((radius - 0.0015) * 2, 0.0016, 0.0016)
  const spokeMat = new THREE.MeshStandardMaterial({ color: wheelColor, roughness: 0.55 })
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(spokeGeo, spokeMat)
    spoke.rotation.z = (i * Math.PI) / 3
    g.add(spoke)
  }
  const pin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0011, 0.0011, 0.004, 8),
    new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.4, metalness: 0.6 }),
  )
  pin.rotation.x = Math.PI / 2
  pin.position.set(radius * CRANK_FRACTION, 0, pinOut)
  g.add(pin)
  return g
}

/**
 * A full axle: two spoked faces joined by a slim axle, spun as one.
 * The left-hand face is set 90° round so the two sides' cranks are
 * quartered, as on a real locomotive.
 */
function buildDriverAxle(radius: number, width: number, wheelColor: string): THREE.Group {
  const g = new THREE.Group()
  const axle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0018, 0.0018, width, 8),
    new THREE.MeshStandardMaterial({ color: TYRE_DARK, roughness: 0.6 }),
  )
  axle.rotation.x = Math.PI / 2
  g.add(axle)
  for (const side of [-1, 1]) {
    const wheel = buildSpokedWheelFace(radius, side * 0.002, wheelColor)
    wheel.position.z = (side * width) / 2
    if (side === -1) wheel.rotation.z = Math.PI / 2
    g.add(wheel)
  }
  return g
}

/** A plain small axle for tenders and coaches (solid dark wheels). */
function buildPlainAxle(radius: number, width: number): THREE.Group {
  const g = new THREE.Group()
  const wheels = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 14),
    new THREE.MeshStandardMaterial({ color: TYRE_DARK, roughness: 0.55 }),
  )
  wheels.rotation.x = Math.PI / 2
  wheels.castShadow = true
  g.add(wheels)
  return g
}

/**
 * LNER A4 4468 "Mallard", as preserved: streamlined casing with the side
 * valances removed, so her big red spoked driving wheels are on show.
 */
function buildMallardLoco(): VehicleBuild {
  const g = new THREE.Group()
  const width = 0.026
  const half = width / 2
  const axles: Axle[] = []

  // Slim central frame and the running plate the body sits on.
  const frame = box(0.096, 0.01, 0.008, UNDERFRAME, 0.8)
  frame.position.set(0, 0.009, 0)
  g.add(frame)
  const runningPlate = box(0.1, 0.003, width, GARTER_BLUE)
  runningPlate.position.set(0, 0.0155, 0)
  g.add(runningPlate)

  // Streamlined boiler casing.
  const boiler = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.0125, 0.062, 6, 14),
    new THREE.MeshStandardMaterial({ color: GARTER_BLUE, roughness: 0.32 }),
  )
  boiler.rotation.z = Math.PI / 2
  boiler.position.set(0.005, 0.0285, 0)
  boiler.castShadow = true
  g.add(boiler)

  // The famous sloping nose.
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

  // Brass nameplate at mid-boiler height.
  const namePlate = textPlaque('MALLARD', 0.026, 0.0045, 0.0128, {
    bg: BRASS,
    fg: '#3a2c14',
  })
  namePlate.position.set(0.012, 0.0295, 0)
  g.add(namePlate)

  // Three big spoked driving axles, fully visible and turning.
  const driverR = 0.0095
  const driverXs = [-0.024, 0, 0.024]
  for (const x of driverXs) {
    const axle = buildDriverAxle(driverR, width - 0.006, WHEEL_RED)
    axle.position.set(x, driverR, 0)
    g.add(axle)
    axles.push({ group: axle, radius: driverR })
  }

  // Coupling rods joining the crank pins, one each side, quartered 90°.
  const rods: Rod[] = []
  const rodLength = driverXs[2] - driverXs[0] + 0.012
  const rodZ = (width - 0.006) / 2 + 0.002
  for (const side of [-1, 1]) {
    const rod = new THREE.Mesh(
      new THREE.BoxGeometry(rodLength, 0.0022, 0.0014),
      new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.35, metalness: 0.6 }),
    )
    rod.castShadow = true
    g.add(rod)
    rods.push({
      mesh: rod,
      phase: side === -1 ? Math.PI / 2 : 0,
      wheelRadius: driverR,
      crankRadius: driverR * CRANK_FRACTION,
      base: new THREE.Vector3(0, driverR, side * rodZ),
    })
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

  return { group: g, axles, rods }
}

/**
 * LNER A3 4472 "Flying Scotsman": conventional boiler with smokebox,
 * tall chimney and dome, apple green with green spoked drivers.
 */
function buildScotsmanLoco(): VehicleBuild {
  const g = new THREE.Group()
  const width = 0.026
  const half = width / 2
  const axles: Axle[] = []

  const frame = box(0.096, 0.01, 0.008, UNDERFRAME, 0.8)
  frame.position.set(0, 0.009, 0)
  g.add(frame)
  const runningPlate = box(0.1, 0.003, width, APPLE_GREEN)
  runningPlate.position.set(0, 0.0155, 0)
  g.add(runningPlate)

  // Round boiler with a darker smokebox and its door at the front.
  const boiler = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.056, 14),
    new THREE.MeshStandardMaterial({ color: APPLE_GREEN, roughness: 0.35 }),
  )
  boiler.rotation.z = Math.PI / 2
  boiler.position.set(0.002, 0.0285, 0)
  boiler.castShadow = true
  g.add(boiler)
  const smokebox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0112, 0.0112, 0.016, 14),
    new THREE.MeshStandardMaterial({ color: SMOKEBOX, roughness: 0.5 }),
  )
  smokebox.rotation.z = Math.PI / 2
  smokebox.position.set(0.037, 0.0285, 0)
  smokebox.castShadow = true
  g.add(smokebox)
  const door = new THREE.Mesh(
    new THREE.SphereGeometry(0.0108, 12, 8),
    new THREE.MeshStandardMaterial({ color: SMOKEBOX, roughness: 0.5 }),
  )
  door.scale.x = 0.35
  door.position.set(0.0455, 0.0285, 0)
  g.add(door)

  // Tall chimney at the front, brass dome mid-boiler.
  const chimney = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0028, 0.0034, 0.008, 10),
    new THREE.MeshStandardMaterial({ color: UNDERFRAME, roughness: 0.5 }),
  )
  chimney.position.set(0.038, 0.0435, 0)
  chimney.castShadow = true
  g.add(chimney)
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.0045, 12, 8),
    new THREE.MeshStandardMaterial({ color: BRASS, roughness: 0.35, metalness: 0.4 }),
  )
  dome.position.set(0.008, 0.0395, 0)
  dome.castShadow = true
  g.add(dome)

  // Cab with the number, and a grey roof.
  const cab = box(0.024, 0.024, width, APPLE_GREEN)
  cab.position.set(-0.038, 0.029, 0)
  g.add(cab)
  const cabRoof = box(0.026, 0.003, width + 0.002, SMOKEBOX, 0.6)
  cabRoof.position.set(-0.038, 0.0425, 0)
  g.add(cabRoof)
  const numberPlate = textPlaque('4472', 0.02, 0.011, half, {
    bg: APPLE_GREEN,
    fg: '#f3efe4',
    border: BRASS,
  })
  numberPlate.position.set(-0.038, 0.029, 0)
  g.add(numberPlate)
  const namePlate = textPlaque('FLYING SCOTSMAN', 0.032, 0.0045, 0.0115, {
    bg: BRASS,
    fg: '#3a2c14',
  })
  namePlate.position.set(0.002, 0.031, 0)
  g.add(namePlate)

  // Three green spoked driving axles and their coupling rods.
  const driverR = 0.0095
  const driverXs = [-0.024, 0, 0.024]
  for (const x of driverXs) {
    const axle = buildDriverAxle(driverR, width - 0.006, APPLE_GREEN)
    axle.position.set(x, driverR, 0)
    g.add(axle)
    axles.push({ group: axle, radius: driverR })
  }
  const rods: Rod[] = []
  const rodLength = driverXs[2] - driverXs[0] + 0.012
  const rodZ = (width - 0.006) / 2 + 0.002
  for (const side of [-1, 1]) {
    const rod = new THREE.Mesh(
      new THREE.BoxGeometry(rodLength, 0.0022, 0.0014),
      new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.35, metalness: 0.6 }),
    )
    rod.castShadow = true
    g.add(rod)
    rods.push({
      mesh: rod,
      phase: side === -1 ? Math.PI / 2 : 0,
      wheelRadius: driverR,
      crankRadius: driverR * CRANK_FRACTION,
      base: new THREE.Vector3(0, driverR, side * rodZ),
    })
  }

  const bufferBeam = box(0.003, 0.008, width - 0.006, WHEEL_RED, 0.6)
  bufferBeam.position.set(0.0505, 0.009, 0)
  g.add(bufferBeam)

  return { group: g, axles, rods }
}

/** A tender in the loco's livery, lettered L N E R, on visible wheels. */
function buildTender(liveryColor: string): VehicleBuild {
  const g = new THREE.Group()
  const width = 0.025
  const axles: Axle[] = []
  const body = box(0.05, 0.021, width, liveryColor)
  body.position.y = 0.0245
  g.add(body)
  const chassis = box(0.046, 0.007, width - 0.006, UNDERFRAME, 0.8)
  chassis.position.y = 0.0105
  g.add(chassis)
  for (const x of [-0.016, 0.016]) {
    const axle = buildPlainAxle(0.0062, width - 0.008)
    axle.position.set(x, 0.0062, 0)
    g.add(axle)
    axles.push({ group: axle, radius: 0.0062 })
  }
  const lettering = textPlaque('L N E R', 0.04, 0.009, width / 2, {
    bg: liveryColor,
    fg: BRASS,
  })
  lettering.position.set(0, 0.025, 0)
  g.add(lettering)
  return { group: g, axles }
}

/** Teak coach, now on visible wheels. */
function buildCoach(): VehicleBuild {
  const g = new THREE.Group()
  const axles: Axle[] = []
  const body = box(0.09, 0.019, 0.025, TEAK)
  body.position.y = 0.0195
  g.add(body)
  const roof = box(0.086, 0.004, 0.022, ROOF_WHITE)
  roof.position.y = 0.031
  g.add(roof)
  const chassis = box(0.084, 0.006, 0.019, UNDERFRAME, 0.8)
  chassis.position.y = 0.008
  g.add(chassis)
  for (const x of [-0.032, 0.032]) {
    const axle = buildPlainAxle(0.0058, 0.019)
    axle.position.set(x, 0.0058, 0)
    g.add(axle)
    axles.push({ group: axle, radius: 0.0058 })
  }
  return { group: g, axles }
}

/** Path length the full rake occupies — the sim ribbon must cover this. */
export const CONSIST_LENGTH = 0.112 + 0.058 + 0.098 * 4

/** Where smoke comes from: distance behind the train head, and height. */
export const CHIMNEY_BEHIND_HEAD = 0.028
export const CHIMNEY_HEIGHT = 0.045

/**
 * The whole rake — loco, tender, coaches — posed along the track by sampling
 * the travelled path either side of each vehicle's centre. Wheels spin with
 * the distance the sim says the train has rolled.
 */
export class TrainMesh {
  readonly group = new THREE.Group()
  private readonly vehicles: Vehicle[] = []

  constructor(
    private readonly train: Train,
    kind: TrainId = 'mallard',
  ) {
    const locoOf: Record<TrainId, { build: () => VehicleBuild; livery: string }> = {
      mallard: { build: buildMallardLoco, livery: GARTER_BLUE },
      scotsman: { build: buildScotsmanLoco, livery: APPLE_GREEN },
    }
    const { build: buildEngine, livery } = locoOf[kind]
    const consist: Array<{ build: () => VehicleBuild; length: number }> = [
      { build: buildEngine, length: 0.112 },
      { build: () => buildTender(livery), length: 0.058 },
      { build: buildCoach, length: 0.098 },
      { build: buildCoach, length: 0.098 },
      { build: buildCoach, length: 0.098 },
      { build: buildCoach, length: 0.098 },
    ]
    let offset = 0
    for (const { build, length } of consist) {
      const vehicle = build()
      this.group.add(vehicle.group)
      this.vehicles.push({
        ...vehicle,
        centerOffset: offset + length / 2,
        axleSpan: length * 0.6,
      })
      offset += length
    }
    this.update()
  }

  /** Re-pose every vehicle and spin every axle from the sim's state. */
  update(): void {
    const rolled = this.train.travelled
    for (const v of this.vehicles) {
      const a = this.train.sampleBehindHead(v.centerOffset - v.axleSpan / 2).position
      const b = this.train.sampleBehindHead(v.centerOffset + v.axleSpan / 2).position
      v.group.position.set((a.x + b.x) / 2, RAIL_TOP_Y, (a.z + b.z) / 2)
      v.group.rotation.y = Math.atan2(-(a.z - b.z), a.x - b.x)
      for (const axle of v.axles) {
        axle.group.rotation.z = -rolled / axle.radius
      }
      for (const rod of v.rods ?? []) {
        // The rod translates in a circle with its crank pins (it never tilts).
        const a = -rolled / rod.wheelRadius + rod.phase
        rod.mesh.position.set(
          rod.base.x + Math.cos(a) * rod.crankRadius,
          rod.base.y + Math.sin(a) * rod.crankRadius,
          rod.base.z,
        )
      }
    }
  }
}
