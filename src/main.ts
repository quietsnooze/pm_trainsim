import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DayNight } from './scene/dayNight'
import { buildDiorama } from './scene/diorama'
import { FollowCam } from './scene/followCam'
import { PointsMesh } from './scene/pointsMesh'
import { SmokeSystem } from './scene/smoke'
import { buildScenery } from './scene/scenery'
import { buildStation } from './scene/station'
import { buildTrackMesh, RAIL_TOP_Y } from './scene/trackMesh'
import { CHIMNEY_BEHIND_HEAD, CHIMNEY_HEIGHT, CONSIST_LENGTH, TrainMesh } from './scene/trainMesh'
import { LAYOUTS, layoutSpec, type LayoutSpec } from './sim/layouts'
import { loadSettings, saveSettings } from './sim/settings'
import { SoundDirector } from './sim/sound'
import { Train } from './sim/train'
import { TRAINS, trainSpec, type TrainSpec } from './sim/trains'
import { WebAudioBackend } from './ui/audio'
import { createCameraButton, createControls, createMuteButton, createNightButton } from './ui/controls'
import { attachTapPoints } from './ui/tapPoints'
import { createLayoutPicker } from './ui/layoutPicker'
import { createTrainPicker } from './ui/trainPicker'

const app = document.getElementById('app')!

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const lights = buildDiorama(scene)

// Pick up where the set was left: train, layout, sound and night survive
// a reload, so the toy always opens looking familiar.
const settings = loadSettings(localStorage)

let currentLayout: LayoutSpec = layoutSpec(settings.layoutId)
let track = currentLayout.build()
let trackMeshGroup = buildTrackMesh(track)
scene.add(trackMeshGroup)

let pointsMesh = new PointsMesh(track)
scene.add(pointsMesh.group)
const station = buildStation()
station.visible = currentLayout.station
scene.add(station)
let scenery = buildScenery(currentLayout.trees)
scene.add(scenery)

let currentSpec: TrainSpec = trainSpec(settings.trainId)
let train = new Train(track, CONSIST_LENGTH + 0.02, currentSpec.kinematics)
let trainMesh = new TrainMesh(train, currentSpec.id)
scene.add(trainMesh.group)

/** Swap the whole layout: new board plan, same engine re-railed at spawn. */
function setLayout(spec: LayoutSpec): void {
  if (spec.id === currentLayout.id) return
  currentLayout = spec
  scene.remove(trackMeshGroup)
  scene.remove(pointsMesh.group)
  track = spec.build()
  trackMeshGroup = buildTrackMesh(track)
  scene.add(trackMeshGroup)
  pointsMesh = new PointsMesh(track)
  scene.add(pointsMesh.group)
  station.visible = spec.station
  scene.remove(scenery)
  scenery = buildScenery(spec.trees)
  scene.add(scenery)
  const { throttle, direction } = train
  scene.remove(trainMesh.group)
  train = new Train(track, CONSIST_LENGTH + 0.02, currentSpec.kinematics)
  train.throttle = throttle
  train.direction = direction
  trainMesh = new TrainMesh(train, currentSpec.id)
  scene.add(trainMesh.group)
  persist()
}

/** Swap the running train: same spot on the shelf, different engine. */
function setTrain(spec: TrainSpec): void {
  if (spec.id === currentSpec.id) return
  const { throttle, direction } = train
  scene.remove(trainMesh.group)
  currentSpec = spec
  train = new Train(track, CONSIST_LENGTH + 0.02, spec.kinematics)
  train.throttle = throttle
  train.direction = direction
  trainMesh = new TrainMesh(train, spec.id)
  scene.add(trainMesh.group)
  sound.flavour = spec.sound
  persist()
}

/** Write the current choices to storage so a reload restores them. */
function persist(): void {
  saveSettings(localStorage, {
    trainId: currentSpec.id,
    layoutId: currentLayout.id,
    muted: sound.muted,
    night: dayNight.night,
  })
}

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
sound.flavour = currentSpec.sound
sound.muted = settings.muted
window.addEventListener('pointerdown', () => audioBackend.unlock())

// A puff of steam with every exhaust beat (even when muted — smoke isn't sound).
const smoke = new SmokeSystem()
scene.add(smoke.group)
sound.onBeat = (effort) => {
  const { position } = train.sampleBehindHead(CHIMNEY_BEHIND_HEAD)
  smoke.puff(new THREE.Vector3(position.x, RAIL_TOP_Y + CHIMNEY_HEIGHT, position.z), effort)
}

const followCam = new FollowCam(camera, orbit, () => train, homePose)

const controls = createControls(() => train, document.body, { onWhistle: () => sound.whistle() })
createCameraButton(document.body, () => followCam.toggle())
createTrainPicker(document.body, TRAINS, () => currentSpec.id, setTrain)
createLayoutPicker(document.body, LAYOUTS, () => currentLayout.id, setLayout)

const dayNight = new DayNight(scene, lights.hemi, lights.sun)
dayNight.night = settings.night
createNightButton(
  document.body,
  () => {
    const night = dayNight.toggle()
    persist()
    return night
  },
  settings.night,
)
createMuteButton(
  document.body,
  () => sound.muted,
  (muted) => {
    sound.muted = muted
    persist()
  },
)
attachTapPoints(renderer.domElement, camera, () => pointsMesh, () => track, () => sound.pointClunk())

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

// Offline: register the service worker (production builds only — it would
// fight the dev server's module reloading). After registering, prime the
// cache with everything this page already loaded: those requests happened
// before the worker took control, and the very first visit must be enough
// to play offline afterwards.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('sw.js').then(async () => {
      const loaded = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => url.startsWith(location.origin))
      const cache = await caches.open('trainset-v1') // must match sw.js
      await Promise.all(
        [...new Set(['./', ...loaded])].map((url) => cache.add(url).catch(() => {})),
      )
    })
  })
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
  dayNight.update(dt)
  controls.update()
  if (followCam.active) followCam.update(dt)
  else orbit.update()
  renderer.render(scene, camera)
})
