/**
 * Tests for lib/ai/thin-topic-classifier.ts — deterministic multi-signal
 * topic/region classifier for thin-cluster assembly. Preserves the
 * zero-Gemini property of the deterministic path.
 */

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { Topic } from '@/lib/types'
import {
  classifyFromRssCategories,
  classifyFromPriors,
  classifyThinTopic,
  classifyThinRegion,
  normalizeRssCategory,
  queryTopicPrior,
  createTopicPriorCache,
  type ClassifierArticle,
  type TopicPrior,
  type TopicPriorCache,
} from '@/lib/ai/thin-topic-classifier'

function article(partial: Partial<ClassifierArticle>): ClassifierArticle {
  return {
    title: partial.title ?? '',
    rssCategories: partial.rssCategories ?? null,
    sourceId: partial.sourceId ?? 'source-x',
  }
}

describe('normalizeRssCategory', () => {
  it('maps common tech tags to technology', () => {
    expect(normalizeRssCategory('Technology')).toBe('technology')
    expect(normalizeRssCategory('tech')).toBe('technology')
    expect(normalizeRssCategory('AI')).toBe('technology')
  })

  it('maps politics tags', () => {
    expect(normalizeRssCategory('Politics')).toBe('politics')
    expect(normalizeRssCategory('politics')).toBe('politics')
  })

  it('maps business/markets', () => {
    expect(normalizeRssCategory('Business')).toBe('business')
    expect(normalizeRssCategory('Markets')).toBe('business')
    expect(normalizeRssCategory('Economy')).toBe('business')
  })

  it('maps sports', () => {
    expect(normalizeRssCategory('Sports')).toBe('sports')
  })

  it('maps science / health / culture / environment / world', () => {
    expect(normalizeRssCategory('Science')).toBe('science')
    expect(normalizeRssCategory('Health')).toBe('health')
    expect(normalizeRssCategory('Culture')).toBe('culture')
    expect(normalizeRssCategory('Entertainment')).toBe('culture')
    expect(normalizeRssCategory('Climate')).toBe('environment')
    expect(normalizeRssCategory('World')).toBe('world')
  })

  it('returns null for unknown categories', () => {
    expect(normalizeRssCategory('Opinion')).toBeNull()
    expect(normalizeRssCategory('')).toBeNull()
    expect(normalizeRssCategory('Breaking News')).toBeNull()
  })

  it('is case-insensitive and trims', () => {
    expect(normalizeRssCategory('  TECHNOLOGY  ')).toBe('technology')
  })
})

describe('classifyFromRssCategories', () => {
  it('returns null when no article has rss categories', () => {
    const result = classifyFromRssCategories([article({ title: 'a' })])
    expect(result).toBeNull()
  })

  it('returns the topic when all articles agree via RSS', () => {
    const result = classifyFromRssCategories([
      article({ rssCategories: ['Technology'] }),
      article({ rssCategories: ['Tech', 'AI'] }),
    ])
    expect(result).toBe('technology')
  })

  it('counts votes per article (not per tag) when one article has many tags for the same topic', () => {
    // Article 1 tags: [Technology, AI, Tech] → one vote for technology.
    // Article 2 tags: [Politics] → one vote for politics.
    // Result should be a tie → null (fall through to next signal), not
    // technology dominating because one feed is more verbose.
    const result = classifyFromRssCategories([
      article({ rssCategories: ['Technology', 'AI', 'Tech'] }),
      article({ rssCategories: ['Politics'] }),
    ])
    expect(result).toBeNull()
  })

  it('returns the dominant topic when articles disagree', () => {
    const result = classifyFromRssCategories([
      article({ rssCategories: ['Technology'] }),
      article({ rssCategories: ['Technology'] }),
      article({ rssCategories: ['Politics'] }),
    ])
    expect(result).toBe('technology')
  })

  it('ignores unknown categories', () => {
    const result = classifyFromRssCategories([
      article({ rssCategories: ['Opinion', 'Technology'] }),
      article({ rssCategories: ['Breaking News'] }),
    ])
    expect(result).toBe('technology')
  })

  it('returns null on a tie between unrelated known topics', () => {
    // On a dead tie we don't have evidence for picking either side;
    // fall through to the next signal instead of flipping a coin.
    const result = classifyFromRssCategories([
      article({ rssCategories: ['Politics'] }),
      article({ rssCategories: ['Technology'] }),
    ])
    expect(result).toBeNull()
  })
})

