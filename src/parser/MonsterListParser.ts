/**
 * Reads data/monster/monsters.xml to build the autocomplete list.
 * Format: <monsters><monster name="Rat" file="monsters/rat.xml"/></monsters>
 */
import { XMLParser } from 'fast-xml-parser'

export class MonsterListParser {
  parse(xml: string): string[] {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: false,
      isArray: (name) => name === 'monster'
    })
    const doc = parser.parse(xml)
    const list = doc?.monsters?.monster || []
    return list
      .map((m: Record<string, string>) => String(m['@_name'] || ''))
      .filter((n: string) => n.length > 0)
      .sort()
  }
}
