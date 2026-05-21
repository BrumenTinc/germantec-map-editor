/**
 * Undo/Redo system using Command pattern.
 * 100 step limit.
 */
import { editorState } from './EditorState'
import { MapTile } from '../types'

const MAX_HISTORY = 100

export interface Command {
  execute(): void
  undo(): void
  description: string
}

// ──────────────────────────────────────────────
// Concrete commands
// ──────────────────────────────────────────────

export class PaintTileCommand implements Command {
  description = 'Paint tile'
  private previousTile: MapTile | undefined

  constructor(
    private x: number,
    private y: number,
    private z: number,
    private itemId: number
  ) {}

  execute(): void {
    this.previousTile = editorState.getTile(this.x, this.y, this.z)
      ? { ...editorState.getTile(this.x, this.y, this.z)! }
      : undefined
    editorState.paintTile(this.x, this.y, this.z, this.itemId)
  }

  undo(): void {
    if (this.previousTile) {
      editorState.setTile(this.previousTile)
    } else {
      editorState.deleteTile(this.x, this.y, this.z)
    }
  }
}

export class EraseTileCommand implements Command {
  description = 'Erase tile'
  private previousTile: MapTile | undefined

  constructor(private x: number, private y: number, private z: number) {}

  execute(): void {
    this.previousTile = editorState.getTile(this.x, this.y, this.z)
    editorState.eraseTile(this.x, this.y, this.z)
  }

  undo(): void {
    if (this.previousTile) editorState.setTile(this.previousTile)
  }
}

export class BatchCommand implements Command {
  description: string
  constructor(private commands: Command[], desc = 'Batch') {
    this.description = desc
  }
  execute(): void { this.commands.forEach(c => c.execute()) }
  undo(): void { [...this.commands].reverse().forEach(c => c.undo()) }
}

export class PasteCommand implements Command {
  description = 'Paste'
  private overwritten: (MapTile | undefined)[] = []

  constructor(private tiles: MapTile[], private offsetX: number, private offsetY: number) {}

  execute(): void {
    this.overwritten = []
    for (const t of this.tiles) {
      const x = t.x + this.offsetX
      const y = t.y + this.offsetY
      const z = t.z
      this.overwritten.push(editorState.getTile(x, y, z))
      editorState.setTile({ ...t, x, y, z })
    }
  }

  undo(): void {
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i]
      const x = t.x + this.offsetX
      const y = t.y + this.offsetY
      const z = t.z
      const prev = this.overwritten[i]
      if (prev) editorState.setTile(prev)
      else editorState.deleteTile(x, y, z)
    }
  }
}

// ──────────────────────────────────────────────
// Stack
// ──────────────────────────────────────────────
class CommandStack {
  private history: Command[] = []
  private future:  Command[] = []

  execute(cmd: Command): void {
    cmd.execute()
    this.history.push(cmd)
    if (this.history.length > MAX_HISTORY) this.history.shift()
    this.future = []
    editorState.emit('history-changed')
  }

  undo(): void {
    const cmd = this.history.pop()
    if (!cmd) return
    cmd.undo()
    this.future.push(cmd)
    editorState.emit('history-changed')
  }

  redo(): void {
    const cmd = this.future.pop()
    if (!cmd) return
    cmd.execute()
    this.history.push(cmd)
    editorState.emit('history-changed')
  }

  canUndo(): boolean { return this.history.length > 0 }
  canRedo(): boolean { return this.future.length > 0 }

  clear(): void {
    this.history = []
    this.future = []
    editorState.emit('history-changed')
  }
}

export const commandStack = new CommandStack()