describe('classifyFromPriors', () => {
  it('returns null when no priors are provided', () => {
    expect(classifyFromPriors(new Map())).toBeNull()
  })

  it('returns the source topic when a single source clears thresholds', () => {
    const priors = new Map<string, TopicPrior | null>([
      ['source-a', { topic: 'technology', confidence: 0.7, total: 20 }],
    ])
    expect(classifyFromPriors(priors)).toBe('technology')
  })

  it('ignores priors below confidence threshold (0.4)', () => {
    const priors = new Map<string, TopicPrior | null>([
      ['source-a', { topic: 'technology', confidence: 0.3, total: 50 }],
    ])
    expect(classifyFromPriors(priors)).toBeNull()
  })

  it('ignores priors below sample threshold (10)', () => {
    const priors = new Map<string, TopicPrior | null>([
      ['source-a', { topic: 'technology', confidence: 0.9, total: 5 }],
    ])
    expect(classifyFromPriors(priors)).toBeNull()
  })

  it('sums confidence across sources to pick cluster topic', () => {
    const priors = new Map<string, TopicPrior | null>([
      ['source-a', { topic: 'technology', confidence: 0.5, total: 20 }],
      ['source-b', { topic: 'technology', confidence: 0.6, total: 15 }],
      ['source-c', { topic: 'politics', confidence: 0.8, total: 50 }],
    ])
    // technology: 0.5 + 0.6 = 1.1  vs  politics: 0.8 → technology wins.
    expect(classifyFromPriors(priors)).toBe('technology')
  })

  it('returns null when two topics tie on summed confidence across sources', () => {
    // Two sources with equal-confidence priors on different topics:
    // technology: 0.8  politics: 0.8 — order-dependent pick would be a
    // hidden source of flaky classifications. Fall through instead.
    const priors = new Map<string, TopicPrior | null>([
      ['source-a', { topic: 'technology', confidence: 0.8, total: 20 }],
      ['source-b', { topic: 'politics', confidence: 0.8, total: 20 }],
    ])
    expect(classifyFromPriors(priors)).toBeNull()
  })

  it('skips null priors (source has no history)', () => {
    const priors = new Map<string, TopicPrior | null>([
      ['source-a', null],
      ['source-b', { topic: 'science', confidence: 0.6, total: 20 }],
    ])
    expect(classifyFromPriors(priors)).toBe('science')
  })
})

describe('queryTopicPrior', () => {
  function mockClient(rows: Array<{ source_id: string; topic: Topic | null }>) {
    const calls: string[][] = []
    const eqCalls: Array<[string, string]> = []
    const from = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockImplementation((_col: string, ids: string[]) => {
        calls.push(ids)
        return {
          gt: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              eqCalls.push([col, val])
              return Promise.resolve({
                data: rows.filter((r) => ids.includes(r.source_id)),
                error: null,
              })
            }),
          }),
        }
      }),
    }))
    return {
      client: { from } as unknown as SupabaseClient<Database>,
      calls,
      eqCalls,
    }
  }

  it('returns an empty map for an empty sourceIds list', async () => {
    const { client } = mockClient([])
    const result = await queryTopicPrior(client, [], new Date())
    expect(result.size).toBe(0)
  })

  it('aggregates topic counts per source', async () => {
    // 15 tech rows + 5 politics rows for source-a → topic='technology',
    // confidence = 15/20 = 0.75, total = 20.
    const rows = [
      ...Array.from({ length: 15 }, () => ({ source_id: 'source-a', topic: 'technology' as Topic })),
      ...Array.from({ length: 5 }, () => ({ source_id: 'source-a', topic: 'politics' as Topic })),
    ]
    const { client } = mockClient(rows)
    const result = await queryTopicPrior(client, ['source-a'], new Date())
    const prior = result.get('source-a')
    expect(prior).not.toBeNull()
    expect(prior?.topic).toBe('technology')
    expect(prior?.total).toBe(20)
    expect(prior?.confidence).toBeCloseTo(0.75, 2)
  })

  it('returns null for sources with no rows', async () => {
    const { client } = mockClient([])
    const result = await queryTopicPrior(client, ['source-unknown'], new Date())
    expect(result.get('source-unknown')).toBeNull()
  })

  it('returns null when a source is tied between two topics', async () => {
    // An even split (e.g. 10 technology + 10 politics) should be
    // inconclusive — otherwise the winner depends on DB row order, and a
    // 0.5 confidence still clears MIN_PRIOR_CONFIDENCE=0.4.
    const rows = [
      ...Array.from({ length: 10 }, () => ({ source_id: 'source-a', topic: 'technology' as Topic })),
      ...Array.from({ length: 10 }, () => ({ source_id: 'source-a', topic: 'politics' as Topic })),
    ]
    const { client } = mockClient(rows)
    const result = await queryTopicPrior(client, ['source-a'], new Date())

    expect(result.get('source-a')).toBeNull()
  })

  it('restricts the query to completed-assembly stories', async () => {
    // Clustering seeds pending stories with topic='politics' as a placeholder
    // (lib/ai/clustering.ts:1142, :1356). Counting those rows would pollute
    // the prior toward 'politics' for any source with a pending backlog.
    // queryTopicPrior must filter to stories.assembly_status='completed'.
    const { client, eqCalls } = mockClient([])
    await queryTopicPrior(client, ['source-a'], new Date())

    expect(eqCalls).toContainEqual(['stories.assembly_status', 'completed'])
  })
})

