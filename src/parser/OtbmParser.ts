/**
 * OTBM binary map parser — TFS 1.4 format (version 2)
 *
 * Node structure:
 *   0xFE = NODE_START
 *   0xFF = NODE_END
 *   0xFD = ESCAPE (next byte is literal data, not control)
 */
import { OtbmMap, MapHeader, MapTile, ItemOnTile, Position } from '../types'

// Node type bytes
const enum NodeType {
  Root      = 0x00,
  MapData   = 0x02,
  TileArea  = 0x04,
  Tile      = 0x05,
  Item      = 0x06,
  HouseTile = 0x0E,
  Towns     = 0x0C,
  Town      = 0x0D,
  Waypoints = 0x0F,
  Waypoint  = 0x10,
}

// Attribute bytes
const enum Attr {
  Description = 0x01,
  ExtFile     = 0x02,
  TileFlags   = 0x04,
  ActionId    = 0x05,
  UniqueId    = 0x06,
  Text        = 0x07,
  TeleportDst = 0x09,
  Item        = 0x0A,
  DepotId     = 0x0B,
  ExtSpawn    = 0x0F,
  RuneCharges = 0x11,
  ExtHouse    = 0x14,
  HouseDoorId = 0x15,
  Count       = 0x16,
  Duration    = 0x17,
  DecayState  = 0x18,
  WrittenDate = 0x19,
  WrittenBy   = 0x1A,
  SleeperGuid = 0x1B,
  SleepStart  = 0x1C,
  Charges     = 0x1D,
}

const NODE_START = 0xFE
const NODE_END   = 0xFF
const ESCAPE     = 0xFD

export class OtbmParser {
  private raw: Uint8Array
  private pos = 0

  constructor(buffer: ArrayBuffer) {
    this.raw = new Uint8Array(buffer)
  }

  parse(): OtbmMap {
    // 4-byte magic (0x00000000)
    this.pos = 4

    // Expect NODE_START
    this.expect(NODE_START)
    const rootType = this.readByte()  // NodeType.Root (0x00)
    if (rootType !== NodeType.Root) {
      throw new Error(`Expected root node (0x00), got 0x${rootType.toString(16)}`)
    }

    const header = this.parseHeader()
    const tiles: Map<string, MapTile> = new Map()

    // Walk child nodes of root
    while (this.peekByte() === NODE_START) {
      this.pos++
      const nodeType = this.readByte()
      if (nodeType === NodeType.MapData) {
        this.parseMapData(header, tiles)
      } else {
        this.skipNode()
      }
    }
    this.expect(NODE_END)

    return { header, tiles }
  }

  // ──────────────────────────────
  private parseHeader(): MapHeader {
    const version      = this.readU32()
    const width        = this.readU16()
    const height       = this.readU16()
    const majorVersion = this.readU32()
    const minorVersion = this.readU32()

    const header: MapHeader = {
      version, width, height, majorVersion, minorVersion,
      mapDescription: '',
      spawnFile: '',
      houseFile: ''
    }
    return header
  }

  private parseMapData(header: MapHeader, tiles: Map<string, MapTile>): void {
    // Read attributes of MapData node
    while (this.peekByte() !== NODE_START && this.peekByte() !== NODE_END) {
      const attr = this.readByte()
      switch (attr) {
        case Attr.Description:
          header.mapDescription = this.readString()
          break
        case Attr.ExtSpawn:
          header.spawnFile = this.readString()
          break
        case Attr.ExtHouse:
          header.houseFile = this.readString()
          break
        default:
          // unknown attr — can't skip safely, stop reading attrs
          this.pos--
          this.skipUntilNode()
          break
      }
    }

    // Child nodes: TileAreas
    while (this.peekByte() === NODE_START) {
      this.pos++
      const nodeType = this.readByte()
      if (nodeType === NodeType.TileArea) {
        this.parseTileArea(tiles)
      } else {
        this.skipNode()
      }
    }
    this.expect(NODE_END)
  }

