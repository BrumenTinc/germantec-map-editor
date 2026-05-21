/**
 * GermantecOT Map Editor — main entry point
 */
import { showSetupScreen } from './setup/SetupScreen'
import { AppConfig } from './types'
import { DatParser } from './parser/DatParser'
import type { ItemType } from './types'
import { SprParser } from './parser/SprParser'
import { OtbmParser, OtbmWriter } from './parser/OtbmParser'
import { SpawnParser } from './parser/SpawnParser'
import { NpcParser } from './parser/NpcParser'
import { MonsterListParser } from './parser/MonsterListParser'
import { SpriteCache } from './renderer/SpriteCache'
import { MapRenderer } from './renderer/MapRenderer'
import { editorState } from './editor/EditorState'
import { commandStack, PaintTileCommand, EraseTileCommand, BatchCommand, PasteCommand } from './editor/CommandStack'
import { showNpcModal } from './ui/NpcModal'
import { showSpawnModal } from './ui/SpawnModal'

let config: AppConfig
let renderer: MapRenderer
let spriteCache: SpriteCache
let npcParser: NpcParser
let spawnParser: SpawnParser

async function boot() {
  // ── 1. Load or request config ──────────────────────
  const saved = await window.electronAPI.loadConfig() as AppConfig | null
  if (saved?.datPath && saved?.sprPath && saved?.tfsRoot) {
    config = saved
  } else {
    config = await showSetupScreen()
  }

  // ── 2. Parse Tibia.dat + Tibia.spr ─────────────────
  const [datBuf, sprBuf] = await Promise.all([
    window.electronAPI.readBinary(config.datPath),
    window.electronAPI.readBinary(config.sprPath)
  ])

  const datParser = new DatParser(datBuf)
  datParser.parse()
  editorState.monsterNames = []  // will fill from monsters.xml

  spriteCache = new SpriteCache(sprBuf)

  // ── 3. Load monster list ────────────────────────────
  try {
    const monstersPath = await window.electronAPI.joinPath(config.tfsRoot, 'data', 'monster', 'monsters.xml')
    const monstersXml  = await window.electronAPI.readText(monstersPath)
    editorState.monsterNames = new MonsterListParser().parse(monstersXml)
  } catch (e) {
    console.warn('Could not load monsters.xml:', e)
  }

  npcParser   = new NpcParser()
  spawnParser = new SpawnParser()

  // ── 4. Build UI ─────────────────────────────────────
  buildUI(datParser.items)

  // ── 5. Auto-open last map ───────────────────────────
  if (config.lastMapPath) {
    await openMap(config.lastMapPath)
  }
}

