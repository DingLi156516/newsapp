/**
 * Tests for lib/ai/entity-extractor.ts — extractEntities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/gemini-client', () => ({
  generateText: vi.fn(),
}))

describe('extractEntities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns entities from valid Gemini JSON response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify([
        { label: 'Donald Trump', type: 'person', relevance: 0.95 },
        { label: 'NATO', type: 'organization', relevance: 0.8 },
        { label: 'Iran', type: 'location', relevance: 0.7 },
      ]),
    })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Trump meets NATO leaders on Iran'],
      ['Diplomatic talks intensify']
    )

    expect(result).not.toBeNull()
    expect(result).toHaveLength(3)
    expect(result![0]).toEqual({ label: 'Donald Trump', type: 'person', relevance: 0.95 })
    expect(result![1]).toEqual({ label: 'NATO', type: 'organization', relevance: 0.8 })
    expect(result![2]).toEqual({ label: 'Iran', type: 'location', relevance: 0.7 })
  })

  it('returns empty array for empty input', async () => {
    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities([], [])

    expect(result).toEqual([])
  })

  it('returns null on Gemini API error', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockRejectedValue(new Error('API timeout'))

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(['Some article'], [null])

    expect(result).toBeNull()
  })

  it('returns null on invalid JSON from both attempts', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: 'not json' })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(['Some article'], [null])

    expect(generateText).toHaveBeenCalledTimes(2)
    expect(result).toBeNull()
  })

  it('returns null on empty response from both attempts', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({ text: '' })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(['Some article'], [null])

    expect(generateText).toHaveBeenCalledTimes(2)
    expect(result).toBeNull()
  })

  it('returns null when response is not an array from both attempts', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ label: 'Iran', type: 'location', relevance: 0.9 }),
    })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(['Some article'], [null])

    expect(generateText).toHaveBeenCalledTimes(2)
    expect(result).toBeNull()
  })

  it('filters out entities with invalid type', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify([
        { label: 'Iran', type: 'location', relevance: 0.9 },
        { label: 'Concept', type: 'abstract', relevance: 0.5 },
      ]),
    })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(['Some article'], [null])

    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result![0].label).toBe('Iran')
  })

  it('filters out entities with relevance outside 0-1', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify([
        { label: 'Iran', type: 'location', relevance: 0.9 },
        { label: 'NATO', type: 'organization', relevance: 1.5 },
        { label: 'Bad', type: 'person', relevance: -0.1 },
      ]),
    })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(['Some article'], [null])

    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result![0].label).toBe('Iran')
  })

  it('filters out entities with empty label', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify([
        { label: '', type: 'person', relevance: 0.9 },
        { label: 'Iran', type: 'location', relevance: 0.8 },
      ]),
    })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(['Some article'], [null])

    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result![0].label).toBe('Iran')
  })

  it('caps entities at 10, keeping highest relevance', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    // 15 entities in shuffled relevance order — NOT sorted by relevance
    const entities = [
      { label: 'Entity Low1', type: 'person', relevance: 0.15 },
      { label: 'Entity High1', type: 'person', relevance: 0.95 },
      { label: 'Entity Low2', type: 'organization', relevance: 0.10 },
      { label: 'Entity High2', type: 'location', relevance: 0.90 },
      { label: 'Entity Low3', type: 'topic', relevance: 0.20 },
      { label: 'Entity High3', type: 'event', relevance: 0.85 },
      { label: 'Entity High4', type: 'person', relevance: 0.80 },
      { label: 'Entity Low4', type: 'organization', relevance: 0.05 },
      { label: 'Entity High5', type: 'location', relevance: 0.75 },
      { label: 'Entity High6', type: 'topic', relevance: 0.70 },
      { label: 'Entity High7', type: 'event', relevance: 0.65 },
      { label: 'Entity Low5', type: 'person', relevance: 0.25 },
      { label: 'Entity High8', type: 'organization', relevance: 0.60 },
      { label: 'Entity High9', type: 'location', relevance: 0.55 },
      { label: 'Entity High10', type: 'topic', relevance: 0.50 },
    ]
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify(entities),
    })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(['Some article'], [null])

    expect(result).not.toBeNull()
    expect(result).toHaveLength(10)
    // All 5 low-relevance entities (0.05–0.25) should be dropped
    const labels = result!.map((e) => e.label)
    expect(labels).not.toContain('Entity Low1')
    expect(labels).not.toContain('Entity Low2')
    expect(labels).not.toContain('Entity Low3')
    expect(labels).not.toContain('Entity Low4')
    expect(labels).not.toContain('Entity Low5')
    // Result should be sorted by relevance descending
    const relevances = result!.map((e) => e.relevance)
    expect(relevances).toEqual([...relevances].sort((a, b) => b - a))
  })

  it('deduplicates by lowercased label before enforcing cap', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    // 12 entities, 2 are case-duplicates of earlier ones → 10 unique after dedup
    const entities = [
      { label: 'Donald Trump', type: 'person', relevance: 0.95 },
      { label: 'NATO', type: 'organization', relevance: 0.9 },
      { label: 'Iran', type: 'location', relevance: 0.88 },
      { label: 'donald trump', type: 'person', relevance: 0.5 },  // case-dup of [0]
      { label: 'Ukraine', type: 'location', relevance: 0.85 },
      { label: 'EU', type: 'organization', relevance: 0.8 },
      { label: 'nato', type: 'organization', relevance: 0.4 },     // case-dup of [1]
      { label: 'China', type: 'location', relevance: 0.75 },
      { label: 'Russia', type: 'location', relevance: 0.7 },
      { label: 'Congress', type: 'organization', relevance: 0.65 },
      { label: 'Pentagon', type: 'organization', relevance: 0.6 },
      { label: 'Climate Summit', type: 'event', relevance: 0.55 },
    ]
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify(entities),
    })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(['Some article'], [null])

    expect(result).not.toBeNull()
    expect(result).toHaveLength(10)
    const labels = result!.map((e) => e.label.toLowerCase())
    const uniqueLabels = new Set(labels)
    expect(uniqueLabels.size).toBe(10)
    // Higher-relevance "Donald Trump" kept, not "donald trump"
    expect(result!.find((e) => e.label === 'Donald Trump')).toBeTruthy()
    expect(result!.find((e) => e.label === 'donald trump')).toBeFalsy()
  })

  it('preserves same-label entities with different types', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify([
        { label: 'Jordan', type: 'person', relevance: 0.9 },
        { label: 'Jordan', type: 'location', relevance: 0.85 },
      ]),
    })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(['Jordan visits Jordan'], [null])

    expect(result).not.toBeNull()
    expect(result).toHaveLength(2)
    expect(result!.find((e) => e.type === 'person')).toBeTruthy()
    expect(result!.find((e) => e.type === 'location')).toBeTruthy()
  })

  it('deduplicates same-label same-type keeping highest relevance', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify([
        { label: 'Jordan', type: 'person', relevance: 0.9 },
        { label: 'jordan', type: 'person', relevance: 0.5 },
      ]),
    })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(['Some article'], [null])

    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result![0].label).toBe('Jordan')
    expect(result![0].relevance).toBe(0.9)
  })

  it('caps articles at MAX_ARTICLES (10)', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify([
        { label: 'Iran', type: 'location', relevance: 0.9 },
      ]),
    })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const titles = Array.from({ length: 15 }, (_, i) => `Article ${i + 1}`)
    const descriptions = titles.map((_, i) => `Description ${i + 1}`)
    await extractEntities(titles, descriptions)

    const calledPrompt = vi.mocked(generateText).mock.calls[0][0]
    // First 10 articles should be in the prompt
    for (let i = 1; i <= 10; i++) {
      expect(calledPrompt).toContain(`Article ${i}`)
      expect(calledPrompt).toContain(`Description ${i}`)
    }
    // Articles 11-15 should NOT be in the prompt
    for (let i = 11; i <= 15; i++) {
      expect(calledPrompt).not.toContain(`Article ${i}`)
    }
  })

  it('retries with titles only on empty response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText)
      .mockResolvedValueOnce({ text: '' })  // primary fails
      .mockResolvedValueOnce({
        text: JSON.stringify([
          { label: 'Iran', type: 'location', relevance: 0.9 },
        ]),
      })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['US strikes Iran targets'],
      ['Military action intensifies in the region']
    )

    expect(generateText).toHaveBeenCalledTimes(2)
    // Retry prompt should NOT contain the description
    const retryPrompt = vi.mocked(generateText).mock.calls[1][0]
    expect(retryPrompt).not.toContain('Military action intensifies')
    expect(retryPrompt).toContain('US strikes Iran targets')
    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result![0].label).toBe('Iran')
  })

  it('retries with titles only on invalid JSON response', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText)
      .mockResolvedValueOnce({ text: 'not valid json' })  // primary fails
      .mockResolvedValueOnce({
        text: JSON.stringify([
          { label: 'NATO', type: 'organization', relevance: 0.85 },
        ]),
      })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['NATO summit begins'],
      ['Leaders gather for key discussions']
    )

    expect(generateText).toHaveBeenCalledTimes(2)
    expect(result).not.toBeNull()
    expect(result![0].label).toBe('NATO')
  })

  it('returns null when both primary and retry fail', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText)
      .mockResolvedValueOnce({ text: '' })  // primary fails
      .mockResolvedValueOnce({ text: '' })  // retry also fails

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Some article'],
      ['Some description']
    )

    expect(generateText).toHaveBeenCalledTimes(2)
    expect(result).toBeNull()
  })

  it('returns empty array when primary parse fails and retry yields empty array', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText)
      .mockResolvedValueOnce({ text: '' })  // primary fails
      .mockResolvedValueOnce({ text: '[]' })  // retry parses but empty

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Some article'],
      ['Some description']
    )

    expect(generateText).toHaveBeenCalledTimes(2)
    expect(result).toEqual([])
  })

  it('returns empty array immediately when primary returns empty array', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText)
      .mockResolvedValueOnce({ text: '[]' })  // primary parses but empty — trusted

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Senate passes spending bill'],
      ['Bipartisan agreement reached']
    )

    expect(generateText).toHaveBeenCalledTimes(1)
    expect(result).toEqual([])
  })

  it('returns empty array when primary returns empty — no retry attempted', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText)
      .mockResolvedValueOnce({ text: '[]' })  // primary parses but empty — trusted

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Senate passes spending bill'],
      ['Bipartisan agreement reached']
    )

    expect(generateText).toHaveBeenCalledTimes(1)
    expect(result).toEqual([])
  })

  it('trusts primary empty array without retrying for entities', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText)
      .mockResolvedValueOnce({ text: '[]' })  // primary parses but empty — trusted

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(
      ['Senate passes spending bill'],
      ['Bipartisan agreement reached']
    )

    expect(generateText).toHaveBeenCalledTimes(1)
    expect(result).toEqual([])
  })

  it('rounds relevance to 2 decimal places', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify([
        { label: 'Iran', type: 'location', relevance: 0.8567 },
      ]),
    })

    const { extractEntities } = await import('@/lib/ai/entity-extractor')
    const result = await extractEntities(['Some article'], [null])

    expect(result).not.toBeNull()
    expect(result![0].relevance).toBe(0.86)
  })
})
