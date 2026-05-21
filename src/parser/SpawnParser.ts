/**
 * Spawn XML parser/writer — GermantecOT format
 *
 * File convention: {mapName}-spawn.xml  (e.g. map1-spawn.xml)
 * Lives in: {tfsRoot}/data/world/
 *
 * Format:
 * <spawns>
 *   <spawn centerx="132" centery="40" centerz="7" radius="5">
 *     <monster name="Slime" x="132" y="40" z="7" direction="2" spawntime="10"/>
 *     <npc     name="Tarin" x="129" y="40" z="7" direction="0" spawntime="60"/>
 *   </spawn>
 * </spawns>
 */
import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import { SpawnDefinition, SpawnCreature } from '../types'

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseAttributeValue: true,
  isArray: (name: string) => ['spawn', 'monster', 'npc'].includes(name)
}

const builderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '    ',
  suppressEmptyNode: true
}

export class SpawnParser {
  parse(xml: string): SpawnDefinition[] {
    const parser = new XMLParser(parserOptions)
    const doc = parser.parse(xml)
    const spawns: SpawnDefinition[] = []

    const rawSpawns = doc?.spawns?.spawn
    if (!rawSpawns) return spawns

    for (const raw of rawSpawns) {
      const creatures: SpawnCreature[] = []

      const monsters = raw.monster || []
      for (const m of monsters) {
        creatures.push({
          kind: 'monster',
          name: String(m['@_name'] || ''),
          x: Number(m['@_x'] || 0),
          y: Number(m['@_y'] || 0),
          z: Number(m['@_z'] || 0),
          direction: Number(m['@_direction'] || 0),
          spawnTime: Number(m['@_spawntime'] || 60)
        })
      }

      const npcs = raw.npc || []
      for (const n of npcs) {
        creatures.push({
          kind: 'npc',
          name: String(n['@_name'] || ''),
          x: Number(n['@_x'] || 0),
          y: Number(n['@_y'] || 0),
          z: Number(n['@_z'] || 0),
          direction: Number(n['@_direction'] || 0),
          spawnTime: Number(n['@_spawntime'] || 60)
        })
      }

      spawns.push({
        centerX: Number(raw['@_centerx'] || 0),
        centerY: Number(raw['@_centery'] || 0),
        centerZ: Number(raw['@_centerz'] || 0),
        radius: Number(raw['@_radius'] || 1),
        creatures
      })
    }

    return spawns
  }

  serialize(spawns: SpawnDefinition[]): string {
    const spawnNodes = spawns.map(s => {
      const monsterNodes = s.creatures
        .filter(c => c.kind === 'monster')
        .map(c => ({
          '@_name': c.name,
          '@_x': c.x,
          '@_y': c.y,
          '@_z': c.z,
          '@_direction': c.direction,
          '@_spawntime': c.spawnTime
        }))

      const npcNodes = s.creatures
        .filter(c => c.kind === 'npc')
        .map(c => ({
          '@_name': c.name,
          '@_x': c.x,
          '@_y': c.y,
          '@_z': c.z,
          '@_direction': c.direction,
          '@_spawntime': c.spawnTime
        }))

      const node: Record<string, unknown> = {
        '@_centerx': s.centerX,
        '@_centery': s.centerY,
        '@_centerz': s.centerZ,
        '@_radius': s.radius
      }
      if (monsterNodes.length) node.monster = monsterNodes
      if (npcNodes.length) node.npc = npcNodes
      return node
    })

    const builder = new XMLBuilder(builderOptions)
    return '<?xml version="1.0"?>\n' + builder.build({ spawns: { spawn: spawnNodes } })
  }
}