describe('classifyThinTopic — prior cache', () => {
  it('uses a shared cache to avoid duplicate DB queries for the same source across stories', async () => {
    // Simulate a thin-heavy batch: 3 stories all from source-a. Without
    // caching, queryTopicPrior fires 3 times per batch. With a shared
    // cache passed in, the DB should be hit at most once.
    let dbCalls = 0
    const fakeClient = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockImplementation(() => ({
          gt: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              dbCalls += 1
              return Promise.resolve({
                data: Array.from({ length: 15 }, () => ({
                  source_id: 'source-a',
                  topic: 'science' as Topic,
                })),
                error: null,
              })
            }),
          }),
        })),
      })),
    } as unknown as SupabaseClient<Database>

    const priorCache: TopicPriorCache = createTopicPriorCache()
    const articlesA = [article({ title: 'x', sourceId: 'source-a' })]

    const [r1, r2, r3] = await Promise.all([
      classifyThinTopic(articlesA, fakeClient, priorCache),
      classifyThinTopic(articlesA, fakeClient, priorCache),
      classifyThinTopic(articlesA, fakeClient, priorCache),
    ])

    expect(r1).toBe('science')
    expect(r2).toBe('science')
    expect(r3).toBe('science')
    // First call populates the cache; subsequent calls hit the cache only.
    expect(dbCalls).toBe(1)
  })
})

describe('classifyThinTopic — signal ladder', () => {
  it('prefers RSS category over priors/keywords', async () => {
    const articles = [
      article({ title: 'election update', rssCategories: ['Technology'] }),
    ]
    const result = await classifyThinTopic(articles, null)
    expect(result).toBe('technology')
  })

  it('falls through to priors when RSS is absent', async () => {
    const articles = [
      article({ title: 'story without keywords', sourceId: 'src-1' }),
    ]
    const fakeClient = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockImplementation(() => ({
          gt: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: Array.from({ length: 15 }, () => ({
                source_id: 'src-1',
                topic: 'science' as Topic,
              })),
              error: null,
            }),
          }),
        })),
      })),
    } as unknown as SupabaseClient<Database>

    const result = await classifyThinTopic(articles, fakeClient)
    expect(result).toBe('science')
  })

  it('falls through to keyword fallback when RSS and priors are absent', async () => {
    const articles = [
      article({ title: 'New NBA playoff bracket finalized', sourceId: 's' }),
    ]
    const result = await classifyThinTopic(articles, null)
    expect(result).toBe('sports')
  })

  it('defaults to politics when every signal is silent', async () => {
    const articles = [article({ title: 'opaque headline xyzzy', sourceId: 's' })]
    const result = await classifyThinTopic(articles, null)
    expect(result).toBe('politics')
  })
})

describe('classifyThinRegion', () => {
  it('prefers RSS region category when present', () => {
    expect(
      classifyThinRegion([article({ rssCategories: ['UK'], title: 'x' })])
    ).toBe('uk')
  })

  it('falls back to keyword classifier when RSS is silent', () => {
    expect(
      classifyThinRegion([
        article({ title: 'Parliament debates Westminster bill' }),
      ])
    ).toBe('uk')
  })

  it('defaults to us when nothing matches', () => {
    expect(classifyThinRegion([article({ title: 'plain headline' })])).toBe('us')
  })
})
