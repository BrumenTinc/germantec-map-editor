/**
 * MapRenderer — PixiJS v7 canvas renderer.
 * Handles tile rendering, NPC icons, spawn circles, minimap.
 */
import * as PIXI from 'pixi.js'
import { editorState } from '../editor/EditorState'
import { SpriteCache } from './SpriteCache'
import { ItemType } from '../types'

const TILE_SIZE = 32

export class MapRenderer {
  app: PIXI.Application
  private spriteCache: SpriteCache
  items: Map<number, ItemType>

  // Containers
  private mapContainer: PIXI.Container
  private npcContainer: PIXI.Container
  private spawnContainer: PIXI.Container
  private selectionContainer: PIXI.Container
  private gridContainer: PIXI.Container

  // Tile sprite pool
  private tileSprites: Map<string, PIXI.Sprite> = new Map()

  // For paste preview
  private pastePreview: PIXI.Container | null = null

  constructor(
    canvas: HTMLCanvasElement,
    spriteCache: SpriteCache,
    items: Map<number, ItemType>
  ) {
    this.spriteCache = spriteCache
    this.items = items

    this.app = new PIXI.Application({
      view: canvas,
      backgroundColor: 0x111827,
      resizeTo: canvas,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    })

    this.mapContainer      = new PIXI.Container()
    this.gridContainer     = new PIXI.Container()
    this.npcContainer      = new PIXI.Container()
    this.spawnContainer    = new PIXI.Container()
    this.selectionContainer = new PIXI.Container()

    this.app.stage.addChild(this.mapContainer)
    this.app.stage.addChild(this.gridContainer)
    this.app.stage.addChild(this.spawnContainer)
    this.app.stage.addChild(this.npcContainer)
    this.app.stage.addChild(this.selectionContainer)

    this.app.ticker.add(() => this.render())

    // Subscribe to state changes
    editorState.on('viewport-changed', () => this.renderAll())
    editorState.on('floor-changed',    () => this.renderAll())
    editorState.on('npcs-changed',     () => this.renderNpcs())
    editorState.on('spawns-changed',   () => this.renderSpawns())
  }

  // ──────────────────────────────
  render(): void {
    // Called every tick — only re-render if dirty
    // (actual rendering is triggered by events)
  }

  renderAll(): void {
    this.renderTiles()
    this.renderSpawns()
    this.renderNpcs()
    this.renderSelection()
  }

  // ──────────────────────────────
  renderTiles(): void {
    if (!editorState.map) return

    this.mapContainer.removeChildren()
    this.tileSprites.clear()

    const { x: vpX, y: vpY, zoom, floor } = editorState.viewport
    const screenW = this.app.screen.width
    const screenH = this.app.screen.height

    const tilesX = Math.ceil(screenW / zoom) + 2
    const tilesY = Math.ceil(screenH / zoom) + 2

    for (let dy = 0; dy < tilesY; dy++) {
      for (let dx = 0; dx < tilesX; dx++) {
        const wx = vpX + dx
        const wy = vpY + dy
        const tile = editorState.map.tiles.get(`${wx},${wy},${floor}`)
        if (!tile || tile.items.length === 0) continue

        const sx = dx * zoom
        const sy = dy * zoom

        // Render all items on the tile (ground + stacked)
        for (const item of tile.items) {
          const itemDef = this.items.get(item.id)
          if (!itemDef) continue

          const texture = this.spriteCache.getItemTexture(itemDef)
          if (texture === PIXI.Texture.EMPTY) continue

          const sprite = new PIXI.Sprite(texture)
          sprite.x = sx
          sprite.y = sy
          sprite.width = zoom
          sprite.height = zoom
          this.mapContainer.addChild(sprite)
        }
      }
    }

    // Dark overlay for floors above/below
    this.renderFloorShading()
  }

  private renderFloorShading(): void {
    // Tiles on other floors get a dark overlay hint
    // (simplified: just render current floor normally)
  }

  // ──────────────────────────────
  renderNpcs(): void {
    this.npcContainer.removeChildren()
    if (!editorState.showNpcs) return

    const { x: vpX, y: vpY, zoom, floor } = editorState.viewport
    const iconSize = Math.max(16, zoom * 0.7)

    for (const npc of editorState.npcs) {
      if (npc.position.z !== floor) continue

      const sx = (npc.position.x - vpX) * zoom + zoom / 2
      const sy = (npc.position.y - vpY) * zoom + zoom / 2

      // Draw circle
      const g = new PIXI.Graphics()
      const color = npc.type === 'shop' ? 0xFFD700
                  : npc.type === 'quest' ? 0x00C853
                  : 0x2196F3  // dialog = blue

      g.lineStyle(2, color, 1)
      g.beginFill(color, 0.3)
      g.drawCircle(sx, sy, iconSize / 2)
      g.endFill()
      this.npcContainer.addChild(g)

      // Icon text
      const icon = npc.type === 'shop' ? '🛒' : npc.type === 'quest' ? '❓' : '💬'
      const text = new PIXI.Text(icon, {
        fontSize: Math.max(10, zoom * 0.5),
        align: 'center'
      })
      text.anchor.set(0.5)
      text.x = sx
      text.y = sy
      this.npcContainer.addChild(text)

      // Name label
      if (zoom >= 24) {
        const label = new PIXI.Text(npc.name, {
          fontSize: 9,
          fill: 0xffffff,
          stroke: 0x000000,
          strokeThickness: 2
        })
        label.anchor.set(0.5, 0)
        label.x = sx
        label.y = sy + iconSize / 2 + 2
        this.npcContainer.addChild(label)
      }
    }
  }