// ──────────────────────────────────────────────────────
// UI Build
// ──────────────────────────────────────────────────────
function buildUI(items: Map<number, ItemType>) {
  const app = document.getElementById('app')!
  app.style.cssText = 'display:flex; flex-direction:column; height:100%;'

  app.innerHTML = `
    <!-- Toolbar -->
    <div id="toolbar" style="
      height:40px; background:#1f2937; border-bottom:1px solid #374151;
      display:flex; align-items:center; padding:0 8px; gap:4px; flex-shrink:0;
    ">
      <button class="tbtn" id="btn-open"  title="Abrir mapa (Ctrl+O)">📂 Abrir</button>
      <button class="tbtn" id="btn-save"  title="Guardar (Ctrl+S)">💾 Guardar</button>
      <div style="width:1px; height:24px; background:#374151; margin:0 4px;"></div>
      <button class="tbtn tool-btn active" id="tool-brush"  data-tool="brush"  title="Pincel (B)">✏️</button>
      <button class="tbtn tool-btn"        id="tool-eraser" data-tool="eraser" title="Borrador (E)">⬜</button>
      <button class="tbtn tool-btn"        id="tool-select" data-tool="select" title="Selección (S)">⬛</button>
      <button class="tbtn tool-btn"        id="tool-npc"    data-tool="npc"    title="NPC (N)">💬</button>
      <button class="tbtn tool-btn"        id="tool-spawn"  data-tool="spawn"  title="Spawn (P)">🐉</button>
      <div style="width:1px; height:24px; background:#374151; margin:0 4px;"></div>
      <label style="font-size:12px; color:#9ca3af;">Floor:</label>
      <button class="tbtn" id="floor-up"   title="Subir floor">▲</button>
      <span id="floor-display" style="font-size:13px; color:#06b6d4; min-width:16px; text-align:center;">7</span>
      <button class="tbtn" id="floor-down" title="Bajar floor">▼</button>
      <div style="width:1px; height:24px; background:#374151; margin:0 4px;"></div>
      <span id="zoom-display" style="font-size:12px; color:#9ca3af;">100%</span>
      <div style="width:1px; height:24px; background:#374151; margin:0 4px;"></div>
      <label style="font-size:12px; color:#9ca3af;">
        <input type="checkbox" id="toggle-npcs"   checked> NPCs
      </label>
      <label style="font-size:12px; color:#9ca3af; margin-left:8px;">
        <input type="checkbox" id="toggle-spawns" checked> Spawns
      </label>
      <div style="flex:1;"></div>
      <button class="tbtn" id="btn-settings" title="Configuración">⚙️</button>
    </div>

    <!-- Main area -->
    <div style="display:flex; flex:1; overflow:hidden;">
      <!-- Canvas -->
      <div style="flex:1; position:relative; overflow:hidden;">
        <canvas id="map-canvas" style="display:block; width:100%; height:100%;"></canvas>
        <!-- Minimap -->
        <div id="minimap-wrap" style="
          position:absolute; bottom:8px; right:8px;
          border:1px solid #374151; border-radius:4px; overflow:hidden;
          cursor:pointer;
        ">
          <canvas id="minimap-canvas" width="200" height="200"></canvas>
        </div>
      </div>

      <!-- Palette -->
      <div id="palette" style="
        width:280px; background:#1f2937; border-left:1px solid #374151;
        display:flex; flex-direction:column; overflow:hidden;
      ">
        <div style="padding:8px; border-bottom:1px solid #374151; font-size:12px; color:#9ca3af; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">
          Paleta
        </div>
        <div style="padding:8px; border-bottom:1px solid #374151;">
          <input id="palette-search" type="number" min="100" placeholder="Buscar por ID..." style="
            width:100%; padding:6px 8px; background:#111827; border:1px solid #374151;
            border-radius:4px; color:#e5e7eb; font-size:12px; outline:none; box-sizing:border-box;
          "/>
        </div>
        <div style="display:flex; border-bottom:1px solid #374151;">
          <button class="tab-btn active" data-tab="ground" style="flex:1;">Ground</button>
          <button class="tab-btn" data-tab="walls"  style="flex:1;">Walls</button>
          <button class="tab-btn" data-tab="items"  style="flex:1;">Items</button>
        </div>
        <div id="palette-grid" style="flex:1; overflow-y:auto; padding:4px; display:flex; flex-wrap:wrap; gap:2px; align-content:flex-start;">
        </div>
      </div>
    </div>

    <!-- Status bar -->
    <div id="statusbar" style="
      height:22px; background:#111827; border-top:1px solid #374151;
      display:flex; align-items:center; padding:0 8px; gap:12px;
      font-size:11px; color:#6b7280; flex-shrink:0;
    ">
      <span id="status-pos">X:0  Y:0  Z:7</span>
      <span>|</span>
      <span id="status-zoom">Zoom: 100%</span>
      <span>|</span>
      <span id="status-item">Item ID: —</span>
      <span>|</span>
      <span id="status-dirty"></span>
    </div>

    <style>
      .tbtn {
        padding:4px 8px; background:#374151; color:#e5e7eb; border:none;
        border-radius:4px; cursor:pointer; font-size:12px;
      }
      .tbtn:hover { background:#4b5563; }
      .tbtn.active { background:#06b6d4; color:#fff; }
      .tool-btn { width:32px; text-align:center; padding:4px; }
      .tab-btn {
        padding:6px 4px; background:none; color:#9ca3af; border:none;
        border-bottom:2px solid transparent; cursor:pointer; font-size:11px;
      }
      .tab-btn.active { color:#06b6d4; border-bottom-color:#06b6d4; }
    </style>
  `

  // Init renderer
  const canvas = document.getElementById('map-canvas') as HTMLCanvasElement
  renderer = new MapRenderer(canvas, spriteCache, items)

  // Palette population
  populatePalette(items, 'ground')

  setupEventListeners(canvas)
  setupKeyboard()
  updateMinimapLoop()
}

