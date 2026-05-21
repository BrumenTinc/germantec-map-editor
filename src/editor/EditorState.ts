/**
 * Central editor state — map, NPCs, spawns, selection, viewport.
 * All mutations go through this class so CommandStack can track them.
 */
import { OtbmMap, MapTile, NpcDefinition, SpawnDefinition, ItemOnTile } from '../types'

export type ToolType = 'brush' | 'eraser' | 'select' | 'move' | 'npc' | 'spawn'

export interface Viewport {
  x: number       // world X of top-left corner
  y: number       // world Y of top-left corner
  zoom: number    // pixels per tile
  floor: number   // current Z level (0-15)
}

export interface Selection {
  x1: number; y1: number
  x2: number; y2: number
  active: boolean
}

export class EditorState {
  // Map data
  map: OtbmMap | null = null
  mapPath: string = ''
  spawnPath: string = ''
  startupLuaPath: string = ''

  // Overlays
  npcs: NpcDefinition[] = []
  spawns: SpawnDefinition[] = []

  // Tool state
  activeTool: ToolType = 'brush'
  selectedItemId: number = 106  // default: grass
  floor: number = 7             // GermantecOT default floor

  // Viewport
  viewport: Viewport = { x: 0, y: 0, zoom: 32, floor: 7 }

  // Selection
  selection: Selection = { x1: 0, y1: 0, x2: 0, y2: 0, active: false }
  clipboard: MapTile[] = []

  // UI state
  showNpcs: boolean = true
  showSpawns: boolean = true
  isDirty: boolean = false   // unsaved changes

  // Monster autocomplete list
  monsterNames: string[] = []

  // Event callbacks
  private listeners: Map<string, Set<() => void>> = new Map()

  on(event: string, cb: () => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(cb)
  }

  off(event: string, cb: () => void): void {
    this.listeners.get(event)?.delete(cb)
  }

  emit(event: string): void {
    this.listeners.get(event)?.forEach(cb => cb())
  }

  // ──────────────────────────────
  // Tile access
  // ──────────────────────────────
  getTile(x: number, y: number, z: number): MapTile | undefined {
    return this.map?.tiles.get(`${x},${y},${z}`)
  }

  setTile(tile: MapTile): void {
    if (!this.map) return
    this.map.tiles.set(`${tile.x},${tile.y},${tile.z}`, tile)
    this.isDirty = true
  }

  deleteTile(x: number, y: number, z: number): void {
    if (!this.map) return
    this.map.tiles.delete(`${x},${y},${z}`)
    this.isDirty = true
  }

  // Paint: set ground tile (replaces first item)
  paintTile(x: number, y: number, z: number, itemId: number): void {
    const existing = this.getTile(x, y, z)
    if (existing) {
      // Replace ground (first item) or add if empty
      const newItems: ItemOnTile[] = [{ id: itemId }, ...existing.items.slice(1)]
      this.setTile({ ...existing, items: newItems })
    } else {
      this.setTile({ x, y, z, flags: 0, items: [{ id: itemId }] })
    }
  }

  eraseTile(x: number, y: number, z: number): void {
    this.deleteTile(x, y, z)
  }

  // ──────────────────────────────
  // NPC operations
  // ──────────────────────────────
  addNpc(npc: NpcDefinition): void {
    this.npcs.push(npc)
    this.isDirty = true
    this.emit('npcs-changed')
  }

  updateNpc(index: number, npc: NpcDefinition): void {
    this.npcs[index] = npc
    this.isDirty = true
    this.emit('npcs-changed')
  }

  removeNpc(index: number): void {
    this.npcs.splice(index, 1)
    this.isDirty = true
    this.emit('npcs-changed')
  }

  getNpcAt(x: number, y: number, z: number): { npc: NpcDefinition; index: number } | null {
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i]
      if (n.position.x === x && n.position.y === y && n.position.z === z) {
        return { npc: n, index: i }
      }
    }
    return null
  }

  // ──────────────────────────────
  // Spawn operations
  // ──────────────────────────────
  addSpawn(spawn: SpawnDefinition): void {
    this.spawns.push(spawn)
    this.isDirty = true
    this.emit('spawns-changed')
  }

  updateSpawn(index: number, spawn: SpawnDefinition): void {
    this.spawns[index] = spawn
    this.isDirty = true
    this.emit('spawns-changed')
  }

  removeSpawn(index: number): void {
    this.spawns.splice(index, 1)
    this.isDirty = true
    this.emit('spawns-changed')
  }

  getSpawnAt(x: number, y: number, z: number): { spawn: SpawnDefinition; index: number } | null {
    for (let i = 0; i < this.spawns.length; i++) {
      const s = this.spawns[i]
      if (s.centerX === x && s.centerY === y && s.centerZ === z) {
        return { spawn: s, index: i }
      }
    }
    return null
  }

  // ──────────────────────────────
  // Viewport helpers
  // ──────────────────────────────
  worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
    const { x, y, zoom } = this.viewport
    return {
      sx: (wx - x) * zoom,
      sy: (wy - y) * zoom
    }
  }

  screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
    const { x, y, zoom } = this.viewport
    return {
      wx: Math.floor(sx / zoom) + x,
      wy: Math.floor(sy / zoom) + y
    }
  }

  setZoom(zoom: number): void {
    this.viewport.zoom = Math.max(8, Math.min(128, zoom))
    this.emit('viewport-changed')
  }

  pan(dx: number, dy: number): void {
    this.viewport.x += dx
    this.viewport.y += dy
    this.emit('viewport-changed')
  }

  setFloor(z: number): void {
    this.viewport.floor = Math.max(0, Math.min(15, z))
    this.floor = this.viewport.floor
    this.emit('floor-changed')
  }
}

// Singleton
export const editorState = new EditorState()
