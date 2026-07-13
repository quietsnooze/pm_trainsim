import * as THREE from 'three'
import { GAUGE, type TrackPath } from '../sim/track'

const GRASS_TOP_Y = 0.006
const BALLAST_Y = GRASS_TOP_Y + 0.0008
const BALLAST_WIDTH = 0.07
const SLEEPER_SIZE = { alongTrack: 0.008, acrossTrack: 0.052, thickness: 0.004 }
const SLEEPER_SPACING = 0.018
const SLEEPER_TOP_Y = BALLAST_Y + SLEEPER_SIZE.thickness
const RAIL_RADIUS = 0.0022
const RAIL_CENTER_Y = SLEEPER_TOP_Y + RAIL_RADIUS
/** Where wheel treads sit — the scene reference height for rolling stock. */
export const RAIL_TOP_Y = RAIL_CENTER_Y + RAIL_RADIUS

/** Left-hand normal of a unit tangent in the x-z plane. */
function normalOf(t: { x: number; z: number }): { x: number; z: number } {
  return { x: -t.z, z: t.x }
}

/** Adapts the sim's TrackPath (offset sideways by `offset`) to a THREE.Curve. */
class OffsetPathCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly path: TrackPath,
    private readonly offset: number,
    private readonly y: number,
  ) {
    super()
  }

  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const { position, tangent } = this.path.sampleAt(t * this.path.totalLength)
    const n = normalOf(tangent)
    return target.set(
      position.x + n.x * this.offset,
      this.y,
      position.z + n.z * this.offset,
    )
  }
}

/** Flat ballast ribbon following the path, as a triangle strip. */
function buildBallast(path: TrackPath): THREE.Mesh {
  const steps = 256
  const half = BALLAST_WIDTH / 2
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= steps; i++) {
    const { position, tangent } = path.sampleAt((i / steps) * path.totalLength)
    const n = normalOf(tangent)
    positions.push(position.x + n.x * half, BALLAST_Y, position.z + n.z * half)
    positions.push(position.x - n.x * half, BALLAST_Y, position.z - n.z * half)
    if (i < steps) {
      // Wound so computeVertexNormals yields upward-facing normals.
      const a = i * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: '#9b968c', roughness: 1 }),
  )
  mesh.receiveShadow = true
  return mesh
}

function buildSleepers(path: TrackPath): THREE.InstancedMesh {
  const count = Math.floor(path.totalLength / SLEEPER_SPACING)
  const geo = new THREE.BoxGeometry(
    SLEEPER_SIZE.alongTrack,
    SLEEPER_SIZE.thickness,
    SLEEPER_SIZE.acrossTrack,
  )
  const mat = new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.9 })
  const sleepers = new THREE.InstancedMesh(geo, mat, count)
  const m = new THREE.Matrix4()
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scale = new THREE.Vector3(1, 1, 1)
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < count; i++) {
    const { position, tangent } = path.sampleAt(i * SLEEPER_SPACING)
    pos.set(position.x, BALLAST_Y + SLEEPER_SIZE.thickness / 2, position.z)
    quat.setFromAxisAngle(up, Math.atan2(-tangent.z, tangent.x))
    m.compose(pos, quat, scale)
    sleepers.setMatrixAt(i, m)
  }
  sleepers.castShadow = true
  sleepers.receiveShadow = true
  return sleepers
}

export function buildTrackMesh(path: TrackPath): THREE.Group {
  const group = new THREE.Group()
  group.add(buildBallast(path))
  group.add(buildSleepers(path))

  const railMat = new THREE.MeshStandardMaterial({
    color: '#b8b4ac',
    roughness: 0.35,
    metalness: 0.8,
  })
  const tubeSegments = 220
  for (const side of [-1, 1]) {
    const curve = new OffsetPathCurve(path, (side * GAUGE) / 2, RAIL_CENTER_Y)
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(curve, tubeSegments, RAIL_RADIUS, 6, true),
      railMat,
    )
    rail.castShadow = true
    group.add(rail)
  }
  return group
}
