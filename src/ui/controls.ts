import type { Train } from '../sim/train'

const CSS = `
.tc-panel {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  max-width: calc(100vw - 16px);
  border-radius: 18px;
  background: rgba(24, 27, 33, 0.82);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  color: #e8e6e0;
}
.tc-throttle {
  -webkit-appearance: none;
  appearance: none;
  width: min(38vw, 220px);
  height: 56px;
  flex-shrink: 1;
  min-width: 110px;
  background: transparent;
  touch-action: none;
}
.tc-throttle::-webkit-slider-runnable-track {
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(90deg, #3a4150, #b8873b);
}
.tc-throttle::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 48px;
  height: 48px;
  margin-top: -17px;
  border-radius: 50%;
  background: #e8e6e0;
  border: 4px solid #b8873b;
}
.tc-throttle::-moz-range-track {
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(90deg, #3a4150, #b8873b);
}
.tc-throttle::-moz-range-thumb {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #e8e6e0;
  border: 4px solid #b8873b;
}
.tc-dir {
  font: 600 26px/1 inherit;
  padding: 0;
  width: 58px;
  height: 58px;
  border-radius: 16px;
  border: 1px solid #4a5162;
  background: #262b35;
  color: #e8e6e0;
}
.tc-dir[data-blocked='1'] {
  border-color: #a04a44;
  color: #e0a09a;
}
.tc-whistle {
  font: 600 26px/1 inherit;
  padding: 0;
  width: 58px;
  height: 58px;
  border-radius: 16px;
  border: 1px solid #4a5162;
  background: #262b35;
  color: #ffd54a;
}
.tc-whistle:active {
  background: #3a4150;
}
.tc-mute {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 14px);
  right: calc(env(safe-area-inset-right, 0px) + 14px);
  font: 400 28px/1 inherit;
  width: 58px;
  height: 58px;
  border-radius: 16px;
  border: 1px solid #4a5162;
  background: rgba(24, 27, 33, 0.82);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.tc-cam {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 14px);
  left: calc(env(safe-area-inset-left, 0px) + 14px);
  font: 400 28px/1 inherit;
  width: 58px;
  height: 58px;
  border-radius: 16px;
  border: 1px solid #4a5162;
  background: rgba(24, 27, 33, 0.82);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.tc-cam[data-active='1'] {
  border-color: #b8873b;
  background: rgba(58, 46, 20, 0.85);
}
.tc-speed {
  font: 600 12px/1.2 inherit;
  min-width: 30px;
  text-align: center;
  opacity: 0.75;
}
.tc-dir,
.tc-whistle {
  flex-shrink: 0;
}
`

export interface ControlsOptions {
  /** Called when the whistle button is pressed. */
  onWhistle?: () => void
}

/**
 * The driving panel: throttle slider + direction toggle (play-tested and
 * locked — see PRD #3), plus the whistle button.
 */
export function createControls(
  getTrain: () => Train,
  root: HTMLElement,
  options: ControlsOptions = {},
): { update(): void } {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const panel = document.createElement('div')
  panel.className = 'tc-panel'

  // Direction shown as an arrow, not words — the driver is four.
  const dirButton = document.createElement('button')
  dirButton.className = 'tc-dir'
  dirButton.textContent = '▶'
  dirButton.setAttribute('aria-label', 'Direction: forward')

  const throttle = document.createElement('input')
  throttle.className = 'tc-throttle'
  throttle.type = 'range'
  throttle.min = '0'
  throttle.max = '100'
  throttle.value = '0'
  throttle.setAttribute('aria-label', 'Throttle')

  const speed = document.createElement('div')
  speed.className = 'tc-speed'
  speed.textContent = '0'

  const whistle = document.createElement('button')
  whistle.className = 'tc-whistle'
  whistle.textContent = '♪'
  whistle.setAttribute('aria-label', 'Whistle')
  whistle.addEventListener('click', () => options.onWhistle?.())

  panel.append(dirButton, throttle, whistle, speed)
  root.appendChild(panel)

  throttle.addEventListener('input', () => {
    getTrain().throttle = Number(throttle.value) / 100
  })

  dirButton.addEventListener('click', () => {
    const next = getTrain().direction === 1 ? -1 : 1
    if (getTrain().setDirection(next)) {
      dirButton.textContent = next === 1 ? '▶' : '◀'
      dirButton.setAttribute('aria-label', next === 1 ? 'Direction: forward' : 'Direction: reverse')
      dirButton.dataset.blocked = ''
    } else {
      // Can't reverse a moving train — nudge the driver to stop first.
      dirButton.dataset.blocked = '1'
      setTimeout(() => (dirButton.dataset.blocked = ''), 600)
    }
  })

  return {
    update() {
      // Scaled to read like a loco speedometer rather than tabletop m/s.
      speed.textContent = String(Math.round(getTrain().speed * 500))
    },
  }
}

/**
 * The camera-follow toggle (top-left): ride alongside the engine, or tap
 * again for the free tabletop view.
 */
export function createCameraButton(root: HTMLElement, onToggle: () => boolean): void {
  const button = document.createElement('button')
  button.className = 'tc-cam'
  button.textContent = '🎥'
  button.setAttribute('aria-label', 'Follow the engine')
  button.addEventListener('click', () => {
    const active = onToggle()
    button.dataset.active = active ? '1' : ''
    button.setAttribute('aria-label', active ? 'Following the engine — tap for tabletop view' : 'Follow the engine')
  })
  root.appendChild(button)
}

/**
 * The big always-visible mute button (top-right, clear of the notch).
 * One tap silences everything, instantly.
 */
export function createMuteButton(
  root: HTMLElement,
  isMuted: () => boolean,
  setMuted: (muted: boolean) => void,
): void {
  const button = document.createElement('button')
  button.className = 'tc-mute'
  const render = (): void => {
    button.textContent = isMuted() ? '🔇' : '🔊'
    button.setAttribute('aria-label', isMuted() ? 'Sound off — tap to unmute' : 'Sound on — tap to mute')
  }
  button.addEventListener('click', () => {
    setMuted(!isMuted())
    render()
  })
  render()
  root.appendChild(button)
}
