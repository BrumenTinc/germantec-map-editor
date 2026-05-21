/**
 * NPC parser/writer for GermantecOT
 *
 * Two sources:
 *  1. data/npc/*.xml       — NPC definition (look, script)
 *  2. data/globalevents/scripts/startup.lua — positions via Game.createNpc()
 *
 * NPC type is inferred from script name:
 *   job_*.lua / elara.lua → shop
 *   *dialog* / *npc_dialog* → dialog
 *   *quest* → quest
 *   default → dialog
 */
import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import { NpcDefinition, NpcType } from '../types'

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true
}

const builderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '    '
}

export class NpcParser {
  /**
   * Parse a single NPC XML file.
   * Position is NOT set here (comes from startup.lua).
   */
  parseXml(xml: string, defaultName?: string): Partial<NpcDefinition> {
    const parser = new XMLParser(parserOptions)
    const doc = parser.parse(xml)
    const npc = doc?.npc

    if (!npc) return {}

    const script: string = String(npc['@_script'] || '')
    const type = this.inferType(script)

    const look = npc.look || {}

    return {
      name: String(npc['@_name'] || defaultName || ''),
      type,
      script,
      lookType:   Number(look['@_type']   || 136),
      lookHead:   Number(look['@_head']   || 0),
      lookBody:   Number(look['@_body']   || 0),
      lookLegs:   Number(look['@_legs']   || 0),
      lookFeet:   Number(look['@_feet']   || 0),
      lookAddons: Number(look['@_addons'] || 0),
      walkInterval: Number(npc['@_walkinterval'] || 0),
      direction: 2, // south by default
      position: { x: 0, y: 0, z: 0 }
    }
  }

  /**
   * Serialize an NPC definition back to XML.
   */
  serializeXml(npc: NpcDefinition): string {
    const builder = new XMLBuilder(builderOptions)
    const obj = {
      npc: {
        '@_name': npc.name,
        '@_script': npc.script,
        '@_walkinterval': npc.walkInterval,
        '@_floorchange': 0,
        health: { '@_now': 100, '@_max': 100 },
        look: {
          '@_type':   npc.lookType,
          '@_head':   npc.lookHead,
          '@_body':   npc.lookBody,
          '@_legs':   npc.lookLegs,
          '@_feet':   npc.lookFeet,
          '@_addons': npc.lookAddons
        }
      }
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(obj)
  }

  /**
   * Parse NPC positions from startup.lua.
   * Looks for: Game.createNpc("Name", Position(x, y, z))
   */
  parseStartupPositions(lua: string): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>()
    const re = /Game\.createNpc\(\s*["']([^"']+)["']\s*,\s*Position\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(lua)) !== null) {
      map.set(m[1], { x: Number(m[2]), y: Number(m[3]), z: Number(m[4]) })
    }
    return map
  }

  /**
   * Update or insert a Game.createNpc() line in startup.lua for a given NPC.
   * If the NPC already exists, replaces its position.
   * If not, appends a new line after the last Game.createNpc call.
   */
  upsertStartupPosition(lua: string, npc: NpcDefinition): string {
    const line = `Game.createNpc("${npc.name}", Position(${npc.position.x}, ${npc.position.y}, ${npc.position.z}))`
    const existing = new RegExp(
      `Game\\.createNpc\\(\\s*["']${npc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'].*\\)`,
      'g'
    )

    if (existing.test(lua)) {
      return lua.replace(existing, line)
    }

    // Find last Game.createNpc and insert after it
    const lastIdx = lua.lastIndexOf('Game.createNpc(')
    if (lastIdx === -1) {
      return lua + '\n' + line + '\n'
    }
    const lineEnd = lua.indexOf('\n', lastIdx)
    if (lineEnd === -1) return lua + '\n' + line
    return lua.slice(0, lineEnd + 1) + line + '\n' + lua.slice(lineEnd + 1)
  }

  /**
   * Remove a Game.createNpc() line for a given NPC name from startup.lua.
   */
  removeStartupPosition(lua: string, npcName: string): string {
    const re = new RegExp(
      `^.*Game\\.createNpc\\(\\s*["']${npcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'].*\\).*\\n?`,
      'gm'
    )
    return lua.replace(re, '')
  }

  private inferType(script: string): NpcType {
    const s = script.toLowerCase()
    if (s.startsWith('job_') || s.includes('shop') || s.includes('trade') || s.includes('elara')) return 'shop'
    if (s.includes('quest')) return 'quest'
    return 'dialog'
  }
}