// ──────────────────────────────────────────────────────
// Palette
// ──────────────────────────────────────────────────────
function populatePalette(items: Map<number, any>, tab: string): void {
  const grid = document.getElementById('palette-grid')!
  grid.innerHTML = ''

  const filter = (item: any): boolean => {
    if (tab === 'ground') return item.isGround
    if (tab === 'walls')  return item.isUnpassable && !item.isGround
    return !item.isGround && !item.isUnpassable
  }

  for (const [id, item] of items) {
    if (!filter(item)) continue

    const cell = document.createElement('div')
    cell.style.cssText = `
      width:40px; height:40px; background:#111827; border:1px solid #374151;
      border-radius:3px; cursor:pointer; display:flex; flex-direction:column;
      align-items:center; justify-content:center; overflow:hidden;
      font-size:9px; color:#6b7280;
    `
    cell.title = `ID: ${id}`

    // Draw sprite using offscreen canvas
    const cv = document.createElement('canvas')
    cv.width = 32; cv.height = 32
    const ctx = cv.getContext('2d')!
    const imgData = spriteCache['parser'].getSpriteImageData(item.groups[0]?.sprites[0] || 0)
    if (imgData) ctx.putImageData(imgData, 0, 0)
    cv.style.cssText = 'width:32px; height:32px; image-rendering:pixelated;'
    cell.appendChild(cv)

    const idLabel = document.createElement('span')
    idLabel.textContent = String(id)
    cell.appendChild(idLabel)

    cell.onclick = () => {
      editorState.selectedItemId = id
      document.querySelectorAll('.palette-selected').forEach(el => el.classList.remove('palette-selected'))
      cell.style.borderColor = '#06b6d4'
      document.querySelectorAll('#palette-grid div').forEach(el => {
        (el as HTMLElement).style.borderColor = '#374151'
      })
      cell.style.borderColor = '#06b6d4'
    }

    grid.appendChild(cell)
  }

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    (btn as HTMLElement).onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      populatePalette(items, (btn as HTMLElement).dataset.tab || 'ground')
    }
  })
}

