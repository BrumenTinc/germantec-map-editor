import { createModal, field, inputNumber } from './modal'
import { SpawnDefinition, SpawnCreature } from '../types'

export function showSpawnModal(
  initial: SpawnDefinition | null,
  centerX: number,
  centerY: number,
  centerZ: number,
  monsterNames: string[],
  onSave: (spawn: SpawnDefinition) => void,
  onDelete?: () => void
): void {
  const isEdit = !!initial

  const radiusInput = inputNumber(initial?.radius ?? 3, 1, 10)
  const radiusDisplay = document.createElement('span')
  radiusDisplay.style.cssText = 'margin-left:8px; color:#06b6d4; font-size:13px;'
  radiusDisplay.textContent = String(initial?.radius ?? 3)
  radiusInput.oninput = () => { radiusDisplay.textContent = radiusInput.value }

  const radiusRow = document.createElement('div')
  radiusRow.style.display = 'flex'
  radiusRow.style.alignItems = 'center'
  radiusInput.type = 'range'
  radiusInput.style.flex = '1'
  radiusRow.appendChild(radiusInput)
  radiusRow.appendChild(radiusDisplay)

  // Creature list
  const creatures: SpawnCreature[] = initial
    ? initial.creatures.map(c => ({ ...c }))
    : []

  const creatureTableBody = document.createElement('tbody')

  const addCreatureRow = (creature?: SpawnCreature): void => {
    const row = document.createElement('tr')
    row.style.cssText = 'border-bottom:1px solid #374151;'

    // Autocomplete name input
    const nameCell = document.createElement('td')
    nameCell.style.padding = '4px'
    const nameWrap = document.createElement('div')
    nameWrap.style.position = 'relative'
    const nameInput = document.createElement('input')
    nameInput.value = creature?.name || ''
    nameInput.placeholder = 'Monstruo...'
    nameInput.style.cssText = `
      width:100%; padding:5px 8px; background:#111827; border:1px solid #374151;
      border-radius:4px; color:#e5e7eb; font-size:12px; outline:none; box-sizing:border-box;
    `

    // Autocomplete dropdown
    const dropdown = document.createElement('div')
    dropdown.style.cssText = `
      position:absolute; top:100%; left:0; right:0; background:#1f2937;
      border:1px solid #374151; border-radius:4px; max-height:150px;
      overflow-y:auto; z-index:100; display:none;
    `

    nameInput.addEventListener('input', () => {
      const q = nameInput.value.toLowerCase()
      dropdown.innerHTML = ''
      if (!q) { dropdown.style.display = 'none'; return }
      const matches = monsterNames.filter(n => n.toLowerCase().includes(q)).slice(0, 20)
      if (matches.length === 0) { dropdown.style.display = 'none'; return }
      for (const m of matches) {
        const item = document.createElement('div')
        item.textContent = m
        item.style.cssText = 'padding:5px 8px; cursor:pointer; font-size:12px; color:#e5e7eb;'
        item.onmouseenter = () => item.style.background = '#374151'
        item.onmouseleave = () => item.style.background = ''
        item.onclick = () => { nameInput.value = m; dropdown.style.display = 'none' }
        dropdown.appendChild(item)
      }
      dropdown.style.display = 'block'
    })

    document.addEventListener('click', (e) => {
      if (!nameWrap.contains(e.target as Node)) dropdown.style.display = 'none'
    }, { once: true })

    nameWrap.appendChild(nameInput)
    nameWrap.appendChild(dropdown)
    nameCell.appendChild(nameWrap)

    // Qty
    const qtyCell = document.createElement('td')
    qtyCell.style.padding = '4px'
    const qtyInput = inputNumber(creature?.spawnTime !== undefined ? 1 : 1, 1, 99)
    qtyInput.style.width = '60px'
    qtyCell.appendChild(qtyInput)

    // Spawn time
    const timeCell = document.createElement('td')
    timeCell.style.padding = '4px'
    const timeInput = inputNumber(creature?.spawnTime ?? 60, 1, 9999)
    timeInput.style.width = '70px'
    timeCell.appendChild(timeInput)

    // Delete
    const delCell = document.createElement('td')
    delCell.style.padding = '4px'
    const delBtn = document.createElement('button')
    delBtn.textContent = '🗑️'
    delBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:14px;'
    delBtn.onclick = () => row.remove()
    delCell.appendChild(delBtn)

    row.appendChild(nameCell)
    row.appendChild(qtyCell)
    row.appendChild(timeCell)
    row.appendChild(delCell)
    creatureTableBody.appendChild(row)

    // Store refs on row
    ;(row as any)._nameInput = nameInput
    ;(row as any)._timeInput = timeInput
  }

  for (const c of creatures) addCreatureRow(c)

  const table = document.createElement('table')
  table.style.cssText = 'width:100%; border-collapse:collapse;'
  const thead = document.createElement('thead')
  thead.innerHTML = `
    <tr style="font-size:11px; color:#9ca3af; text-transform:uppercase;">
      <th style="text-align:left;padding:4px;">Monstruo</th>
      <th style="text-align:left;padding:4px;">Cant.</th>
      <th style="text-align:left;padding:4px;">Respawn (s)</th>
      <th></th>
    </tr>
  `
  table.appendChild(thead)
  table.appendChild(creatureTableBody)

  const addBtn = document.createElement('button')
  addBtn.textContent = '+ Agregar monstruo'
  addBtn.style.cssText = `
    margin-top:8px; padding:6px 12px; background:#374151; color:#e5e7eb;
    border:none; border-radius:4px; cursor:pointer; font-size:12px; width:100%;
  `
  addBtn.onclick = () => addCreatureRow()

  const content = document.createElement('div')
  content.appendChild(field('Radio (tiles)', radiusRow))

  const posInfo = document.createElement('p')
  posInfo.style.cssText = 'font-size:11px; color:#6b7280; margin-bottom:12px;'
  posInfo.textContent = `Centro: X=${centerX}  Y=${centerY}  Z=${centerZ}`
  content.appendChild(posInfo)

  content.appendChild(table)
  content.appendChild(addBtn)

  if (isEdit && onDelete) {
    const deleteBtn = document.createElement('button')
    deleteBtn.textContent = '🗑️ Eliminar Spawn'
    deleteBtn.style.cssText = `
      margin-top:16px; padding:7px 12px; background:#dc2626; color:#fff;
      border:none; border-radius:4px; cursor:pointer; font-size:13px; width:100%;
    `
    deleteBtn.onclick = () => {
      if (confirm('¿Eliminar este spawn?')) {
        onDelete()
        document.querySelector('.modal-overlay')?.remove()
      }
    }
    content.appendChild(deleteBtn)
  }

  const onConfirm = () => {
    const rows = Array.from(creatureTableBody.querySelectorAll('tr'))
    const newCreatures: SpawnCreature[] = rows
      .filter(row => (row as any)._nameInput?.value.trim())
      .map(row => ({
        kind: 'monster' as const,
        name: (row as any)._nameInput.value.trim(),
        x: centerX,
        y: centerY,
        z: centerZ,
        direction: 0,
        spawnTime: Number((row as any)._timeInput?.value) || 60
      }))

    onSave({
      centerX,
      centerY,
      centerZ,
      radius: Number(radiusInput.value) || 3,
      creatures: newCreatures
    })
  }

  const modal = createModal(
    isEdit ? 'Editar Spawn' : 'Crear Spawn',
    content,
    onConfirm
  )
  document.body.appendChild(modal)
}
