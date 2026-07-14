import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildDiorama } from './scene/diorama'
import { FollowCam } from './scene/followCam'
import { PointsMesh } from './scene/pointsMesh'
import { SmokeSystem } from './scene/smoke'
import { buildStation } from './scene/station'
import { buildTrackMesh, RAIL_TOP_Y } from './scene/trackMesh'
import { CHIMNEY_BEHIND_HEAD, CHIMNEY_HEIGHT, CONSIST_LENGTH, TrainMesh } from './scene/trainMesh'
import { makeOvalSidingGraph } from './sim/layouts'
import { SoundDirector } from './sim/sound'
import { Train } from './sim/train'
import { WebAudioBackend } from './ui/audio'
import { createCameraButton, createControls, createMuteButton } from './ui/controls'
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
scene.add(buildStation())

const train = new Train(track, CONSIST_LENGTH + 0.02)
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

// A puff of steam with every exhaust beat (even when muted — smoke isn't sound).
const smoke = new SmokeSystem()
scene.add(smoke.group)
sound.onBeat = (effort) => {
  const { position } = train.sampleBehindHead(CHIMNEY_BEHIND_HEAD)
  smoke.puff(new THREE.Vector3(position.x, RAIL_TOP_Y + CHIMNEY_HEIGHT, position.z), effort)
}

const followCam = new FollowCam(camera, orbit, train, homePose)

const controls = createControls(train, document.body, { onWhistle: () => sound.whistle() })
createCameraButton(document.body, () => followCam.toggle())
createMuteButton(
  document.body,
  () => sound.muted,
  (muted) => (sound.muted = muted),
)
attachTapPoints(renderer.domElement, camera, pointsMesh, track, () => sound.pointClunk())

// The tabletop framing: pulled further back on narrow (portrait phone)
// screens so the whole baseboard fits. Used at startup and whenever the
// follow camera hands the view back.
function homePose(): { position: THREE.Vector3; target: THREE.Vector3 } {
  const aspect = window.innerWidth / window.innerHeight
  const distance = Math.max(1.15, 0.88 / aspect)
  return {
    position: new THREE.Vector3(0.52, 0.47, 0.71).multiplyScalar(distance),
    target: new THREE.Vector3(0, 0.02, 0),
  }
}

function frameCamera(): void {
  const home = homePose()
  camera.position.copy(home.position)
  orbit.target.copy(home.target)
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
  smoke.update(dt)
  controls.update()
  if (followCam.active) followCam.update(dt)
  else orbit.update()
  renderer.render(scene, camera)
})
