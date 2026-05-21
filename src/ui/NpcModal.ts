import { createModal, field, inputText, selectEl, inputNumber } from './modal'
import { NpcDefinition, NpcType, Position } from '../types'

export function showNpcModal(
  initial: Partial<NpcDefinition> | null,
  position: Position,
  onSave: (npc: NpcDefinition) => void,
  onDelete?: () => void
): void {
  const isEdit = !!initial

  const nameInput   = inputText(initial?.name || '', 'Nombre del NPC')
  const typeSelect  = selectEl(['dialog', 'shop', 'quest'], initial?.type || 'dialog')
  const scriptInput = inputText(initial?.script || '', 'e.g. elara.lua')
  const dirSelect   = selectEl(['Norte (0)', 'Este (1)', 'Sur (2)', 'Oeste (3)'])
  dirSelect.selectedIndex = initial?.direction ?? 2

  const lookTypeInput = inputNumber(initial?.lookType ?? 136, 1, 9999)
  const lookHeadInput = inputNumber(initial?.lookHead ?? 0, 0, 132)
  const lookBodyInput = inputNumber(initial?.lookBody ?? 0, 0, 132)
  const lookLegsInput = inputNumber(initial?.lookLegs ?? 0, 0, 132)
  const lookFeetInput = inputNumber(initial?.lookFeet ?? 0, 0, 132)

  const content = document.createElement('div')

  content.appendChild(field('Nombre *', nameInput))
  content.appendChild(field('Tipo', typeSelect))
  content.appendChild(field('Script (.lua)', scriptInput))
  content.appendChild(field('Dirección', dirSelect))

  const lookRow = document.createElement('div')
  lookRow.style.cssText = 'display:grid; grid-template-columns:1fr 1fr 1fr 1fr 1fr; gap:8px;'
  lookRow.appendChild(fieldSmall('Look Type', lookTypeInput))
  lookRow.appendChild(fieldSmall('Head', lookHeadInput))
  lookRow.appendChild(fieldSmall('Body', lookBodyInput))
  lookRow.appendChild(fieldSmall('Legs', lookLegsInput))
  lookRow.appendChild(fieldSmall('Feet', lookFeetInput))
  content.appendChild(lookRow)

  // Position info (read-only display)
  const posInfo = document.createElement('p')
  posInfo.style.cssText = 'font-size:11px; color:#6b7280; margin-top:8px;'
  posInfo.textContent = `Posición: X=${position.x}  Y=${position.y}  Z=${position.z}`
  content.appendChild(posInfo)

  // Delete button (edit mode only)
  if (isEdit && onDelete) {
    const deleteBtn = document.createElement('button')
    deleteBtn.textContent = '🗑️ Eliminar NPC'
    deleteBtn.style.cssText = `
      margin-top:16px; padding:7px 12px; background:#dc2626; color:#fff;
      border:none; border-radius:4px; cursor:pointer; font-size:13px; width:100%;
    `
    deleteBtn.onclick = () => {
      if (confirm(`¿Eliminar el NPC "${initial?.name || ''}"?`)) {
        onDelete()
        document.querySelector('.modal-overlay')?.remove()
      }
    }
    content.appendChild(deleteBtn)
  }

  const onConfirm = () => {
    const name = nameInput.value.trim()
    if (!name) { alert('El nombre es requerido.'); return }

    const npc: NpcDefinition = {
      name,
      type: typeSelect.value as NpcType,
      script: scriptInput.value.trim() || `${name.toLowerCase().replace(/\s+/g, '_')}.lua`,
      direction: dirSelect.selectedIndex,
      lookType:   Number(lookTypeInput.value) || 136,
      lookHead:   Number(lookHeadInput.value) || 0,
      lookBody:   Number(lookBodyInput.value) || 0,
      lookLegs:   Number(lookLegsInput.value) || 0,
      lookFeet:   Number(lookFeetInput.value) || 0,
      lookAddons: initial?.lookAddons ?? 0,
      walkInterval: initial?.walkInterval ?? 0,
      position
    }
    onSave(npc)
  }

  const modal = createModal(
    isEdit ? `Editar NPC — ${initial?.name}` : 'Crear NPC',
    content,
    onConfirm
  )
  document.body.appendChild(modal)
  nameInput.focus()
}

function fieldSmall(label: string, input: HTMLElement): HTMLElement {
  const wrap = document.createElement('div')
  const lbl = document.createElement('label')
  lbl.textContent = label
  lbl.style.cssText = 'display:block; font-size:10px; color:#9ca3af; margin-bottom:3px;'
  wrap.appendChild(lbl)
  wrap.appendChild(input)
  return wrap
}
