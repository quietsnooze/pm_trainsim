import { describe, expect, it } from 'vitest'
import { SoundDirector, type SoundBackend } from './sound'

function fakeBackend(): SoundBackend & { chuffs: number[]; whistles: number; clunks: number } {
  const log = {
    chuffs: [] as number[],
    whistles: 0,
    clunks: 0,
    chuff(intensity: number) {
      log.chuffs.push(intensity)
    },
    whistle() {
      log.whistles++
    },
    clunk() {
      log.clunks++
    },
  }
  return log
}

describe('SoundDirector', () => {
  it('fires chuffs at a rate proportional to speed', () => {
    const backend = fakeBackend()
    const director = new SoundDirector(backend, 20) // 20 chuffs per metre
    // 10 simulated seconds at 0.1 m/s -> ~20 chuffs; at 0.2 m/s -> ~40.
    for (let i = 0; i < 600; i++) director.update(1 / 60, 0.1)
    const slow = backend.chuffs.length
    for (let i = 0; i < 600; i++) director.update(1 / 60, 0.2)
    const fast = backend.chuffs.length - slow
    expect(Math.abs(slow - 20)).toBeLessThanOrEqual(1)
    expect(Math.abs(fast - 40)).toBeLessThanOrEqual(1)
  })

  it('is silent at a standstill', () => {
    const backend = fakeBackend()
    const director = new SoundDirector(backend, 20)
    for (let i = 0; i < 120; i++) director.update(1 / 60, 0)
    expect(backend.chuffs).toHaveLength(0)
  })

  it('mute silences everything and unmute resumes', () => {
    const backend = fakeBackend()
    const director = new SoundDirector(backend, 20)
    director.muted = true
    for (let i = 0; i < 60; i++) director.update(1 / 60, 0.2)
    director.whistle()
    director.pointClunk()
    expect(backend.chuffs).toHaveLength(0)
    expect(backend.whistles).toBe(0)
    expect(backend.clunks).toBe(0)

    director.muted = false
    for (let i = 0; i < 60; i++) director.update(1 / 60, 0.2)
    director.whistle()
    director.pointClunk()
    expect(backend.chuffs.length).toBeGreaterThan(0)
    expect(backend.whistles).toBe(1)
    expect(backend.clunks).toBe(1)
  })

  it('chuffs get more intense with speed', () => {
    const backend = fakeBackend()
    const director = new SoundDirector(backend, 20)
    for (let i = 0; i < 180; i++) director.update(1 / 60, 0.05)
    const gentle = backend.chuffs.at(-1)!
    for (let i = 0; i < 180; i++) director.update(1 / 60, 0.25)
    const hard = backend.chuffs.at(-1)!
    expect(hard).toBeGreaterThan(gentle)
    expect(gentle).toBeGreaterThan(0)
    expect(hard).toBeLessThanOrEqual(1)
  })
})