// ──────────────────────────────────────────────────────
// Canvas event listeners
// ──────────────────────────────────────────────────────
function setupEventListeners(canvas: HTMLCanvasElement): void {
  let isPainting = false
  let isPanning  = false
  let panStart   = { x: 0, y: 0, vpX: 0, vpY: 0 }
  let selStart   = { wx: 0, wy: 0 }
  let paintedThisStroke: Set<string> = new Set()

  canvas.addEventListener('contextmenu', e => e.preventDefault())

  canvas.addEventListener('mousedown', (e) => {
    const { wx, wy } = editorState.screenToWorld(e.offsetX, e.offsetY)
    const z = editorState.floor

    if (e.button === 2) {
      // Right click = pan
      isPanning = true
      panStart = { x: e.clientX, y: e.clientY, vpX: editorState.viewport.x, vpY: editorState.viewport.y }
      canvas.style.cursor = 'grabbing'
      return
    }

    if (e.button === 0) {
      const tool = editorState.activeTool

      if (tool === 'brush') {
        isPainting = true
        paintedThisStroke = new Set()
        const key = `${wx},${wy},${z}`
        if (!paintedThisStroke.has(key)) {
          paintedThisStroke.add(key)
          commandStack.execute(new PaintTileCommand(wx, wy, z, editorState.selectedItemId))
          renderer.renderAll()
        }
      } else if (tool === 'eraser') {
        isPainting = true
        paintedThisStroke = new Set()
        commandStack.execute(new EraseTileCommand(wx, wy, z))
        renderer.renderAll()
      } else if (tool === 'select') {
        selStart = { wx, wy }
        editorState.selection = { x1: wx, y1: wy, x2: wx, y2: wy, active: true }
        isPainting = true
      } else if (tool === 'npc') {
        const existing = editorState.getNpcAt(wx, wy, z)
        if (existing) {
          showNpcModal(existing.npc, { x: wx, y: wy, z }, (npc) => {
            editorState.updateNpc(existing.index, npc)
            saveNpcToFiles(npc)
            renderer.renderNpcs()
          }, () => {
            editorState.removeNpc(existing.index)
            removeNpcFromFiles(existing.npc.name)
            renderer.renderNpcs()
          })
        } else {
          showNpcModal(null, { x: wx, y: wy, z }, (npc) => {
            editorState.addNpc(npc)
            saveNpcToFiles(npc)
            renderer.renderNpcs()
          })
        }
      } else if (tool === 'spawn') {
        const existing = editorState.getSpawnAt(wx, wy, z)
        if (existing) {
          showSpawnModal(existing.spawn, wx, wy, z, editorState.monsterNames,
            (spawn) => {
              editorState.updateSpawn(existing.index, spawn)
              saveSpawns()
              renderer.renderSpawns()
            },
            () => {
              editorState.removeSpawn(existing.index)
              saveSpawns()
              renderer.renderSpawns()
            }
          )
        } else {
          showSpawnModal(null, wx, wy, z, editorState.monsterNames,
            (spawn) => {
              editorState.addSpawn(spawn)
              saveSpawns()
              renderer.renderSpawns()
            }
          )
        }
      }
    }

    updateStatusBar(wx, wy, z)
  })

  canvas.addEventListener('mousemove', (e) => {
    const { wx, wy } = editorState.screenToWorld(e.offsetX, e.offsetY)
    const z = editorState.floor
    updateStatusBar(wx, wy, z)

    if (isPanning) {
      const dx = Math.floor((panStart.x - e.clientX) / editorState.viewport.zoom)
      const dy = Math.floor((panStart.y - e.clientY) / editorState.viewport.zoom)
      editorState.viewport.x = panStart.vpX + dx
      editorState.viewport.y = panStart.vpY + dy
      renderer.renderAll()
      return
    }

    if (isPainting) {
      const tool = editorState.activeTool
      if (tool === 'brush') {
        const key = `${wx},${wy},${z}`
        if (!paintedThisStroke.has(key)) {
          paintedThisStroke.add(key)
          commandStack.execute(new PaintTileCommand(wx, wy, z, editorState.selectedItemId))
          renderer.renderAll()
        }
      } else if (tool === 'eraser') {
        const key = `${wx},${wy},${z}`
        if (!paintedThisStroke.has(key)) {
          paintedThisStroke.add(key)
          commandStack.execute(new EraseTileCommand(wx, wy, z))
          renderer.renderAll()
        }
      } else if (tool === 'select') {
        editorState.selection.x2 = wx
        editorState.selection.y2 = wy
        renderer.renderSelection()
      }
    }
  })

  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
      isPanning = false
      canvas.style.cursor = 'crosshair'
    }
    if (e.button === 0) {
      isPainting = false
    }
    updateDirtyIndicator()
  })

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    const { wx, wy } = editorState.screenToWorld(e.offsetX, e.offsetY)
    const oldZoom = editorState.viewport.zoom
    const delta = e.deltaY < 0 ? 1.2 : 1 / 1.2
    const newZoom = Math.max(8, Math.min(128, Math.round(oldZoom * delta)))
    editorState.viewport.zoom = newZoom
    // Zoom towards cursor
    editorState.viewport.x = wx - Math.floor(e.offsetX / newZoom)
    editorState.viewport.y = wy - Math.floor(e.offsetY / newZoom)
    document.getElementById('zoom-display')!.textContent = `${Math.round(newZoom / 32 * 100)}%`
    document.getElementById('status-zoom')!.textContent = `Zoom: ${Math.round(newZoom / 32 * 100)}%`
    renderer.renderAll()
  }, { passive: false })

  // Tool buttons
  document.querySelectorAll('.tool-btn').forEach(btn => {
    (btn as HTMLElement).onclick = () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      editorState.activeTool = (btn as HTMLElement).dataset.tool as any
      canvas.style.cursor = 'crosshair'
    }
  })

  // Floor
  document.getElementById('floor-up')!.onclick = () => {
    editorState.setFloor(editorState.floor - 1)
    document.getElementById('floor-display')!.textContent = String(editorState.floor)
    renderer.renderAll()
  }
  document.getElementById('floor-down')!.onclick = () => {
    editorState.setFloor(editorState.floor + 1)
    document.getElementById('floor-display')!.textContent = String(editorState.floor)
    renderer.renderAll()
  }

  // Visibility toggles
  document.getElementById('toggle-npcs')!.addEventListener('change', (e) => {
    editorState.showNpcs = (e.target as HTMLInputElement).checked
    renderer.renderNpcs()
  })
  document.getElementById('toggle-spawns')!.addEventListener('change', (e) => {
    editorState.showSpawns = (e.target as HTMLInputElement).checked
    renderer.renderSpawns()
  })

  // Open / Save buttons
  document.getElementById('btn-open')!.onclick = () => openMapDialog()
  document.getElementById('btn-save')!.onclick = () => saveMap()

  // Settings
  document.getElementById('btn-settings')!.onclick = async () => {
    config = await showSetupScreen() as AppConfig
  }

  // Minimap click → navigate
  const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement
  minimapCanvas.addEventListener('click', (e) => {
    // TODO: navigate to clicked minimap position
  })
}

