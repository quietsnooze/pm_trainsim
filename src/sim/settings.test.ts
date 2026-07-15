import { describe, expect, it } from 'vitest'
import { loadSettings, saveSettings, type StorageLike } from './settings'

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  }
}

describe('settings memory', () => {
  it('first run lands on sensible defaults', () => {
    expect(loadSettings(fakeStorage())).toEqual({
      trainId: 'mallard',
      layoutId: 'siding',
      muted: false,
      night: false,
    })
  })

  it('round-trips everything', () => {
    const storage = fakeStorage()
    saveSettings(storage, { trainId: 'azuma', layoutId: 'eight', muted: true, night: true })
    expect(loadSettings(storage)).toEqual({
      trainId: 'azuma',
      layoutId: 'eight',
      muted: true,
      night: true,
    })
  })

  it('corrupt JSON falls back to defaults without throwing', () => {
    const storage = fakeStorage({ 'pm_trainsim.settings': '{oops' })
    expect(loadSettings(storage).trainId).toBe('mallard')
  })

  it('an unknown train or layout id falls back per-field', () => {
    const storage = fakeStorage({
      'pm_trainsim.settings': JSON.stringify({
        v: 1,
        data: { trainId: 'concorde', layoutId: 'eight', muted: true, night: 'maybe' },
      }),
    })
    expect(loadSettings(storage)).toEqual({
      trainId: 'mallard', // unknown -> default
      layoutId: 'eight', // valid -> kept
      muted: true,
      night: false, // non-boolean -> default
    })
  })

  it('a future schema version falls back wholesale', () => {
    const storage = fakeStorage({
      'pm_trainsim.settings': JSON.stringify({ v: 99, data: { trainId: 'azuma' } }),
    })
    expect(loadSettings(storage).trainId).toBe('mallard')
  })
})
