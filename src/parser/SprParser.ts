/**
 * Tibia.spr parser — protocol 10.98
 * Extracts sprite pixel data as ImageData (RGBA).
 * Each sprite is 32x32 pixels.
 */

const SPRITE_SIZE = 32
const SPRITE_PIXELS = SPRITE_SIZE * SPRITE_SIZE
const SPRITE_CHANNELS = 4 // RGBA

export class SprParser {
  private view: DataView
  private spriteCount = 0
  private offsets: Uint32Array

  constructor(private buffer: ArrayBuffer) {
    this.view = new DataView(buffer)
    this.offsets = new Uint32Array(0)
  }

  parse(): void {
    let pos = 0
    // signature (4 bytes) — ignored
    pos += 4
    this.spriteCount = this.view.getUint32(pos, true)
    pos += 4

    this.offsets = new Uint32Array(this.spriteCount + 1)
    for (let i = 1; i <= this.spriteCount; i++) {
      this.offsets[i] = this.view.getUint32(pos, true)
      pos += 4
    }
  }

  getSpriteCount(): number { return this.spriteCount }

  /**
   * Returns RGBA pixel data for a sprite ID (1-based).
   * Returns null for ID=0 (transparent/empty).
   */
  getSprite(id: number): Uint8ClampedArray | null {
    if (id === 0 || id > this.spriteCount) return null
    const fileOffset = this.offsets[id]
    if (fileOffset === 0) return null

    const buf  = new ArrayBuffer(SPRITE_PIXELS * SPRITE_CHANNELS)
    const rgba = new Uint8ClampedArray(buf)

    let pos = fileOffset
    // skip color key (3 bytes: R G B — usually magenta 0xFF00FF)
    pos += 3
    // data size (2 bytes)
    const dataSize = this.view.getUint16(pos, true)
    pos += 2

    const end = pos + dataSize
    let pixel = 0

    while (pos < end && pixel < SPRITE_PIXELS) {
      const transparent = this.view.getUint16(pos, true)
      pos += 2
      pixel += transparent

      const colored = this.view.getUint16(pos, true)
      pos += 2

      for (let c = 0; c < colored && pixel < SPRITE_PIXELS; c++, pixel++) {
        const idx = pixel * SPRITE_CHANNELS
        rgba[idx]     = this.view.getUint8(pos++)  // R
        rgba[idx + 1] = this.view.getUint8(pos++)  // G
        rgba[idx + 2] = this.view.getUint8(pos++)  // B
        rgba[idx + 3] = 255                         // A
      }
    }

    return rgba
  }

  /**
   * Returns an ImageData (usable in Canvas 2D) for a sprite.
   */
  getSpriteImageData(id: number): ImageData | null {
    const rgba = this.getSprite(id)
    if (!rgba) return null
    // Use 3-arg constructor to avoid SharedArrayBuffer TS error
    return new ImageData(new Uint8ClampedArray(rgba), SPRITE_SIZE, SPRITE_SIZE)
  }
}