  // ──────────────────────────────
  renderSpawns(): void {
    this.spawnContainer.removeChildren()
    if (!editorState.showSpawns) return

    const { x: vpX, y: vpY, zoom, floor } = editorState.viewport

    for (const spawn of editorState.spawns) {
      if (spawn.centerZ !== floor) continue

      const cx = (spawn.centerX - vpX) * zoom + zoom / 2
      const cy = (spawn.centerY - vpY) * zoom + zoom / 2
      const r = spawn.radius * zoom

      const count = spawn.creatures.length
      const color = count <= 3 ? 0x00C853
                  : count <= 6 ? 0xFF9800
                  : 0xF44336

      const g = new PIXI.Graphics()
      g.lineStyle(1.5, color, 0.8)
      g.beginFill(color, 0.12)
      g.drawCircle(cx, cy, r)
      g.endFill()

      // Center dot
      g.beginFill(color, 0.6)
      g.drawCircle(cx, cy, 3)
      g.endFill()

      this.spawnContainer.addChild(g)

      // Creature names (if zoomed in enough)
      if (zoom >= 20 && spawn.creatures.length > 0) {
        const names = spawn.creatures.slice(0, 3).map(c => c.name).join(', ')
        const label = new PIXI.Text(names + (spawn.creatures.length > 3 ? '...' : ''), {
          fontSize: 8,
          fill: color,
          stroke: 0x000000,
          strokeThickness: 2
        })
        label.anchor.set(0.5)
        label.x = cx
        label.y = cy
        this.spawnContainer.addChild(label)
      }
    }
  }

  // ──────────────────────────────
  renderSelection(): void {
    this.selectionContainer.removeChildren()
    const sel = editorState.selection
    if (!sel.active) return

    const { x: vpX, y: vpY, zoom } = editorState.viewport
    const x1 = Math.min(sel.x1, sel.x2)
    const y1 = Math.min(sel.y1, sel.y2)
    const x2 = Math.max(sel.x1, sel.x2)
    const y2 = Math.max(sel.y1, sel.y2)

    const sx = (x1 - vpX) * zoom
    const sy = (y1 - vpY) * zoom
    const sw = (x2 - x1 + 1) * zoom
    const sh = (y2 - y1 + 1) * zoom

    const g = new PIXI.Graphics()
    g.lineStyle(2, 0x06b6d4, 1)
    g.beginFill(0x06b6d4, 0.1)
    g.drawRect(sx, sy, sw, sh)
    g.endFill()
    this.selectionContainer.addChild(g)
  }

  // ──────────────────────────────
  // Hover highlight
  highlightTile(wx: number, wy: number): void {
    // Visual feedback for brush/eraser hover
    // Rendered as a thin overlay rectangle
  }

  // ──────────────────────────────
  buildMinimap(size = 250): HTMLCanvasElement {
    const mc = document.createElement('canvas')
    mc.width = size
    mc.height = size
    const ctx = mc.getContext('2d')!
    if (!editorState.map) return mc

    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, size, size)

    const tiles = editorState.map.tiles
    const floor = editorState.viewport.floor

    // Find bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [key] of tiles) {
      const [x, y, z] = key.split(',').map(Number)
      if (z !== floor) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }

    if (minX === Infinity) return mc

    const mapW = maxX - minX + 1
    const mapH = maxY - minY + 1
    const scaleX = size / mapW
    const scaleY = size / mapH
    const scale  = Math.min(scaleX, scaleY, 1)

    for (const [key, tile] of tiles) {
      const [x, y, z] = key.split(',').map(Number)
      if (z !== floor) continue
      if (tile.items.length === 0) continue

      const ground = this.items.get(tile.items[0].id)
      const color = ground ? this.getMinimapColor(ground) : '#555'

      const px = Math.floor((x - minX) * scale)
      const py = Math.floor((y - minY) * scale)
      ctx.fillStyle = color
      ctx.fillRect(px, py, Math.max(1, scale), Math.max(1, scale))
    }

    // Viewport rect
    const { x: vpX, y: vpY, zoom } = editorState.viewport
    const vx = Math.floor((vpX - minX) * scale)
    const vy = Math.floor((vpY - minY) * scale)
    const vw = Math.ceil((this.app.screen.width / zoom) * scale)
    const vh = Math.ceil((this.app.screen.height / zoom) * scale)
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 1
    ctx.strokeRect(vx, vy, vw, vh)

    return mc
  }

  private getMinimapColor(item: ItemType): string {
    if (item.minimapColor) {
      const r = (item.minimapColor >> 8) & 0xF
      const g = (item.minimapColor >> 4) & 0xF
      const b = item.minimapColor & 0xF
      return `#${(r * 17).toString(16).padStart(2, '0')}${(g * 17).toString(16).padStart(2, '0')}${(b * 17).toString(16).padStart(2, '0')}`
    }
    if (item.isGround) return '#5a8a3c'   // grass-ish
    if (item.isUnpassable) return '#666'  // wall
    return '#888'
  }

  resize(w: number, h: number): void {
    this.app.renderer.resize(w, h)
    this.renderAll()
  }

  destroy(): void {
    this.app.destroy(false)
  }
}
