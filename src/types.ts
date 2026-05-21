// ──────────────────────────────────────────────
// Shared types for GermantecOT Map Editor
// ──────────────────────────────────────────────

export interface AppConfig {
  datPath: string      // path to Tibia.dat
  sprPath: string      // path to Tibia.spr
  tfsRoot: string      // local copy of server folder (e.g. C:\tfs\)
  lastMapPath: string  // last opened .otbm
}

// ──────────────────────────────────────────────
// OTBM types
// ──────────────────────────────────────────────
export interface MapHeader {
  version: number
  width: number
  height: number
  majorVersion: number
  minorVersion: number
  mapDescription: string
  spawnFile: string
  houseFile: string
}

export interface Position {
  x: number
  y: number
  z: number
}

export interface ItemOnTile {
  id: number
  actionId?: number
  uniqueId?: number
  count?: number
  text?: string
}

export interface MapTile {
  x: number
  y: number
  z: number
  flags: number
  items: ItemOnTile[]
}

export interface OtbmMap {
  header: MapHeader
  tiles: Map<string, MapTile>  // key = "x,y,z"
}

// ──────────────────────────────────────────────
// Tibia.dat types
// ──────────────────────────────────────────────
export interface SpriteGroup {
  width: number
  height: number
  layers: number
  patternX: number
  patternY: number
  patternZ: number
  phases: number
  sprites: number[]  // sprite IDs
}

export interface ItemType {
  id: number
  flags: number
  groups: SpriteGroup[]
  name?: string
  // render helpers
  isGround: boolean
  isOnTop: boolean
  isOnBottom: boolean
  isContainer: boolean
  isStackable: boolean
  isFluid: boolean
  isUnpassable: boolean
  hasElevation: boolean
  elevation: number
  minimapColor: number
}

// ──────────────────────────────────────────────
// NPC types
// ──────────────────────────────────────────────
export type NpcType = 'dialog' | 'shop' | 'quest'

export interface NpcDefinition {
  name: string
  type: NpcType
  script: string
  lookType: number
  lookHead: number
  lookBody: number
  lookLegs: number
  lookFeet: number
  lookAddons: number
  walkInterval: number
  direction: number  // 0=N 1=E 2=S 3=W
  position: Position
  // derived from startup.lua
}

// ──────────────────────────────────────────────
// Spawn types
// ──────────────────────────────────────────────
export interface SpawnCreature {
  kind: 'monster' | 'npc'
  name: string
  x: number
  y: number
  z: number
  direction: number
  spawnTime: number
}

export interface SpawnDefinition {
  centerX: number
  centerY: number
  centerZ: number
  radius: number
  creatures: SpawnCreature[]
}
