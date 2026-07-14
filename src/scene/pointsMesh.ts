import * as THREE from 'three'
import type { EndRef, TrackGraph } from '../sim/graph'
import { RAIL_TOP_Y } from './trackMesh'

const BLADE_LENGTH = 0.07
const RIBBON_LENGTH = 0.12
const RIBBON_WIDTH = 0.012
const RIBBON_Y = RAIL_TOP_Y - 0.0035 // between the rails, above sleepers
const HIT_RADIUS = 0.06
const SWING_SPEED = 6 // rad/s-ish blade animation

interface PointVisual {
  id: string
  pivot: THREE.Group
  angles: [number, number]
  currentAngle: number
  ribbons: [THREE.Mesh, THREE.Mesh]
  hit: THREE.Mesh
}

/** Bright ribbon laid along the first stretch of a leg, showing the route. */
function buildRouteRibbon(graph: TrackGraph, leg: EndRef): THREE.Mesh {
  const geom = graph.segment(leg.seg)
  const span = Math.min(RIBBON_LENGTH, geom.length)
  const steps = 12
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= steps; i++) {
    const along = (i / steps) * span
    const at = leg.end === 'a' ? along : geom.length - along
    const { position, tangent } = geom.sampleAt(at)
    const nx = -tangent.z
    const nz = tangent.x
    positions.push(position.x + nx * RIBBON_WIDTH * 0.5, RIBBON_Y, position.z + nz * RIBBON_WIDTH * 0.5)
    positions.push(position.x - nx * RIBBON_WIDTH * 0.5, RIBBON_Y, position.z - nz * RIBBON_WIDTH * 0.5)
    if (i < steps) {
      const a = i * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: '#ffd54a',
      emissive: '#8a6a10',
      roughness: 0.6,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    }),
  )
}

/**
 * Visuals + tap targets for every point in the graph: a pivoting blade at
 * the toe, a glowing ribbon along whichever route is set, and a generous
 * (mostly invisible) tap disc.
 */
export class PointsMesh {
  readonly group = new THREE.Group()
  private readonly visuals: PointVisual[] = []
  private readonly raycaster = new THREE.Raycaster()

  constructor(private readonly graph: TrackGraph) {
    graph.forEachPoint((id, info) => {
      const angles: [number, number] = [
        Math.atan2(-info.legDirs[0].z, info.legDirs[0].x),
        Math.atan2(-info.legDirs[1].z, info.legDirs[1].x),
      ]

      // Blade: a bright tapered bar hinged at the toe.
      const pivot = new THREE.Group()
      pivot.position.set(info.position.x, RAIL_TOP_Y - 0.002, info.position.z)
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(BLADE_LENGTH, 0.004, 0.006),
        new THREE.MeshStandardMaterial({ color: '#e0a030', roughness: 0.4 }),
      )
      blade.position.x = BLADE_LENGTH / 2
      blade.castShadow = true
      pivot.add(blade)
      pivot.rotation.y = angles[info.route]
      this.group.add(pivot)

      // Route ribbons, one per leg; visibility tracks the point state.
      const ribbons: [THREE.Mesh, THREE.Mesh] = [
        buildRouteRibbon(graph, info.legs[0]),
        buildRouteRibbon(graph, info.legs[1]),
      ]
      ribbons.forEach((r, i) => {
        r.visible = i === info.route
        this.group.add(r)
      })

      // Tap disc: generous and softly visible so it invites a poke.
      const hit = new THREE.Mesh(
        new THREE.CircleGeometry(HIT_RADIUS, 24),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.1 }),
      )
      hit.rotation.x = -Math.PI / 2
      hit.position.set(info.position.x, RIBBON_Y, info.position.z)
      hit.userData.pointId = id
      this.group.add(hit)

      this.visuals.push({ id, pivot, angles, currentAngle: angles[info.route], ribbons, hit })
    })
  }

  /** Animate blades towards the current point states. */
  update(dt: number): void {
    for (const v of this.visuals) {
      const route = this.graph.getPoint(v.id)
      const target = v.angles[route]
      const blend = 1 - Math.exp(-SWING_SPEED * dt)
      v.currentAngle += (target - v.currentAngle) * blend
      v.pivot.rotation.y = v.currentAngle
      v.ribbons.forEach((r, i) => (r.visible = i === route))
    }
  }

  /** The point id under the given normalised device coords, or null. */
  pick(ndc: { x: number; y: number }, camera: THREE.Camera): string | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera)
    const hits = this.raycaster.intersectObjects(this.visuals.map((v) => v.hit))
    const first = hits[0]?.object as THREE.Mesh | undefined
    return (first?.userData.pointId as string | undefined) ?? null
  }
}