// ──────────────────────────────────────────────────────
// Keyboard shortcuts
// ──────────────────────────────────────────────────────
function setupKeyboard(): void {
  document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey) {
      if (e.key === 'z') { commandStack.undo(); renderer.renderAll(); e.preventDefault() }
      if (e.key === 'y') { commandStack.redo(); renderer.renderAll(); e.preventDefault() }
      if (e.key === 's') { await saveMap(); e.preventDefault() }
      if (e.key === 'o') { await openMapDialog(); e.preventDefault() }
      if (e.key === 'c') { copySelection(); e.preventDefault() }
      if (e.key === 'v') { startPaste(); e.preventDefault() }
      if (e.key === 'x') { copySelection(); clearSelection(); e.preventDefault() }
    } else {
      switch (e.key.toLowerCase()) {
        case 'b': setTool('brush');  break
        case 'e': setTool('eraser'); break
        case 's': setTool('select'); break
        case 'n': setTool('npc');    break
        case 'p': setTool('spawn');  break
        case 'escape': editorState.selection.active = false; renderer.renderSelection(); break
      }
    }
  })
}

function setTool(tool: string): void {
  editorState.activeTool = tool as any
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'))
  document.getElementById(`tool-${tool}`)?.classList.add('active')
}

// ──────────────────────────────────────────────────────
// Copy / Paste
// ──────────────────────────────────────────────────────
function copySelection(): void {
  const sel = editorState.selection
  if (!sel.active || !editorState.map) return
  const x1 = Math.min(sel.x1, sel.x2)
  const y1 = Math.min(sel.y1, sel.y2)
  const x2 = Math.max(sel.x1, sel.x2)
  const y2 = Math.max(sel.y1, sel.y2)
  const z  = editorState.floor
  editorState.clipboard = []
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      const tile = editorState.getTile(x, y, z)
      if (tile) editorState.clipboard.push({ ...tile, items: [...tile.items] })
    }
  }
}

