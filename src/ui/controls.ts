import type { Train } from '../sim/train'

const CSS = `
.tc-panel {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 18px;
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
  width: min(46vw, 220px);
  height: 34px;
  background: transparent;
  touch-action: none;
}
.tc-throttle::-webkit-slider-runnable-track {
  height: 10px;
  border-radius: 5px;
  background: linear-gradient(90deg, #3a4150, #b8873b);
}
.tc-throttle::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 30px;
  height: 30px;
  margin-top: -10px;
  border-radius: 50%;
  background: #e8e6e0;
  border: 3px solid #b8873b;
}
.tc-throttle::-moz-range-track {
  height: 10px;
  border-radius: 5px;
  background: linear-gradient(90deg, #3a4150, #b8873b);
}
.tc-throttle::-moz-range-thumb {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #e8e6e0;
  border: 3px solid #b8873b;
}
.tc-dir {
  font: 600 13px/1 inherit;
  letter-spacing: 0.06em;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid #4a5162;
  background: #262b35;
  color: #e8e6e0;
  min-width: 58px;
}
.tc-dir[data-blocked='1'] {
  border-color: #a04a44;
  color: #e0a09a;
}
.tc-speed {
  font: 600 12px/1.2 inherit;
  min-width: 44px;
  text-align: center;
  opacity: 0.75;
}
`

/**
 * Provisional driving panel: throttle slider + direction toggle.
 * (The proper skeuomorphic controller replaces this in v1 — see CLAUDE.md.)
 */
export function createControls(train: Train, root: HTMLElement): { update(): void } {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const panel = document.createElement('div')
  panel.className = 'tc-panel'

  const dirButton = document.createElement('button')
  dirButton.className = 'tc-dir'
  dirButton.textContent = 'FWD'

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

  panel.append(dirButton, throttle, speed)
  root.appendChild(panel)

  throttle.addEventListener('input', () => {
    train.throttle = Number(throttle.value) / 100
  })

  dirButton.addEventListener('click', () => {
    const next = train.direction === 1 ? -1 : 1
    if (train.setDirection(next)) {
      dirButton.textContent = next === 1 ? 'FWD' : 'REV'
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
      speed.textContent = String(Math.round(train.speed * 500))
    },
  }
}
