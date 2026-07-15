import * as THREE from 'three'

export const BOARD_WIDTH = 1.2
export const BOARD_DEPTH = 0.8
/** Top surface of the baseboard sits at y = 0. */
const BOARD_THICKNESS = 0.05

export interface DioramaLights {
  hemi: THREE.HemisphereLight
  sun: THREE.DirectionalLight
}

/**
 * The tabletop the layout sits on: a wooden slab with a grass mat on top,
 * plus the lighting for the whole scene (returned so the day/night rig
 * can drive it).
 */
export function buildDiorama(scene: THREE.Scene): DioramaLights {
  scene.background = new THREE.Color('#20242b')

  // Note: plain BoxGeometry, not examples' RoundedBoxGeometry — the latter
  // renders with broken lighting on upward faces in three r178.
  const wood = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_WIDTH, BOARD_THICKNESS, BOARD_DEPTH),
    new THREE.MeshStandardMaterial({ color: '#8a6642', roughness: 0.8 }),
  )
  wood.position.y = -BOARD_THICKNESS / 2
  wood.receiveShadow = true
  scene.add(wood)

  const mat = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_WIDTH - 0.06, 0.006, BOARD_DEPTH - 0.06),
    new THREE.MeshStandardMaterial({ color: '#5d8a4a', roughness: 1 }),
  )
  mat.position.y = 0.003
  mat.receiveShadow = true
  scene.add(mat)

  const hemi = new THREE.HemisphereLight('#dfe8ff', '#40382e', 0.9)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight('#fff2dd', 2.2)
  sun.position.set(0.9, 1.4, 0.6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const cam = sun.shadow.camera
  cam.left = -0.9
  cam.right = 0.9
  cam.top = 0.9
  cam.bottom = -0.9
  cam.near = 0.5
  cam.far = 4
  sun.shadow.bias = -0.0005
  scene.add(sun)

  return { hemi, sun }
}
