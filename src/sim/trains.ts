/**
 * The train catalogue: identity as data. Scene-side builders turn an id
 * into meshes; the sim only cares about the kinematics profile and sound
 * flavour. Adding a train = adding an entry + a builder.
 */

export type TrainId = 'mallard' | 'scotsman'
export type SoundFlavour = 'steam' | 'electric'

export interface KinematicsProfile {
  /** Top speed in tabletop metres per second. */
  maxSpeed: number
  /** How quickly actual speed chases target (per second). */
  accel: number
}

export interface TrainSpec {
  id: TrainId
  name: string
  number: string
  /** Colour for the picker card. */
  cardColor: string
  sound: SoundFlavour
  smoke: boolean
  kinematics: KinematicsProfile
}

export const TRAINS: TrainSpec[] = [
  {
    id: 'mallard',
    name: 'Mallard',
    number: '4468',
    cardColor: '#2b4a8b',
    sound: 'steam',
    smoke: true,
    kinematics: { maxSpeed: 0.25, accel: 2.5 }, // the record-breaker
  },
  {
    id: 'scotsman',
    name: 'Flying Scotsman',
    number: '4472',
    cardColor: '#3d6b3a',
    sound: 'steam',
    smoke: true,
    kinematics: { maxSpeed: 0.21, accel: 2.1 }, // stately by comparison
  },
]

export function trainSpec(id: TrainId): TrainSpec {
  const spec = TRAINS.find((t) => t.id === id)
  if (!spec) throw new Error(`unknown train: ${id}`)
  return spec
}
