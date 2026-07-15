import * as THREE from 'three'
import { glowMaterial } from './glow'

// Palette: warm stone, cream timber, slate-ish roof.
const PLATFORM_STONE = '#b5ab98'
const PLATFORM_EDGE = '#e8e4da'
const WALL_CREAM = '#e8dfc8'
const ROOF_RED = '#7a4438'
const DARK_TIMBER = '#4a3a2c'
const CANOPY = '#5d6b5a'

const GRASS_TOP_Y = 0.006

function box(w: number, h: number, d: number, color: string, roughness = 0.85): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness }),
  )
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * A small wayside station along the back straight: platform with a white
 * edge, a little waiting room with a pitched roof and chimney, a canopy on
 * posts, and a couple of benches. Positioned for the oval layouts (track
 * at z = -0.22); becomes anchor-driven with the layout catalogue slice.
 */
export function buildStation(): THREE.Group {
  const g = new THREE.Group()

  // Platform slab, top just below carriage floors, white safety edge.
  const platform = box(0.32, 0.016, 0.043, PLATFORM_STONE)
  platform.position.set(0, GRASS_TOP_Y + 0.008, -0.2735)
  g.add(platform)
  const edge = box(0.32, 0.0165, 0.004, PLATFORM_EDGE)
  edge.position.set(0, GRASS_TOP_Y + 0.008, -0.254)
  g.add(edge)

  // Waiting room: cream walls, pitched roof from two tilted slabs, chimney.
  const building = new THREE.Group()
  const walls = box(0.09, 0.03, 0.034, WALL_CREAM, 0.7)
  walls.position.y = 0.015
  building.add(walls)
  for (const side of [-1, 1]) {
    const slope = box(0.096, 0.0035, 0.024, ROOF_RED, 0.8)
    slope.position.set(0, 0.0355, side * 0.0093)
    slope.rotation.x = side * 0.62
    building.add(slope)
  }
  const ridge = box(0.096, 0.004, 0.005, ROOF_RED, 0.8)
  ridge.position.y = 0.0405
  building.add(ridge)
  const chimney = box(0.007, 0.014, 0.007, DARK_TIMBER)
  chimney.position.set(0.03, 0.042, 0)
  building.add(chimney)
  // Door and windows on the platform side.
  const door = box(0.012, 0.018, 0.002, DARK_TIMBER, 0.6)
  door.position.set(0, 0.009, 0.0175)
  building.add(door)
  for (const x of [-0.028, 0.028]) {
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.012, 0.002),
      glowMaterial('#8fa8b8', '#ffd88a', 0.3),
    )
    window.position.set(x, 0.014, 0.0175)
    building.add(window)
  }
  building.position.set(0, GRASS_TOP_Y + 0.016, -0.317)
  g.add(building)

  // Canopy over the platform on slim posts.
  const canopy = box(0.14, 0.003, 0.03, CANOPY, 0.7)
  canopy.position.set(0, GRASS_TOP_Y + 0.05, -0.272)
  g.add(canopy)
  for (const x of [-0.06, 0.06]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0018, 0.0018, 0.034, 8),
      new THREE.MeshStandardMaterial({ color: DARK_TIMBER, roughness: 0.7 }),
    )
    post.position.set(x, GRASS_TOP_Y + 0.033, -0.28)
    post.castShadow = true
    g.add(post)
  }

  // A couple of benches.
  for (const x of [-0.11, 0.11]) {
    const bench = box(0.024, 0.004, 0.008, DARK_TIMBER, 0.7)
    bench.position.set(x, GRASS_TOP_Y + 0.02, -0.282)
    g.add(bench)
  }

  return g
}
