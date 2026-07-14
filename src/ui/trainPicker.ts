import type { TrainSpec } from '../sim/trains'

const CSS = `
.tc-train {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 84px);
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
.tc-picker-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 16, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  z-index: 10;
}
.tc-card {
  width: 116px;
  height: 150px;
  border-radius: 22px;
  border: 3px solid rgba(255, 255, 255, 0.25);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #f3efe4;
  font-family: inherit;
}
.tc-card[data-current='1'] {
  border-color: #ffd54a;
}
.tc-card .tc-card-number {
  font: 800 30px/1 inherit;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
}
.tc-card .tc-card-name {
  font: 600 12px/1.2 inherit;
  opacity: 0.85;
  text-align: center;
  padding: 0 6px;
}
`

/**
 * Train picker: a 🚂 button opening big colour cards, one per train —
 * the number front and centre, because numbers are how our driver knows
 * his engines.
 */
export function createTrainPicker(
  root: HTMLElement,
  trains: TrainSpec[],
  currentId: () => string,
  onPick: (spec: TrainSpec) => void,
): void {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const button = document.createElement('button')
  button.className = 'tc-train'
  button.textContent = '🚂'
  button.setAttribute('aria-label', 'Choose a train')
  root.appendChild(button)

  button.addEventListener('click', () => {
    const backdrop = document.createElement('div')
    backdrop.className = 'tc-picker-backdrop'
    const close = (): void => backdrop.remove()
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close()
    })
    for (const spec of trains) {
      const card = document.createElement('button')
      card.className = 'tc-card'
      card.style.background = spec.cardColor
      card.dataset.current = spec.id === currentId() ? '1' : ''
      card.setAttribute('aria-label', `${spec.name} ${spec.number}`)
      const number = document.createElement('div')
      number.className = 'tc-card-number'
      number.textContent = spec.number
      const name = document.createElement('div')
      name.className = 'tc-card-name'
      name.textContent = spec.name
      card.append(number, name)
      card.addEventListener('click', () => {
        onPick(spec)
        close()
      })
      backdrop.appendChild(card)
    }
    root.appendChild(backdrop)
  })
}
