import type { LayoutSpec } from '../sim/layouts'

const CSS = `
.tc-layout {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 224px);
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
.tc-layout-card {
  width: 128px;
  height: 130px;
  border-radius: 22px;
  border: 3px solid rgba(255, 255, 255, 0.25);
  background: #3f6b35;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #f3efe4;
  font-family: inherit;
}
.tc-layout-card[data-current='1'] {
  border-color: #ffd54a;
}
.tc-layout-card .tc-layout-name {
  font: 600 12px/1.2 inherit;
  opacity: 0.85;
}
`

/** A little white track sketch of the layout's shape. */
function sketch(id: LayoutSpec['id']): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 60
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = '#efe9dc'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  if (id === 'oval' || id === 'siding') {
    ctx.beginPath()
    ctx.ellipse(48, 32, 35, 17, 0, 0, Math.PI * 2)
    ctx.stroke()
    if (id === 'siding') {
      ctx.beginPath()
      ctx.moveTo(42, 15)
      ctx.quadraticCurveTo(58, 6, 84, 6)
      ctx.stroke()
    }
  } else {
    ctx.beginPath()
    ctx.ellipse(29, 30, 20, 20, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(67, 30, 20, 20, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  return canvas
}

/** Layout picker: a 🛤 button opening cards sketched with each track shape. */
export function createLayoutPicker(
  root: HTMLElement,
  layouts: LayoutSpec[],
  currentId: () => string,
  onPick: (spec: LayoutSpec) => void,
): void {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const button = document.createElement('button')
  button.className = 'tc-layout'
  button.textContent = '🛤️'
  button.setAttribute('aria-label', 'Choose a track layout')
  root.appendChild(button)

  button.addEventListener('click', () => {
    const backdrop = document.createElement('div')
    backdrop.className = 'tc-picker-backdrop' // reuse the train picker's overlay style
    const close = (): void => backdrop.remove()
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close()
    })
    for (const spec of layouts) {
      const card = document.createElement('button')
      card.className = 'tc-layout-card'
      card.dataset.current = spec.id === currentId() ? '1' : ''
      card.setAttribute('aria-label', spec.name)
      const name = document.createElement('div')
      name.className = 'tc-layout-name'
      name.textContent = spec.name
      card.append(sketch(spec.id), name)
      card.addEventListener('click', () => {
        onPick(spec)
        close()
      })
      backdrop.appendChild(card)
    }
    root.appendChild(backdrop)
  })
}
