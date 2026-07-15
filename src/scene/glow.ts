import * as THREE from 'three'

/**
 * Things that light up at night — loco lamps, coach windows, the station —
 * register their materials here; the day/night rig drives one glow level
 * for all of them.
 */
const materials: THREE.MeshStandardMaterial[] = []

export function glowMaterial(color: string, emissive: string, roughness = 0.5): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: 0,
  })
  materials.push(material)
  return material
}

export function setGlowLevel(level: number): void {
  for (const material of materials) material.emissiveIntensity = level
}
