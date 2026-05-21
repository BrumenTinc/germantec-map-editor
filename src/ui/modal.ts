/**
 * Shared modal helper — opens/closes dark-overlay modals.
 */

export function createModal(title: string, content: HTMLElement, onConfirm?: () => void, confirmLabel = 'Guardar'): HTMLElement {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.7);
    display:flex; align-items:center; justify-content:center; z-index:1000;
  `

  const box = document.createElement('div')
  box.style.cssText = `
    background:#1f2937; border:1px solid #374151; border-radius:8px;
    min-width:400px; max-width:600px; max-height:80vh;
    display:flex; flex-direction:column; overflow:hidden;
  `

  // Header
  const header = document.createElement('div')
  header.style.cssText = `
    padding:14px 16px; border-bottom:1px solid #374151;
    display:flex; align-items:center; justify-content:space-between;
    font-weight:600; font-size:14px; color:#f9fafb;
  `
  header.innerHTML = `<span>${title}</span>`

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕'
  closeBtn.style.cssText = `
    background:none; border:none; color:#9ca3af; cursor:pointer;
    font-size:16px; padding:0 4px; line-height:1;
  `
  closeBtn.onclick = () => overlay.remove()
  header.appendChild(closeBtn)

  // Body
  const body = document.createElement('div')
  body.style.cssText = 'padding:16px; overflow-y:auto; flex:1;'
  body.appendChild(content)

  // Footer
  const footer = document.createElement('div')
  footer.style.cssText = `
    padding:12px 16px; border-top:1px solid #374151;
    display:flex; justify-content:flex-end; gap:8px;
  `

  const cancelBtn = document.createElement('button')
  cancelBtn.textContent = 'Cancelar'
  cancelBtn.style.cssText = btnStyle('#374151', '#e5e7eb')
  cancelBtn.onclick = () => overlay.remove()

  footer.appendChild(cancelBtn)

  if (onConfirm) {
    const confirmBtn = document.createElement('button')
    confirmBtn.textContent = confirmLabel
    confirmBtn.style.cssText = btnStyle('#06b6d4', '#fff')
    confirmBtn.onclick = () => { onConfirm(); overlay.remove() }
    footer.appendChild(confirmBtn)
  }

  box.appendChild(header)
  box.appendChild(body)
  box.appendChild(footer)
  overlay.appendChild(box)

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })

  return overlay
}

export function field(label: string, input: HTMLElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'margin-bottom:12px;'
  const lbl = document.createElement('label')
  lbl.textContent = label
  lbl.style.cssText = 'display:block; font-size:11px; color:#9ca3af; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.05em;'
  wrap.appendChild(lbl)
  wrap.appendChild(input)
  return wrap
}

export function inputText(value = '', placeholder = ''): HTMLInputElement {
  const el = document.createElement('input')
  el.type = 'text'
  el.value = value
  el.placeholder = placeholder
  el.style.cssText = `
    width:100%; padding:7px 10px; background:#111827; border:1px solid #374151;
    border-radius:4px; color:#e5e7eb; font-size:13px; outline:none;
    box-sizing:border-box;
  `
  el.onfocus = () => el.style.borderColor = '#06b6d4'
  el.onblur  = () => el.style.borderColor = '#374151'
  return el
}

export function inputNumber(value = 0, min = 0, max = 9999): HTMLInputElement {
  const el = document.createElement('input')
  el.type = 'number'
  el.value = String(value)
  el.min = String(min)
  el.max = String(max)
  el.style.cssText = `
    width:100%; padding:7px 10px; background:#111827; border:1px solid #374151;
    border-radius:4px; color:#e5e7eb; font-size:13px; outline:none;
    box-sizing:border-box;
  `
  return el
}

export function selectEl(options: string[], value?: string): HTMLSelectElement {
  const el = document.createElement('select')
  el.style.cssText = `
    width:100%; padding:7px 10px; background:#111827; border:1px solid #374151;
    border-radius:4px; color:#e5e7eb; font-size:13px; outline:none;
    box-sizing:border-box;
  `
  for (const opt of options) {
    const o = document.createElement('option')
    o.value = opt
    o.textContent = opt
    if (opt === value) o.selected = true
    el.appendChild(o)
  }
  return el
}

function btnStyle(bg: string, color: string): string {
  return `
    padding:7px 16px; background:${bg}; color:${color};
    border:none; border-radius:4px; cursor:pointer; font-size:13px;
    transition:opacity 0.15s;
  `
}
