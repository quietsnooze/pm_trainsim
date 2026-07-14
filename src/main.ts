import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildDiorama } from './scene/diorama'
import { PointsMesh } from './scene/pointsMesh'
import { buildTrackMesh } from './scene/trackMesh'
import { TrainMesh } from './scene/trainMesh'
import { makeOvalSidingGraph } from './sim/layouts'
import { SoundDirector } from './sim/sound'
import { Train } from './sim/train'
import { WebAudioBackend } from './ui/audio'
import { createControls, createMuteButton } from './ui/controls'
import { attachTapPoints } from './ui/tapPoints'

const app = document.getElementById('app')!

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
buildDiorama(scene)

const track = makeOvalSidingGraph()
scene.add(buildTrackMesh(track))

const pointsMesh = new PointsMesh(track)
scene.add(pointsMesh.group)

const train = new Train(track)
const trainMesh = new TrainMesh(train)
scene.add(trainMesh.group)

const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 20)

const orbit = new OrbitControls(camera, renderer.domElement)
orbit.target.set(0, 0.02, 0)
orbit.enableDamping = true
orbit.enablePan = false
orbit.minDistance = 0.25
orbit.maxDistance = 2.2
orbit.minPolarAngle = 0.15
orbit.maxPolarAngle = 1.35 // don't let the camera dip below the table

// Sound: gentle by default, one big mute. iOS needs a user gesture before
// audio can start, so unlock on every pointerdown (idempotent, also brings
// audio back after the app is backgrounded).
const audioBackend = new WebAudioBackend()
const sound = new SoundDirector(audioBackend)
window.addEventListener('pointerdown', () => audioBackend.unlock())

const controls = createControls(train, document.body, { onWhistle: () => sound.whistle() })
createMuteButton(
  document.body,
  () => sound.muted,
  (muted) => (sound.muted = muted),
)
attachTapPoints(renderer.domElement, camera, pointsMesh, track, () => sound.pointClunk())

// Initial framing: pull further back on narrow (portrait phone) screens so
// the whole baseboard fits. Only applied once — after that the orbit is yours.
function frameCamera(): void {
  const aspect = window.innerWidth / window.innerHeight
  const distance = Math.max(1.15, 0.88 / aspect)
  camera.position.set(0.52, 0.47, 0.71).multiplyScalar(distance)
  orbit.update()
}

function resize(): void {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()
frameCamera()

if (import.meta.env.DEV) {
  // Console handle for poking at the running sim during development.
  Object.assign(window, { __sim: { scene, camera, renderer, orbit, train, trainMesh } })
}

const clock = new THREE.Clock()
renderer.setAnimationLoop(() => {
  // Clamp dt so a backgrounded tab doesn't teleport the train on return.
  const dt = Math.min(clock.getDelta(), 0.05)
  train.update(dt)
  trainMesh.update()
  pointsMesh.update(dt)
  sound.update(dt, train.speed)
  controls.update()
  orbit.update()
  renderer.render(scene, camera)
})
