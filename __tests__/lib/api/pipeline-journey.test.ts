import { describe, it, expect, vi } from 'vitest'
import { resolveJourneyQuery } from '@/lib/api/pipeline-journey'

const ARTICLE_UUID = '11111111-1111-1111-1111-111111111111'
const STORY_UUID = '22222222-2222-2222-2222-222222222222'

function chain(handler: () => Promise<unknown>) {
  const c: Record<string, unknown> = {}
  c.select = vi.fn(() => c)
  c.eq = vi.fn(() => c)
  c.in = vi.fn(() => c)
  c.is = vi.fn(() => c)
  c.or = vi.fn(() => c)
  c.order = vi.fn(() => c)
  c.limit = vi.fn(() => c)
  c.maybeSingle = vi.fn(handler)
  // For .in().order().limit() endings we need to await the chain itself.
  c.then = vi.fn((resolve: (value: unknown) => void) => handler().then(resolve))
  return c
}

interface Tables {
  articles: ReturnType<typeof chain>[]
  stories: ReturnType<typeof chain>[]
  pipeline_stage_events: ReturnType<typeof chain>[]
  pipeline_dead_letter: ReturnType<typeof chain>[]
}

function clientWith(tables: Tables) {
  const cursors = { articles: 0, stories: 0, pipeline_stage_events: 0, pipeline_dead_letter: 0 }
  return {
    from: vi.fn((table: keyof Tables) => {
      const arr = tables[table]
      const idx = Math.min(cursors[table], arr.length - 1)
      cursors[table] += 1
      return arr[idx]
    }),
  }
}

describe('resolveJourneyQuery', () => {
  it('returns empty for blank query', async () => {
    const client = clientWith({
      articles: [],
      stories: [],
      pipeline_stage_events: [],
      pipeline_dead_letter: [],
    })
    const result = await resolveJourneyQuery(client as never, '   ')
    expect(result.resolved).toBe('none')
    expect(client.from).not.toHaveBeenCalled()
  })

  it('resolves an article UUID and returns related story', async () => {
    const article = { id: ARTICLE_UUID, story_id: STORY_UUID, url: 'https://e.com/a' }
    const story = { id: STORY_UUID, headline: 'Test' }

    const client = clientWith({
      articles: [chain(async () => ({ data: article, error: null }))],
      stories: [chain(async () => ({ data: story, error: null }))],
      pipeline_stage_events: [chain(async () => ({ data: [{ id: 'ev-1' }], error: null }))],
      pipeline_dead_letter: [chain(async () => ({ data: [], error: null }))],
    })

    const result = await resolveJourneyQuery(client as never, ARTICLE_UUID)
    expect(result.resolved).toBe('article')
    expect(result.articles[0].id).toBe(ARTICLE_UUID)
    expect(result.story?.id).toBe(STORY_UUID)
    expect(result.events.length).toBe(1)
  })

  it('resolves a story UUID and returns its articles', async () => {
    const story = { id: STORY_UUID, headline: 'X' }
    const articles = [{ id: ARTICLE_UUID, story_id: STORY_UUID, url: 'https://e.com/a' }]

    // Article-by-uuid call returns nothing → falls through to story.
    const client = clientWith({
      articles: [
        chain(async () => ({ data: null, error: null })),
        chain(async () => ({ data: articles, error: null })),
      ],
      stories: [chain(async () => ({ data: story, error: null }))],
      pipeline_stage_events: [chain(async () => ({ data: [], error: null }))],
      pipeline_dead_letter: [chain(async () => ({ data: [], error: null }))],
    })

    const result = await resolveJourneyQuery(client as never, STORY_UUID)
    expect(result.resolved).toBe('story')
    expect(result.story?.id).toBe(STORY_UUID)
    expect(result.articles).toHaveLength(1)
  })

  it('returns none when UUID matches nothing', async () => {
    const client = clientWith({
      articles: [chain(async () => ({ data: null, error: null }))],
      stories: [chain(async () => ({ data: null, error: null }))],
      pipeline_stage_events: [],
      pipeline_dead_letter: [],
    })
    const result = await resolveJourneyQuery(client as never, ARTICLE_UUID)
    expect(result.resolved).toBe('none')
  })

  it('resolves a URL by article lookup (via canonical_url match)', async () => {
    const article = { id: ARTICLE_UUID, story_id: null, url: 'https://e.com/a' }
    // URL lookup now runs two parallel queries (url + canonical_url).
    // First chain returns null, second returns the match.
    const client = clientWith({
      articles: [
        chain(async () => ({ data: null, error: null })),
        chain(async () => ({ data: article, error: null })),
      ],
      stories: [],
      pipeline_stage_events: [chain(async () => ({ data: [], error: null }))],
      pipeline_dead_letter: [chain(async () => ({ data: [], error: null }))],
    })

    const result = await resolveJourneyQuery(client as never, 'https://e.com/a')
    expect(result.resolved).toBe('article')
    expect(result.articles[0].url).toBe('https://e.com/a')
    expect(result.story).toBeNull()
  })

  it('handles URLs with commas safely (no .or() injection)', async () => {
    const url = 'https://e.com/a?utm=foo,bar&x=(1)'
    const client = clientWith({
      articles: [
        chain(async () => ({ data: null, error: null })),
        chain(async () => ({ data: null, error: null })),
      ],
      stories: [],
      pipeline_stage_events: [],
      pipeline_dead_letter: [],
    })

    const result = await resolveJourneyQuery(client as never, url)
    expect(result.resolved).toBe('none')
  })
})
