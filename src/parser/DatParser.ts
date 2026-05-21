/**
 * Tibia.dat parser — protocol 10.98 (client version 1098)
 * Parses item/creature/effect/missile sprite definitions.
 */
import { ItemType, SpriteGroup } from '../types'

const DAT_SIGNATURE = 0x4E119980  // expected for 10.98

// Attribute flags in .dat
const enum DatAttr {
  Ground           = 0x00,
  GroundBorder     = 0x01,
  OnBottom         = 0x02,
  OnTop            = 0x03,
  Container        = 0x04,
  Stackable        = 0x05,
  ForceUse         = 0x06,
  MultiUse         = 0x07,
  Writable         = 0x08,
  WritableOnce     = 0x09,
  FluidContainer   = 0x0A,
  Splash           = 0x0B,
  NotWalkable      = 0x0C,
  NotMoveable      = 0x0D,
  BlockProjectile  = 0x0E,
  NotPathable      = 0x0F,
  NoMoveAnimation  = 0x10,
  Pickupable       = 0x11,
  Hangable         = 0x12,
  HookSouth        = 0x13,
  HookEast         = 0x14,
  Rotateable       = 0x15,
  Light            = 0x16,
  DontHide         = 0x17,
  Translucent      = 0x18,
  Displacement     = 0x19,
  Elevation        = 0x1A,
  LyingCorpse      = 0x1B,
  AnimateAlways    = 0x1C,
  MinimapColor     = 0x1D,
  LensHelp         = 0x1E,
  FullGround       = 0x1F,
  Hook             = 0x20,
  Wearable         = 0x21,
  ClothSlot        = 0x22,
  Market           = 0x23,
  DefaultAction    = 0x24,
  Wrappable        = 0x25,
  Unwrappable      = 0x26,
  TopEffect        = 0x27,
  LastAttr         = 0xFF,
}

export class DatParser {
  private view: DataView
  private offset = 0

  // Public results
  public items: Map<number, ItemType> = new Map()
  public itemCount = 0
  public effectCount = 0
  public missileCount = 0
  public outfitCount = 0

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer)
  }

  parse(): void {
    const sig = this.readU32()
    if (sig !== DAT_SIGNATURE) {
      console.warn(`DAT signature mismatch: 0x${sig.toString(16)} (expected 0x${DAT_SIGNATURE.toString(16)}) — continuing anyway`)
    }

    this.itemCount    = this.readU16()
    this.outfitCount  = this.readU16()
    this.effectCount  = this.readU16()
    this.missileCount = this.readU16()

    // Items start at ID 100
    const firstId = 100
    const lastId  = firstId + this.itemCount - 1

    for (let id = firstId; id <= lastId; id++) {
      const item = this.parseType(id)
      this.items.set(id, item)
    }
  }

  private parseType(id: number): ItemType {
    const item: ItemType = {
      id,
      flags: 0,
      groups: [],
      isGround: false,
      isOnTop: false,
      isOnBottom: false,
      isContainer: false,
      isStackable: false,
      isFluid: false,
      isUnpassable: false,
      hasElevation: false,
      elevation: 0,
      minimapColor: 0
    }

    // Read attributes until LastAttr
    while (this.offset < this.view.byteLength) {
      const attr = this.readU8()
      if (attr === DatAttr.LastAttr) break

      switch (attr) {
        case DatAttr.Ground:
          this.readU16() // speed
          item.isGround = true
          break
        case DatAttr.GroundBorder:
          break
        case DatAttr.OnTop:
          item.isOnTop = true
          break
        case DatAttr.OnBottom:
          item.isOnBottom = true
          break
        case DatAttr.Container:
          item.isContainer = true
          break
        case DatAttr.Stackable:
          item.isStackable = true
          break
        case DatAttr.FluidContainer:
        case DatAttr.Splash:
          item.isFluid = true
          break
        case DatAttr.NotWalkable:
          item.isUnpassable = true
          break
        case DatAttr.Light:
          this.readU16() // intensity
          this.readU16() // color
          break
        case DatAttr.Displacement:
          this.readU16() // offsetX
          this.readU16() // offsetY
          break
        case DatAttr.Elevation:
          item.elevation = this.readU16()
          item.hasElevation = true
          break
        case DatAttr.MinimapColor:
          item.minimapColor = this.readU16()
          break
        case DatAttr.LensHelp:
          this.readU16()
          break
        case DatAttr.ClothSlot:
          this.readU16()
          break
        case DatAttr.DefaultAction:
          this.readU16()
          break
        case DatAttr.Market: {
          this.readU16() // category
          this.readU16() // tradeAs
          this.readU16() // showAs
          const nameLen = this.readU16()
          this.offset += nameLen // skip name
          this.readU16() // profession
          this.readU16() // requiredLevel
          break
        }
        case DatAttr.Wrappable:
        case DatAttr.Unwrappable:
        case DatAttr.TopEffect:
          break
        default:
          // Unknown attribute — we can't skip safely without size info
          // Just stop parsing attributes for this item
          this.offset--
          // force exit
          this.offset += 10000 // will break on next iteration naturally
          break
      }
    }

    // Read sprite data
    const group = this.parseSpriteGroup()
    item.groups.push(group)

    return item
  }

  private parseSpriteGroup(): SpriteGroup {
    const width    = this.readU8()
    const height   = this.readU8()
    if (width > 1 || height > 1) {
      this.readU8() // exact size (unused)
    }
    const layers   = this.readU8()
    const patternX = this.readU8()
    const patternY = this.readU8()
    const patternZ = this.readU8()
    const phases   = this.readU8()

    const totalSprites = width * height * layers * patternX * patternY * patternZ * phases
    const sprites: number[] = []
    for (let i = 0; i < totalSprites; i++) {
      sprites.push(this.readU32())
    }

    return { width, height, layers, patternX, patternY, patternZ, phases, sprites }
  }

  private readU8(): number {
    return this.view.getUint8(this.offset++)
  }
  private readU16(): number {
    const v = this.view.getUint16(this.offset, true)
    this.offset += 2
    return v
  }
  private readU32(): number {
    const v = this.view.getUint32(this.offset, true)
    this.offset += 4
    return v
  }
}