function clearSelection(): void {
  const sel = editorState.selection
  if (!sel.active) return
  const x1 = Math.min(sel.x1, sel.x2)
  const y1 = Math.min(sel.y1, sel.y2)
  const x2 = Math.max(sel.x1, sel.x2)
  const y2 = Math.max(sel.y1, sel.y2)
  const z = editorState.floor
  const cmds = []
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      cmds.push(new EraseTileCommand(x, y, z) as any)
    }
  }
  if (cmds.length) { commandStack.execute(new BatchCommand(cmds, 'Cut')); renderer.renderAll() }
}

function startPaste(): void {
  // TODO: ghost paste preview following cursor
  // For now, paste at selection origin
  const sel = editorState.selection
  if (!editorState.clipboard.length) return
  const ox = Math.min(sel.x1, sel.x2)
  const oy = Math.min(sel.y1, sel.y2)
  const minX = Math.min(...editorState.clipboard.map(t => t.x))
  const minY = Math.min(...editorState.clipboard.map(t => t.y))
  commandStack.execute(new PasteCommand(editorState.clipboard, ox - minX, oy - minY))
  renderer.renderAll()
}

// ──────────────────────────────────────────────────────
// File operations
// ──────────────────────────────────────────────────────
async function openMapDialog(): Promise<void> {
  const p = await window.electronAPI.openFile({
    title: 'Abrir mapa .otbm',
    filters: [{ name: 'OTBM Map', extensions: ['otbm'] }, { name: 'All', extensions: ['*'] }]
  })
  if (p) await openMap(p)
}

async function openMap(path: string): Promise<void> {
  try {
    const buf = await window.electronAPI.readBinary(path)
    const parser = new OtbmParser(buf)
    editorState.map = parser.parse()
    editorState.mapPath = path

    // Derive spawn path: map1.otbm → map1-spawn.xml (same folder)
    const dir = path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
    const baseName = path.split(/[\\/]/).pop()!.replace(/\.otbm$/i, '')
    editorState.spawnPath = dir + baseName + '-spawn.xml'

    // Startup.lua
    editorState.startupLuaPath = await window.electronAPI.joinPath(
      config.tfsRoot, 'data', 'globalevents', 'scripts', 'startup.lua'
    )

    // Load spawns
    try {
      const spawnXml = await window.electronAPI.readText(editorState.spawnPath)
      editorState.spawns = spawnParser.parse(spawnXml)
    } catch { editorState.spawns = [] }

    // Load NPCs
    await loadNpcs()

    // Set floor to 7 (GermantecOT default)
    editorState.setFloor(7)
    editorState.isDirty = false

    // Center viewport on map
    if (editorState.map.tiles.size > 0) {
      const firstKey = editorState.map.tiles.keys().next().value as string
      const [fx, fy] = firstKey.split(',').map(Number)
      editorState.viewport.x = fx - 10
      editorState.viewport.y = fy - 10
    }

    renderer.renderAll()

    // Save last path
    config.lastMapPath = path
    await window.electronAPI.saveConfig(config)

    document.title = `GermantecOT Map Editor — ${baseName}.otbm`
    updateDirtyIndicator()
  } catch (e) {
    alert(`Error abriendo el mapa: ${e}`)
    console.error(e)
  }
}