  private parseTileArea(tiles: Map<string, MapTile>): void {
    const baseX = this.readU16()
    const baseY = this.readU16()
    const baseZ = this.readU8()

    while (this.peekByte() === NODE_START) {
      this.pos++
      const nodeType = this.readByte()
      if (nodeType === NodeType.Tile || nodeType === NodeType.HouseTile) {
        const offX = this.readU8()
        const offY = this.readU8()
        const x = baseX + offX
        const y = baseY + offY
        const z = baseZ

        const tile: MapTile = { x, y, z, flags: 0, items: [] }

        if (nodeType === NodeType.HouseTile) {
          this.readU32() // houseId
        }

        // Read tile attributes
        while (this.peekByte() !== NODE_START && this.peekByte() !== NODE_END) {
          const attr = this.readByte()
          switch (attr) {
            case Attr.TileFlags:
              tile.flags = this.readU32()
              break
            case Attr.Item: {
              const itemId = this.readU16()
              tile.items.push({ id: itemId })
              break
            }
            default:
              // unknown, stop
              this.pos--
              this.skipUntilNode()
              break
          }
        }

        // Child item nodes
        while (this.peekByte() === NODE_START) {
          this.pos++
          const childType = this.readByte()
          if (childType === NodeType.Item) {
            const item = this.parseItemNode()
            tile.items.push(item)
          } else {
            this.skipNode()
          }
        }
        this.expect(NODE_END)

        tiles.set(`${x},${y},${z}`, tile)
      } else {
        this.skipNode()
      }
    }
    this.expect(NODE_END)
  }

  private parseItemNode(): ItemOnTile {
    const id = this.readU16()
    const item: ItemOnTile = { id }

    while (this.peekByte() !== NODE_START && this.peekByte() !== NODE_END) {
      const attr = this.readByte()
      switch (attr) {
        case Attr.Count:
        case Attr.RuneCharges:
        case Attr.Charges:
          item.count = this.readU8()
          break
        case Attr.ActionId:
          item.actionId = this.readU16()
          break
        case Attr.UniqueId:
          item.uniqueId = this.readU16()
          break
        case Attr.Text:
          item.text = this.readString()
          break
        case Attr.Duration:
          this.readU32()
          break
        case Attr.DecayState:
          this.readU8()
          break
        case Attr.WrittenDate:
          this.readU32()
          break
        case Attr.WrittenBy:
          this.readString()
          break
        case Attr.DepotId:
          this.readU16()
          break
        case Attr.HouseDoorId:
          this.readU8()
          break
        case Attr.TeleportDst:
          this.readU16(); this.readU16(); this.readU8()
          break
        default:
          this.pos--
          this.skipUntilNode()
          break
      }
    }

    // nested items (containers)
    while (this.peekByte() === NODE_START) {
      this.pos++
      this.readByte() // child type
      this.parseItemNode() // parse but discard nested
      // already consumed NODE_END inside parseItemNode recursion? No, need to handle
    }
    this.expect(NODE_END)

    return item
  }

  // ──────────────────────────────
  // Helpers
  // ──────────────────────────────
  private readByte(): number {
    let b = this.raw[this.pos++]
    if (b === ESCAPE) b = this.raw[this.pos++]
    return b
  }

  private peekByte(): number {
    return this.raw[this.pos]
  }

  private expect(byte: number): void {
    const b = this.raw[this.pos++]
    if (b !== byte) {
      throw new Error(`Expected 0x${byte.toString(16)} at pos ${this.pos - 1}, got 0x${b.toString(16)}`)
    }
  }

  private readU8(): number  { return this.readByte() }
  private readU16(): number { return this.readByte() | (this.readByte() << 8) }
  private readU32(): number {
    return (this.readByte() | (this.readByte() << 8) |
            (this.readByte() << 16) | (this.readByte() << 24)) >>> 0
  }

  private readString(): string {
    const len = this.readU16()
    let s = ''
    for (let i = 0; i < len; i++) s += String.fromCharCode(this.readByte())
    return s
  }

  private skipUntilNode(): void {
    while (this.pos < this.raw.length) {
      const b = this.raw[this.pos]
      if (b === NODE_START || b === NODE_END) return
      if (b === ESCAPE) this.pos++
      this.pos++
    }
  }

  private skipNode(): void {
    let depth = 1
    while (this.pos < this.raw.length && depth > 0) {
      const b = this.raw[this.pos++]
      if (b === ESCAPE) { this.pos++; continue }
      if (b === NODE_START) depth++
      else if (b === NODE_END) depth--
    }
  }
}

// ──────────────────────────────────────────────
// OTBM Writer
// ──────────────────────────────────────────────
export class OtbmWriter {
  private buf: number[] = []

