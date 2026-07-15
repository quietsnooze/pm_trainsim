import * as THREE from 'three'
import type { TreeAnchor } from '../sim/layouts'

const GRASS_TOP_Y = 0.006
const TRUNK = '#5a4430'
const PINE_DARK = '#2e5d33'
const PINE_LIGHT = '#3d7042'
const LEAF = '#4a8548'

/** A little pine: trunk plus stacked cones. */
function buildPine(): THREE.Group {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0035, 0.0045, 0.016, 8),
    new THREE.MeshStandardMaterial({ color: TRUNK, roughness: 0.9 }),
  )
  trunk.position.y = 0.008
  trunk.castShadow = true
  g.add(trunk)
  const tiers: Array<[number, number, string]> = [
    [0.024, 0.02, PINE_DARK],
    [0.018, 0.018, PINE_LIGHT],
    [0.011, 0.016, PINE_DARK],
  ]
  let y = 0.02
  for (const [r, h, color] of tiers) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 9),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
    )
    cone.position.y = y + h / 2
    cone.castShadow = true
    g.add(cone)
    y += h * 0.62
  }
  return g
}

/** A little broadleaf: trunk plus a squashed leafy blob. */
function buildBroadleaf(): THREE.Group {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.003, 0.004, 0.018, 8),
    new THREE.MeshStandardMaterial({ color: TRUNK, roughness: 0.9 }),
  )
  trunk.position.y = 0.009
  trunk.castShadow = true
  g.add(trunk)
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 10, 8),
    new THREE.MeshStandardMaterial({ color: LEAF, roughness: 0.85 }),
  )
  crown.scale.y = 0.85
  crown.position.y = 0.032
  crown.castShadow = true
  g.add(crown)
  return g
}

/** Trees at the layout's anchors — pines and broadleaves alternating. */
export function buildScenery(trees: TreeAnchor[]): THREE.Group {
  const group = new THREE.Group()
  trees.forEach((anchor, i) => {
    const tree = i % 2 === 0 ? buildPine() : buildBroadleaf()
    tree.position.set(anchor.x, GRASS_TOP_Y, anchor.z)
    const s = anchor.scale ?? 1
    tree.scale.setScalar(s)
    tree.rotation.y = (i * 2.399) % (Math.PI * 2) // varied but deterministic
    group.add(tree)
  })
  return group
}