async function loadNpcs(): Promise<void> {
  editorState.npcs = []
  try {
    const npcDir = await window.electronAPI.joinPath(config.tfsRoot, 'data', 'npc')
    const files  = await window.electronAPI.listDir(npcDir)
    const xmlFiles = files.filter((f: string) => f.toLowerCase().endsWith('.xml'))

    // Load startup.lua for positions
    let startupLua = ''
    try {
      startupLua = await window.electronAPI.readText(editorState.startupLuaPath)
    } catch {}

    const positions = npcParser.parseStartupPositions(startupLua)

    for (const file of xmlFiles) {
      try {
        const filePath = await window.electronAPI.joinPath(npcDir, file)
        const xml = await window.electronAPI.readText(filePath)
        const partial = npcParser.parseXml(xml)
        const name = partial.name || file.replace(/\.xml$/i, '')
        const pos = positions.get(name) || { x: 0, y: 0, z: 0 }
        if (pos.x === 0) continue  // not placed on map
        editorState.npcs.push({
          name,
          type: partial.type || 'dialog',
          script: partial.script || '',
          lookType:   partial.lookType   ?? 136,
          lookHead:   partial.lookHead   ?? 0,
          lookBody:   partial.lookBody   ?? 0,
          lookLegs:   partial.lookLegs   ?? 0,
          lookFeet:   partial.lookFeet   ?? 0,
          lookAddons: partial.lookAddons ?? 0,
          walkInterval: partial.walkInterval ?? 0,
          direction: partial.direction ?? 2,
          position: pos
        })
      } catch {}
    }
  } catch (e) {
    console.warn('Could not load NPCs:', e)
  }
}

async function saveMap(): Promise<void> {
  if (!editorState.map) return
  try {
    const writer = new OtbmWriter()
    const buf = writer.write(editorState.map)
    await window.electronAPI.writeBinary(editorState.mapPath, buf)
    await saveSpawns()
    editorState.isDirty = false
    updateDirtyIndicator()
  } catch (e) {
    alert(`Error guardando: ${e}`)
  }
}

async function saveSpawns(): Promise<void> {
  if (!editorState.spawnPath) return
  const xml = spawnParser.serialize(editorState.spawns)
  await window.electronAPI.writeText(editorState.spawnPath, xml)
}

async function saveNpcToFiles(npc: import('./types').NpcDefinition): Promise<void> {
  try {
    // Save XML definition
    const npcDir = await window.electronAPI.joinPath(config.tfsRoot, 'data', 'npc')
    const filePath = await window.electronAPI.joinPath(npcDir, npc.name + '.xml')
    const xml = npcParser.serializeXml(npc)
    await window.electronAPI.writeText(filePath, xml)

    // Update startup.lua
    let lua = await window.electronAPI.readText(editorState.startupLuaPath)
    lua = npcParser.upsertStartupPosition(lua, npc)
    await window.electronAPI.writeText(editorState.startupLuaPath, lua)
  } catch (e) {
    console.error('saveNpcToFiles error:', e)
  }
}

async function removeNpcFromFiles(npcName: string): Promise<void> {
  try {
    let lua = await window.electronAPI.readText(editorState.startupLuaPath)
    lua = npcParser.removeStartupPosition(lua, npcName)
    await window.electronAPI.writeText(editorState.startupLuaPath, lua)
  } catch {}
}

// ──────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────
function updateStatusBar(wx: number, wy: number, z: number): void {
  const item = editorState.getTile(wx, wy, z)
  const itemId = item?.items[0]?.id ?? '—'
  document.getElementById('status-pos')!.textContent  = `X:${wx}  Y:${wy}  Z:${z}`
  document.getElementById('status-item')!.textContent = `Item ID: ${itemId}`
}

function updateDirtyIndicator(): void {
  document.getElementById('status-dirty')!.textContent =
    editorState.isDirty ? '● Cambios sin guardar' : '✓ Guardado'
}

function updateMinimapLoop(): void {
  setInterval(() => {
    if (!editorState.map) return
    const mc = document.getElementById('minimap-canvas') as HTMLCanvasElement
    const ctx = mc.getContext('2d')!
    const mini = renderer.buildMinimap(200)
    ctx.drawImage(mini, 0, 0)
  }, 1000)
}

// ──────────────────────────────────────────────────────
boot()