  write(map: OtbmMap): ArrayBuffer {
    this.buf = []

    // magic
    this.buf.push(0, 0, 0, 0)

    this.nodeStart(NodeType.Root)
    this.writeHeader(map.header)

    this.nodeStart(NodeType.MapData)
    this.writeAttrString(Attr.Description, map.header.mapDescription)
    this.writeAttrString(Attr.ExtSpawn, map.header.spawnFile)
    this.writeAttrString(Attr.ExtHouse, map.header.houseFile)

    // Group tiles by area (256x256 chunks)
    const areas = this.groupByArea(map.tiles)
    for (const [key, areaTiles] of areas) {
      const [ax, ay, az] = key.split(',').map(Number)
      this.nodeStart(NodeType.TileArea)
      this.writeU16Raw(ax)
      this.writeU16Raw(ay)
      this.writeU8Raw(az)

      for (const tile of areaTiles) {
        this.nodeStart(NodeType.Tile)
        this.writeU8Raw(tile.x - ax)
        this.writeU8Raw(tile.y - ay)

        if (tile.flags !== 0) {
          this.writeByte(Attr.TileFlags)
          this.writeU32(tile.flags)
        }

        for (const item of tile.items) {
          if (item.count !== undefined || item.actionId !== undefined || item.uniqueId !== undefined || item.text) {
            // item node with attributes
            this.nodeStart(NodeType.Item)
            this.writeU16(item.id)
            if (item.count !== undefined) {
              this.writeByte(Attr.Count)
              this.writeByte(item.count)
            }
            if (item.actionId !== undefined) {
              this.writeByte(Attr.ActionId)
              this.writeU16(item.actionId)
            }
            if (item.uniqueId !== undefined) {
              this.writeByte(Attr.UniqueId)
              this.writeU16(item.uniqueId)
            }
            if (item.text) {
              this.writeByte(Attr.Text)
              this.writeString(item.text)
            }
            this.nodeEnd()
          } else {
            // inline item attribute
            this.writeByte(Attr.Item)
            this.writeU16(item.id)
          }
        }

        this.nodeEnd()
      }

      this.nodeEnd()
    }

    this.nodeEnd() // MapData
    this.nodeEnd() // Root

    return new Uint8Array(this.buf).buffer
  }

  private groupByArea(tiles: Map<string, MapTile>): Map<string, MapTile[]> {
    const areas = new Map<string, MapTile[]>()
    for (const tile of tiles.values()) {
      const ax = tile.x & ~0xFF
      const ay = tile.y & ~0xFF
      const key = `${ax},${ay},${tile.z}`
      if (!areas.has(key)) areas.set(key, [])
      areas.get(key)!.push(tile)
    }
    return areas
  }

  private writeHeader(h: MapHeader): void {
    this.writeU32Raw(h.version)
    this.writeU16Raw(h.width)
    this.writeU16Raw(h.height)
    this.writeU32Raw(h.majorVersion)
    this.writeU32Raw(h.minorVersion)
  }

  private writeAttrString(attr: number, s: string): void {
    this.writeByte(attr)
    this.writeString(s)
  }

  private nodeStart(type: number): void {
    this.buf.push(NODE_START, type)
  }
  private nodeEnd(): void {
    this.buf.push(NODE_END)
  }

  // escaped writes (used inside node data)
  private writeByte(b: number): void {
    if (b === NODE_START || b === NODE_END || b === ESCAPE) this.buf.push(ESCAPE)
    this.buf.push(b)
  }
  private writeU16(v: number): void {
    this.writeByte(v & 0xFF)
    this.writeByte((v >> 8) & 0xFF)
  }
  private writeU32(v: number): void {
    this.writeByte(v & 0xFF)
    this.writeByte((v >> 8) & 0xFF)
    this.writeByte((v >> 16) & 0xFF)
    this.writeByte((v >> 24) & 0xFF)
  }
  private writeString(s: string): void {
    this.writeU16(s.length)
    for (let i = 0; i < s.length; i++) this.writeByte(s.charCodeAt(i))
  }

  // raw writes (used in headers / fixed-format data, outside escaped context)
  private writeU8Raw(v: number): void  { this.buf.push(v & 0xFF) }
  private writeU16Raw(v: number): void { this.buf.push(v & 0xFF, (v >> 8) & 0xFF) }
  private writeU32Raw(v: number): void {
    this.buf.push(v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF)
  }
}
