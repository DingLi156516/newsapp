/**
 * lib/ai/entity-extractor.ts — AI-powered entity extraction for stories.
 *
 * Extracts people, organizations, locations, events, and topics from
 * article titles/descriptions using Gemini. Returns `null` on any
 * failure (so callers can preserve existing tags) and `[]` when
 * extraction succeeds but yields no entities.
 */

import { generateText } from '@/lib/ai/gemini-client'

export type EntityType = 'person' | 'organization' | 'location' | 'event' | 'topic'

export interface ExtractedEntity {
  readonly label: string
  readonly type: EntityType
  readonly relevance: number
}

const VALID_ENTITY_TYPES: readonly EntityType[] = [
  'person', 'organization', 'location', 'event', 'topic',
]

const MAX_ENTITIES = 10
const MAX_ARTICLES = 10

function buildPrompt(
  titles: readonly string[],
  descriptions: readonly (string | null)[]
): string {
  const articlesBlock = titles
    .map((title, i) => {
      const desc = descriptions[i]
      return desc ? `${title} — ${desc}` : title
    })
    .join('\n')

  return `Extract key entities from these news articles about the same story.

Articles:
${articlesBlock}

Extract 3-10 entities. Each entity must have:
- "label": proper name or phrase (e.g., "Donald Trump", "NATO", "Iran")
- "type": one of person, organization, location, event, topic
- "relevance": 0.0-1.0 indicating how central this entity is to the story

Rules:
- Prefer specific entities over generic ones (e.g., "NATO" over "military alliance")
- Deduplicate: merge variants like "Trump" and "Donald Trump" into one entry
- Use title case for labels
- The most central entity should have relevance close to 1.0

Return a JSON array of entities. Return ONLY valid JSON, no markdown or code blocks.
Example: [{"label": "Iran", "type": "location", "relevance": 0.95}]`
}

function parseEntities(text: string): readonly ExtractedEntity[] | null {
  if (!text.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(text.trim())

    if (!Array.isArray(parsed)) {
      return null
    }

    const validated = parsed.filter(isValidEntity)

    // Deduplicate by lowercased label + type before enforcing cap — keeps highest relevance
    const byLabel = new Map<string, typeof validated[number]>()
    for (const e of validated) {
      const key = `${e.label.trim().toLowerCase()}:${e.type}`
      const existing = byLabel.get(key)
      if (!existing || e.relevance > existing.relevance) {
        byLabel.set(key, e)
      }
    }

    return [...byLabel.values()]
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, MAX_ENTITIES)
      .map((e) => ({
        label: e.label.trim(),
        type: e.type as EntityType,
        relevance: Math.round(e.relevance * 100) / 100,
      }))
  } catch {
    return null
  }
}

function isValidEntity(entity: unknown): entity is { label: string; type: string; relevance: number } {
  if (typeof entity !== 'object' || entity === null) return false
  const obj = entity as Record<string, unknown>
  return (
    typeof obj.label === 'string' &&
    obj.label.trim().length > 0 &&
    typeof obj.type === 'string' &&
    VALID_ENTITY_TYPES.includes(obj.type as EntityType) &&
    typeof obj.relevance === 'number' &&
    obj.relevance >= 0 &&
    obj.relevance <= 1
  )
}

export async function extractEntities(
  articleTitles: readonly string[],
  articleDescriptions: readonly (string | null)[]
): Promise<readonly ExtractedEntity[] | null> {
  if (articleTitles.length === 0) {
    return []
  }

  const cappedTitles = articleTitles.slice(0, MAX_ARTICLES)
  const cappedDescriptions = articleDescriptions.slice(0, MAX_ARTICLES)

  try {
    // Primary: titles + descriptions
    const prompt = buildPrompt(cappedTitles, cappedDescriptions)
    const response = await generateText(prompt, { jsonMode: true })
    const result = parseEntities(response.text)
    if (result !== null) return result

    // Fallback: titles only (avoids safety filters on description content)
    console.error('[entity-extractor] Empty/invalid response — retrying with titles only')
    const retryPrompt = buildPrompt(cappedTitles, cappedTitles.map(() => null))
    const retryResponse = await generateText(retryPrompt, { jsonMode: true })
    const retryResult = parseEntities(retryResponse.text)
    return retryResult
  } catch (err) {
    console.error('[entity-extractor] Failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}
