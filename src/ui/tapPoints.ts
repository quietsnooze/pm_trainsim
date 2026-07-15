import type * as THREE from 'three'
import type { PointsMesh } from '../scene/pointsMesh'
import type { TrackGraph } from '../sim/graph'

const MAX_TAP_MS = 350
const MAX_TAP_MOVE_PX = 12

/**
 * Tap-the-track points: a quick touch (not an orbit drag) over a junction's
 * tap zone toggles that point.
 */
export function attachTapPoints(
  dom: HTMLElement,
  camera: THREE.Camera,
  getPointsMesh: () => PointsMesh,
  getGraph: () => TrackGraph,
  onToggle?: () => void,
): void {
  let downAt = 0
  let downX = 0
  let downY = 0

  dom.addEventListener('pointerdown', (e) => {
    downAt = performance.now()
    downX = e.clientX
    downY = e.clientY
  })

  dom.addEventListener('pointerup', (e) => {
    const quick = performance.now() - downAt < MAX_TAP_MS
    const still = Math.hypot(e.clientX - downX, e.clientY - downY) < MAX_TAP_MOVE_PX
    if (!quick || !still) return
    const rect = dom.getBoundingClientRect()
    const ndc = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((e.clientY - rect.top) / rect.height) * 2 - 1),
    }
    const graph = getGraph()
    const id = getPointsMesh().pick(ndc, camera)
    if (id) {
      graph.setPoint(id, graph.getPoint(id) === 0 ? 1 : 0)
      onToggle?.()
    }
  })
}
