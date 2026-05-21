/**
 * SpriteCache — converts raw RGBA sprite data into PIXI Textures.
 * Sprites are decoded on demand and cached forever.
 */
import * as PIXI from 'pixi.js'
import { SprParser } from '../parser/SprParser'
import { ItemType } from '../types'

const SPRITE_SIZE = 32

export class SpriteCache {
  private parser: SprParser
  private textures: Map<number, PIXI.Texture> = new Map()
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor(sprBuffer: ArrayBuffer) {
    this.parser = new SprParser(sprBuffer)
    this.parser.parse()

    this.canvas = document.createElement('canvas')
    this.canvas.width = SPRITE_SIZE
    this.canvas.height = SPRITE_SIZE
    this.ctx = this.canvas.getContext('2d')!
  }

  getTexture(spriteId: number): PIXI.Texture {
    if (this.textures.has(spriteId)) return this.textures.get(spriteId)!

    const imageData = this.parser.getSpriteImageData(spriteId)
    if (!imageData) {
      const t = PIXI.Texture.EMPTY
      this.textures.set(spriteId, t)
      return t
    }

    this.ctx.putImageData(imageData, 0, 0)
    const url = this.canvas.toDataURL()
    const t = PIXI.Texture.from(url)
    this.textures.set(spriteId, t)
    return t
  }

  /**
   * Get the first visible sprite texture for an item type.
   * Uses phase=0, layer=0, patternX=0, patternY=0, patternZ=0
   */
  getItemTexture(item: ItemType): PIXI.Texture {
    const group = item.groups[0]
    if (!group || group.sprites.length === 0) return PIXI.Texture.EMPTY
    const spriteId = group.sprites[0]
    return this.getTexture(spriteId)
  }

  /**
   * Build a single PIXI.Sprite for an item using its actual dimensions.
   * Multi-tile items (width/height > 1) are rendered as a single sprite (top-left piece).
   */
  buildSprite(item: ItemType): PIXI.Sprite {
    const texture = this.getItemTexture(item)
    const sprite = new PIXI.Sprite(texture)
    sprite.width = SPRITE_SIZE
    sprite.height = SPRITE_SIZE
    return sprite
  }

  dispose(): void {
    for (const t of this.textures.values()) {
      if (t !== PIXI.Texture.EMPTY) t.destroy(true)
    }
    this.textures.clear()
  }
}
