import { describe, expect, it } from 'vitest'
import { SoundDirector, type SoundBackend } from './sound'

function fakeBackend(): SoundBackend & { chuffs: number[]; whistles: number; clunks: number } {
  const log = {
    chuffs: [] as number[],
    whistles: 0,
    clunks: 0,
    chuff(speedNorm: number) {
      log.chuffs.push(speedNorm)
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

/** Run the director for `seconds` at a fixed speed; returns chuff count. */
function chuffsIn(director: SoundDirector, backend: { chuffs: number[] }, seconds: number, speed: number): number {
  const before = backend.chuffs.length
  for (let i = 0; i < seconds * 60; i++) director.update(1 / 60, speed)
  return backend.chuffs.length - before
}

describe('SoundDirector', () => {
  it('barely moving = slow deliberate chuffs; a modest crawl already has a lively beat', () => {
    const backend = fakeBackend()
    const director = new SoundDirector(backend) // max rate 5/s at full speed 0.25
    // Creeping at 1% of top speed: distinctly slow (well under 1 chuff/s).
    expect(chuffsIn(director, backend, 10, 0.0025)).toBeLessThanOrEqual(8)
    // A crawl at 15% of top speed: already a proper rhythm (~2/s).
    const crawl = chuffsIn(director, backend, 10, 0.0375)
    expect(crawl).toBeGreaterThanOrEqual(15)
    expect(crawl).toBeLessThanOrEqual(25)
  })

  it('rate keeps rising with speed, but sub-linearly (doubling speed does not double the beat)', () => {
    const backend = fakeBackend()
    const director = new SoundDirector(backend)
    const atHalf = chuffsIn(director, backend, 10, 0.125)
    const atFull = chuffsIn(director, backend, 10, 0.25)
    expect(atFull).toBeGreaterThan(atHalf)
    expect(atFull).toBeLessThan(atHalf * 1.7) // sqrt-ish, not linear
  })

  it('is silent at a standstill', () => {
    const backend = fakeBackend()
    const director = new SoundDirector(backend)
    for (let i = 0; i < 120; i++) director.update(1 / 60, 0)
    expect(backend.chuffs).toHaveLength(0)
  })

  it('mute silences everything and unmute resumes', () => {
    const backend = fakeBackend()
    const director = new SoundDirector(backend)
    director.muted = true
    for (let i = 0; i < 120; i++) director.update(1 / 60, 0.2)
    director.whistle()
    director.pointClunk()
    expect(backend.chuffs).toHaveLength(0)
    expect(backend.whistles).toBe(0)
    expect(backend.clunks).toBe(0)

    director.muted = false
    for (let i = 0; i < 120; i++) director.update(1 / 60, 0.2)
    director.whistle()
    director.pointClunk()
    expect(backend.chuffs.length).toBeGreaterThan(0)
    expect(backend.whistles).toBe(1)
    expect(backend.clunks).toBe(1)
  })

  it('reports normalised speed to the backend (which makes fast running quieter)', () => {
    const backend = fakeBackend()
    const director = new SoundDirector(backend)
    chuffsIn(director, backend, 5, 0.05)
    const slowNorm = backend.chuffs.at(-1)!
    chuffsIn(director, backend, 5, 0.25)
    const fastNorm = backend.chuffs.at(-1)!
    expect(slowNorm).toBeCloseTo(0.2, 5)
    expect(fastNorm).toBeCloseTo(1, 5)
  })
})
