/**
 * Remember how the set was left: chosen train and layout, sound and
 * night. Versioned so future shape changes fall back gracefully, and
 * defensive against corrupt storage — a broken value must never break
 * the toy.
 */
import { LAYOUTS, type LayoutId } from './layouts'
import { TRAINS, type TrainId } from './trains'

export interface Settings {
  trainId: TrainId
  layoutId: LayoutId
  muted: boolean
  night: boolean
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const KEY = 'pm_trainsim.settings'
const VERSION = 1

const DEFAULTS: Settings = { trainId: 'mallard', layoutId: 'siding', muted: false, night: false }

function isTrainId(value: unknown): value is TrainId {
  return TRAINS.some((t) => t.id === value)
}

function isLayoutId(value: unknown): value is LayoutId {
  return LAYOUTS.some((l) => l.id === value)
}

export function loadSettings(storage: StorageLike): Settings {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as { v?: unknown }).v !== VERSION ||
      typeof (parsed as { data?: unknown }).data !== 'object'
    ) {
      return { ...DEFAULTS }
    }
    const data = (parsed as { data: Record<string, unknown> }).data
    return {
      trainId: isTrainId(data.trainId) ? data.trainId : DEFAULTS.trainId,
      layoutId: isLayoutId(data.layoutId) ? data.layoutId : DEFAULTS.layoutId,
      muted: data.muted === true,
      night: data.night === true,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(storage: StorageLike, settings: Settings): void {
  try {
    storage.setItem(KEY, JSON.stringify({ v: VERSION, data: settings }))
  } catch {
    // Private browsing or full quota: play on without remembering.
  }
}
