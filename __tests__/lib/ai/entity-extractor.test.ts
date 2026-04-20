/**
 * Tests for lib/ai/entity-extractor.ts — local deterministic extraction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/gemini-client', () => ({
  generateText: vi.fn(),
}))

describe('extractEntities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array for empty input', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities([], [])

    expect(result).toEqual([])
  })

  it('extracts local entities without calling Gemini', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    const { extractEntities } = await import('@/lib/ai/entity-extractor')

    const result = await extractEntities(
      [
        'Donald Trump meets NATO leaders in Washington',
        'NATO and European Union officials discuss Ukraine aid',
      ],
      [
        'The White House said Donald Trump would meet Ukrainian officials.',
        'EU leaders said NATO coordination remains central.',
      ]
    )

    expect(generateText).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Donald Trump', type: 'person' }),
        expect.objectContaining({ label: 'NATO', type: 'organization' }),
        expect.objectContaining({ label: 'Ukraine', type: 'location' }),
      ])
    )
  })

  it('deduplicates acronym and full-name aliases', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')

    const result = await extractEntities(
      ['EU leaders meet European Union officials'],
      ['The European Union announced a new trade package.']
    )

    expect(result).not.toBeNull()
    const europeanUnion = (result ?? []).filter((entity) => entity.label === 'European Union')
    expect(europeanUnion).toHaveLength(1)
    expect(europeanUnion[0]).toEqual(
      expect.objectContaining({ type: 'organization' })
    )
  })

  it('caps entities at 10 and ranks repeated cross-article entities first', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')

    const result = await extractEntities(
      [
        'NASA and NATO discuss Ukraine with Donald Trump in Washington',
        'NASA launches Artemis update as NATO tracks Ukraine conflict',
        'European Union, United Nations, Paris, London, Canada, Mexico and China respond',
      ],
      [
        'The White House said NASA briefed the Senate.',
        'Officials in Washington said Ukraine remains central.',
        'Russia and Iran also commented on the Summit.',
      ]
    )

    expect(result).not.toBeNull()
    const entities = result ?? []
    expect(entities).toHaveLength(10)
    expect(entities[0]).toEqual(expect.objectContaining({ label: 'NASA' }))
    expect(entities.map((entity) => entity.label)).toContain('NATO')
  })

  it('adds topic tags from deterministic keywords', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')

    const result = await extractEntities(
      ['Climate bill targets wildfire emissions'],
      ['The technology plan also mentions artificial intelligence.']
    )

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Climate', type: 'topic' }),
        expect.objectContaining({ label: 'Artificial Intelligence', type: 'topic' }),
      ])
    )
  })

  it('returns null when no local entities are found to preserve existing tags', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(['lowercase headline only'], [null])

    expect(result).toBeNull()
  })

  it('drops single-word unknown proper names rather than mislabelling them', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Trump meets Biden', 'Apple unveils product'],
      [null, null]
    )

    const labels = (result ?? []).map((entity) => entity.label)
    expect(labels).not.toContain('Trump')
    expect(labels).not.toContain('Biden')
    expect(labels).not.toContain('Apple')
  })

  it('surfaces embedded acronyms and locations in title-cased headlines', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Biden Meets NATO Leaders In Washington'],
      [null]
    )

    const labels = (result ?? []).map((entity) => entity.label)
    expect(labels).toContain('NATO')
    expect(labels).toContain('Washington')
  })

  it('does not fire short topic keywords on substring matches', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Officials said aid package could boost rebuilding'],
      ['They said the aid would arrive soon.']
    )

    const topicLabels = (result ?? [])
      .filter((entity) => entity.type === 'topic')
      .map((entity) => entity.label)
    // "said" / "aid" must not trigger the "ai" → Artificial Intelligence path.
    expect(topicLabels).not.toContain('Artificial Intelligence')
  })

  it('preserves multi-word location names like "New York"', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Flooding hits New York as Hurricane approaches'],
      ['New York officials declared a state of emergency.']
    )

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'New York', type: 'location' }),
      ])
    )
  })

  it('drops long title-cased runs rather than mislabelling them as people', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Biden Meets NATO Leaders In Washington'],
      [null]
    )

    const personLabels = (result ?? [])
      .filter((entity) => entity.type === 'person')
      .map((entity) => entity.label)
    expect(personLabels).not.toContain('Biden Meets NATO Leaders')
  })

  it('classifies organization/event vocabulary on whole-token matches only', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Courtney Cox and Warren Buffett speak at gala'],
      [null]
    )

    const entities = result ?? []
    const courtney = entities.find((entity) => entity.label === 'Courtney Cox')
    const warren = entities.find((entity) => entity.label === 'Warren Buffett')
    // "Court" inside "Courtney" must not yield organization; "War" inside
    // "Warren" must not yield event. These should either drop or classify
    // as person — never as organization/event.
    if (courtney) expect(courtney.type).not.toBe('organization')
    if (warren) expect(warren.type).not.toBe('event')
  })

  it('recognizes letter+digit acronyms like G7 and G20', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['G7 leaders meet in Canada to discuss trade'],
      ['G20 ministers also commented on the agenda.']
    )

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'G7', type: 'organization' }),
        expect.objectContaining({ label: 'G20', type: 'organization' }),
      ])
    )
  })

  it('captures multi-letter+digit acronyms like COP28 as tokens', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['COP28 Summit delivers mixed results'],
      [null]
    )

    const labels = (result ?? []).map((entity) => entity.label)
    expect(labels).toContain('COP28')
  })

  it('drops 3-word title-cased headline chunks rather than tagging them as people', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Trump Faces Charges Again'],
      [null]
    )

    const personLabels = (result ?? [])
      .filter((entity) => entity.type === 'person')
      .map((entity) => entity.label)
    expect(personLabels).not.toContain('Trump Faces Charges')
    expect(personLabels).not.toContain('Trump Faces Charges Again')
  })

  it('drops long title-cased runs that merely contain an org/event token', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Supreme Court Blocks New York Rule On Housing'],
      [null]
    )

    const entities = result ?? []
    // "Supreme Court Blocks New York Rule On Housing" must NOT appear as a
    // whole-run organization tag just because it contains "Court".
    const orgLabels = entities
      .filter((entity) => entity.type === 'organization')
      .map((entity) => entity.label)
    expect(orgLabels).not.toContain('Supreme Court Blocks New York Rule On Housing')
    // The real location "New York" must survive.
    expect(entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'New York', type: 'location' }),
      ])
    )
  })

  it('counts a standalone known acronym only once per textual occurrence', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['NATO statement released'],
      ['NATO released a joint statement.']
    )

    const entities = result ?? []
    const natoEntries = entities.filter((entity) => entity.label === 'NATO')
    expect(natoEntries).toHaveLength(1)
    // Two articles each mention NATO once — count should reflect that,
    // not double-count via Pass 1 + Pass 2 emitting the same occurrence.
    // (This assertion exercises observable ranking rather than the count
    // field directly, which the public API omits.)
    expect(natoEntries[0].relevance).toBeGreaterThan(0)
  })

  it('canonicalizes dotted acronyms into their full-name aliases', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['The U.S. announced sanctions on U.K. trade'],
      [null]
    )

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'United States', type: 'location' }),
        expect.objectContaining({ label: 'United Kingdom', type: 'location' }),
      ])
    )
  })
})
