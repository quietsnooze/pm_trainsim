import * as THREE from 'three'
import type { TrackGraph } from '../sim/graph'
import { GAUGE, type TrackSegment } from '../sim/track'

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

/** Adapts one segment's geometry (offset sideways) to a THREE.Curve. */
class OffsetSegmentCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly seg: TrackSegment,
    private readonly offset: number,
    private readonly y: number,
  ) {
    super()
  }

  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const { position, tangent } = this.seg.sampleAt(t * this.seg.length)
    const n = normalOf(tangent)
    return target.set(
      position.x + n.x * this.offset,
      this.y,
      position.z + n.z * this.offset,
    )
  }
}

/** Flat ballast ribbon following one segment, as a triangle strip. */
function buildBallast(seg: TrackSegment): THREE.Mesh {
  const steps = Math.max(2, Math.ceil(seg.length / 0.01))
  const half = BALLAST_WIDTH / 2
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= steps; i++) {
    const { position, tangent } = seg.sampleAt((i / steps) * seg.length)
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

function buildSleepers(seg: TrackSegment): THREE.InstancedMesh {
  const count = Math.max(1, Math.floor(seg.length / SLEEPER_SPACING))
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
    const { position, tangent } = seg.sampleAt((i + 0.5) * SLEEPER_SPACING)
    pos.set(position.x, BALLAST_Y + SLEEPER_SIZE.thickness / 2, position.z)
    quat.setFromAxisAngle(up, Math.atan2(-tangent.z, tangent.x))
    m.compose(pos, quat, scale)
    sleepers.setMatrixAt(i, m)
  }
  sleepers.castShadow = true
  sleepers.receiveShadow = true
  return sleepers
}

/** Build the whole permanent way for a track graph. */
export function buildTrackMesh(graph: TrackGraph): THREE.Group {
  const group = new THREE.Group()
  const railMat = new THREE.MeshStandardMaterial({
    color: '#b8b4ac',
    roughness: 0.35,
    metalness: 0.8,
  })
  graph.forEachSegment((_id, seg) => {
    group.add(buildBallast(seg))
    group.add(buildSleepers(seg))
    const tubeSegments = Math.max(8, Math.ceil(seg.length / 0.005))
    for (const side of [-1, 1]) {
      const curve = new OffsetSegmentCurve(seg, (side * GAUGE) / 2, RAIL_CENTER_Y)
      const rail = new THREE.Mesh(
        new THREE.TubeGeometry(curve, tubeSegments, RAIL_RADIUS, 6, false),
        railMat,
      )
      rail.castShadow = true
      group.add(rail)
    }
  })
  return group
}
