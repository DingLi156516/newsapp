import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import {
  queryStories,
  queryStoryById,
  querySourcesForStory,
  querySources,
  queryArticlesWithSourcesForStory,
  querySourceBySlug,
  queryRecentStoriesForSource,
  queryTagBySlug,
  queryTags,
  queryTagsForStory,
  queryRelatedTags,
  queryHeadlinesForStory,
} from '@/lib/api/query-helpers'

function createMockQueryBuilder(data: unknown = [], count: number = 0, error: null | { message: string; code?: string } = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    returns: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: (value: unknown) => void) => {
      resolve({ data, count, error })
      return Promise.resolve({ data, count, error })
    }),
  }
  // Make it thenable (awaitable)
  Object.defineProperty(builder, Symbol.toStringTag, { value: 'Promise' })
  return builder
}

function createMockClient(queryBuilder: ReturnType<typeof createMockQueryBuilder>) {
  return {
    from: vi.fn().mockReturnValue(queryBuilder),
  } as unknown as SupabaseClient<Database>
}

const mockStory = {
  id: 'story-1',
  headline: 'Test Story',
  topic: 'politics',
  region: 'us',
  source_count: 3,
  is_blindspot: false,
  image_url: null,
  factuality: 'high',
  ownership: 'corporate',
  spectrum_segments: [],
  ai_summary: {},
  published_at: '2024-01-01T00:00:00Z',
  first_published: '2024-01-01T00:00:00Z',
  last_updated: '2024-01-01T00:00:00Z',
  story_velocity: null,
  impact_score: null,
  source_diversity: null,
  controversy_score: null,
  trending_score: null,
  sentiment: null,
  key_quotes: null,
  key_claims: null,
}

describe('queryStories', () => {
  it('returns stories with count', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    const result = await queryStories(client, {
      page: 1,
      limit: 20,
    })

    expect(result.data).toHaveLength(1)
    expect(result.count).toBe(1)
    expect(builder.eq).toHaveBeenCalledWith('publication_status', 'published')
  })

  it('throws on query error', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'DB error' })
    const client = createMockClient(builder)

    await expect(
      queryStories(client, { page: 1, limit: 20 })
    ).rejects.toThrow('Failed to query stories')
  })

  it('applies topic filter', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    await queryStories(client, {
      topic: 'technology',
      page: 1,
      limit: 20,
    })

    expect(builder.eq).toHaveBeenCalledWith('topic', 'technology')
  })

  it('applies blindspot filter', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    await queryStories(client, {
      blindspot: 'true',
      page: 1,
      limit: 20,
    })

    expect(builder.eq).toHaveBeenCalledWith('is_blindspot', true)
  })

  it('applies search filter using textSearch', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    await queryStories(client, {
      search: 'AI regulation',
      page: 1,
      limit: 20,
    })

    expect(builder.textSearch).toHaveBeenCalledWith('search_vector', 'AI regulation', { type: 'websearch' })
    expect(builder.ilike).not.toHaveBeenCalled()
  })

  it('applies minFactuality filter', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    await queryStories(client, {
      minFactuality: 'high',
      page: 1,
      limit: 20,
    })

    expect(builder.in).toHaveBeenCalledWith('factuality', ['high', 'very-high'])
  })

  it('applies datePreset filter', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    await queryStories(client, {
      datePreset: '7d',
      page: 1,
      limit: 20,
    })

    expect(builder.gte).toHaveBeenCalledWith('first_published', expect.any(String))
  })

  it('does not apply datePreset filter for "all"', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    await queryStories(client, {
      datePreset: 'all',
      page: 1,
      limit: 20,
    })

    expect(builder.gte).not.toHaveBeenCalled()
  })

  it('applies biasRange filter client-side', async () => {
    const leftStory = {
      ...mockStory,
      id: 'story-left',
      spectrum_segments: [
        { bias: 'left', percentage: 60 },
        { bias: 'center', percentage: 40 },
      ],
    }
    const rightStory = {
      ...mockStory,
      id: 'story-right',
      spectrum_segments: [
        { bias: 'right', percentage: 70 },
        { bias: 'far-right', percentage: 30 },
      ],
    }
    const builder = createMockQueryBuilder([leftStory, rightStory], 2)
    const client = createMockClient(builder)

    const result = await queryStories(client, {
      biasRange: 'left,center',
      page: 1,
      limit: 20,
    })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('story-left')
  })

  it('does not filter biasRange when all 7 biases selected', async () => {
    const builder = createMockQueryBuilder([mockStory], 1)
    const client = createMockClient(builder)

    const result = await queryStories(client, {
      biasRange: 'far-left,left,lean-left,center,lean-right,right,far-right',
      page: 1,
      limit: 20,
    })

    expect(result.data).toHaveLength(1)
  })

  it('aggregates all tag IDs when slug has multiple types', async () => {
    const tagsBuilder = createMockQueryBuilder([
      { id: 'tag-person' },
      { id: 'tag-location' },
    ])
    const storiesBuilder = createMockQueryBuilder([mockStory], 1)
    const client = {
      from: vi.fn()
        .mockReturnValueOnce(tagsBuilder)
        .mockReturnValueOnce(storiesBuilder),
    } as unknown as SupabaseClient<Database>

    await queryStories(client, { tag: 'jordan', page: 1, limit: 20 })

    expect(storiesBuilder.in).toHaveBeenCalledWith('story_tags.tag_id', ['tag-person', 'tag-location'])
  })

  it('uses exact lookup when tag_type provided', async () => {
    const tagsBuilder = createMockQueryBuilder([{ id: 'tag-person' }])
    const storiesBuilder = createMockQueryBuilder([mockStory], 1)
    const client = {
      from: vi.fn()
        .mockReturnValueOnce(tagsBuilder)
        .mockReturnValueOnce(storiesBuilder),
    } as unknown as SupabaseClient<Database>

    await queryStories(client, { tag: 'jordan', tag_type: 'person', page: 1, limit: 20 })

    expect(tagsBuilder.eq).toHaveBeenCalledWith('tag_type', 'person')
    expect(storiesBuilder.eq).toHaveBeenCalledWith('story_tags.tag_id', 'tag-person')
  })

  it('returns empty when tag slug not found', async () => {
    const tagsBuilder = createMockQueryBuilder([])
    const client = {
      from: vi.fn().mockReturnValueOnce(tagsBuilder),
    } as unknown as SupabaseClient<Database>

    const result = await queryStories(client, { tag: 'nonexistent', page: 1, limit: 20 })

    expect(result).toEqual({ data: [], count: 0 })
  })

  describe('sort=trending', () => {
    it('orders by the materialized trending_score column in SQL', async () => {
      const builder = createMockQueryBuilder([mockStory], 1)
      const client = createMockClient(builder)

      await queryStories(client, { sort: 'trending', page: 1, limit: 20 })

      // Primary sort column is the pre-computed score; DB handles it so the
      // read path stays bounded to `limit` rows, not the full 7-day window.
      expect(builder.order).toHaveBeenCalledWith(
        'trending_score',
        expect.objectContaining({ ascending: false, nullsFirst: false })
      )
    })

    it('restricts the candidate window to the last 7 days', async () => {
      const builder = createMockQueryBuilder([mockStory], 1)
      const client = createMockClient(builder)

      await queryStories(client, { sort: 'trending', page: 1, limit: 20 })

      // Older stories can't resurface even if their stored score is high.
      expect(builder.gte).toHaveBeenCalledWith('published_at', expect.any(String))
    })

    it('does NOT filter null trending_score so freshly-assembled stories stay visible (codex finding)', async () => {
      const builder = createMockQueryBuilder([mockStory], 1)
      const client = createMockClient(builder)

      await queryStories(client, { sort: 'trending', page: 1, limit: 20 })

      // Stories are scored by the refresh cron (≤15-min cadence), not at
      // assembly. A new breaking story must surface in Trending immediately
      // (NULL score sorts to bottom via NULLS LAST), not wait for the next
      // cron tick. The partial index covers `publication_status='published'`
      // without a `trending_score IS NOT NULL` clause to support this.
      expect(builder.not).not.toHaveBeenCalledWith('trending_score', 'is', null)
      expect(builder.order).toHaveBeenCalledWith(
        'trending_score',
        expect.objectContaining({ ascending: false, nullsFirst: false })
      )
    })

    it('applies biasRange in SQL before pagination (codex finding)', async () => {
      const builder = createMockQueryBuilder([mockStory], 1)
      const client = createMockClient(builder)

      await queryStories(client, {
        sort: 'trending',
        biasRange: 'far-left,left',
        page: 1,
        limit: 20,
      })

      // JSONB contains OR'd across selected biases — the bias filter must
      // run before `.range()` so pagination over the filtered set doesn't
      // return empty pages while matching stories sit further down.
      expect(builder.or).toHaveBeenCalledWith(
        'spectrum_segments.cs.[{"bias":"far-left"}],spectrum_segments.cs.[{"bias":"left"}]'
      )
    })

    it('does not apply biasRange OR filter when all 7 biases selected', async () => {
      const builder = createMockQueryBuilder([mockStory], 1)
      const client = createMockClient(builder)

      await queryStories(client, {
        sort: 'trending',
        biasRange: 'far-left,left,lean-left,center,lean-right,right,far-right',
        page: 1,
        limit: 20,
      })

      // All-7 selection is a no-op; avoid filing an unnecessary OR clause.
      expect(builder.or).not.toHaveBeenCalled()
    })

    it('uses normal SQL pagination (range), not in-memory slicing', async () => {
      const builder = createMockQueryBuilder([mockStory], 1)
      const client = createMockClient(builder)

      await queryStories(client, { sort: 'trending', page: 2, limit: 20 })

      // page=2, limit=20 → offset 20, end 39
      expect(builder.range).toHaveBeenCalledWith(20, 39)
    })

    it('returns the trending_score DB count as meta.total', async () => {
      const rows = [
        { ...mockStory, id: 'a', trending_score: 90 },
        { ...mockStory, id: 'b', trending_score: 10 },
      ]
      const builder = createMockQueryBuilder(rows, 2)
      const client = createMockClient(builder)

      const result = await queryStories(client, { sort: 'trending', page: 1, limit: 20 })

      // The count comes from the indexed Supabase query — not a capped fetch —
      // so infinite scroll sees the real total of matching stories.
      expect(result.count).toBe(2)
      expect(result.data.map((s) => s.id)).toEqual(['a', 'b'])
    })

    it('secondary-sorts by trending_score when multiple rows arrive out of order', async () => {
      // The mock builder doesn't honor .order(), so we verify the in-memory
      // tie-break sorts by trending_score DESC when sort=trending.
      const rows = [
        { ...mockStory, id: 'low', trending_score: 5 },
        { ...mockStory, id: 'high', trending_score: 95 },
        { ...mockStory, id: 'mid', trending_score: 50 },
      ]
      const builder = createMockQueryBuilder(rows, 3)
      const client = createMockClient(builder)

      const result = await queryStories(client, { sort: 'trending', page: 1, limit: 20 })

      expect(result.data.map((s) => s.id)).toEqual(['high', 'mid', 'low'])
    })
  })
})

describe('queryStoryById', () => {
  it('returns story when found', async () => {
    const builder = createMockQueryBuilder(mockStory, 0)
    const client = createMockClient(builder)

    const result = await queryStoryById(client, 'story-1')
    expect(result).toEqual(mockStory)
  })

  it('returns null for not found', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'Not found', code: 'PGRST116' })
    const client = createMockClient(builder)

    const result = await queryStoryById(client, 'nonexistent')
    expect(result).toBeNull()
  })

  it('throws on other errors', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'DB crash' })
    const client = createMockClient(builder)

    await expect(queryStoryById(client, 'story-1')).rejects.toThrow('Failed to fetch story')
  })
})

describe('querySourcesForStory', () => {
  it('returns empty sources and map when no articles', async () => {
    const builder = createMockQueryBuilder([], 0)
    const client = createMockClient(builder)

    const result = await querySourcesForStory(client, 'story-1')
    expect(result.sources).toEqual([])
    expect(result.articleUrlMap.size).toBe(0)
  })

  it('throws on article fetch error', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'Article error' })
    const client = createMockClient(builder)

    await expect(querySourcesForStory(client, 'story-1')).rejects.toThrow('Failed to fetch articles')
  })

  it('returns sources + ownershipUnavailable=true when media_owners lookup fails (no throw)', async () => {
    // Story data must still flow through on media_owners failure — owner
    // enrichment is optional. The explicit flag lets the UI + monitoring
    // distinguish "no linked owners" from "ownership lookup broke".
    const articlesBuilder = createMockQueryBuilder(
      [{ source_id: 'src-1', url: 'https://example.com/a' }],
      0
    )
    const sourcesBuilder = createMockQueryBuilder(
      [{ id: 'src-1', name: 'CNN', bias: 'lean-left', owner_id: 'owner-1' }],
      0
    )
    const ownersBuilder = createMockQueryBuilder(null, 0, {
      message: 'media_owners RLS denied',
    })
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce(articlesBuilder)
        .mockReturnValueOnce(sourcesBuilder)
        .mockReturnValueOnce(ownersBuilder),
    } as unknown as SupabaseClient<Database>

    const result = await querySourcesForStory(client, 'story-1')
    expect(result.sources).toHaveLength(1)
    expect(result.ownerMap.size).toBe(0)
    expect(result.ownershipUnavailable).toBe(true)
  })

  it('flags ownershipUnavailable=true when media_owners returns fewer rows than requested (silent RLS miss)', async () => {
    // Source claims owner_id='owner-1' but media_owners returns zero rows
    // without an explicit error — classic RLS/policy regression. Must still
    // degrade, not silently report "unknown owner".
    const articlesBuilder = createMockQueryBuilder(
      [{ source_id: 'src-1', url: 'https://example.com/a' }],
      0
    )
    const sourcesBuilder = createMockQueryBuilder(
      [{ id: 'src-1', name: 'CNN', bias: 'lean-left', owner_id: 'owner-1' }],
      0
    )
    const ownersBuilder = createMockQueryBuilder([], 0)
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce(articlesBuilder)
        .mockReturnValueOnce(sourcesBuilder)
        .mockReturnValueOnce(ownersBuilder),
    } as unknown as SupabaseClient<Database>

    const result = await querySourcesForStory(client, 'story-1')
    expect(result.ownershipUnavailable).toBe(true)
    expect(result.ownerMap.size).toBe(0)
  })

  it('returns ownershipUnavailable=false on the happy path', async () => {
    const articlesBuilder = createMockQueryBuilder(
      [{ source_id: 'src-1', url: 'https://example.com/a' }],
      0
    )
    const sourcesBuilder = createMockQueryBuilder(
      [{ id: 'src-1', name: 'CNN', bias: 'lean-left', owner_id: 'owner-1' }],
      0
    )
    const ownersBuilder = createMockQueryBuilder(
      [{ id: 'owner-1', name: 'Warner', slug: 'warner', owner_type: 'public_company', is_individual: false, country: 'US', wikidata_qid: 'Q1', owner_source: 'manual', owner_verified_at: '2026-01-01' }],
      0
    )
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce(articlesBuilder)
        .mockReturnValueOnce(sourcesBuilder)
        .mockReturnValueOnce(ownersBuilder),
    } as unknown as SupabaseClient<Database>

    const result = await querySourcesForStory(client, 'story-1')
    expect(result.ownershipUnavailable).toBe(false)
    expect(result.ownerMap.get('owner-1')?.name).toBe('Warner')
  })
})

describe('querySources', () => {
  it('returns sources with count', async () => {
    const source = { id: 'src-1', name: 'Test', bias: 'center' }
    const builder = createMockQueryBuilder([source], 1)
    const client = createMockClient(builder)

    const result = await querySources(client, { page: 1, limit: 50 })
    expect(result.data).toHaveLength(1)
    expect(result.count).toBe(1)
  })

  it('applies bias filter', async () => {
    const builder = createMockQueryBuilder([], 0)
    const client = createMockClient(builder)

    await querySources(client, { bias: 'left', page: 1, limit: 50 })
    expect(builder.eq).toHaveBeenCalledWith('bias', 'left')
  })

  it('requests joined owner data via PostgREST relational select', async () => {
    const builder = createMockQueryBuilder([], 0)
    const client = createMockClient(builder)

    await querySources(client, { page: 1, limit: 50 })
    const selectArg = builder.select.mock.calls[0][0] as string
    expect(selectArg).toContain('owner:media_owners(')
    expect(selectArg).toContain('owner_type')
  })

  it('retries without owner embed and flags ownershipUnavailable when media_owners join fails', async () => {
    // First call (with owner embed) errors; second call (source-only) succeeds.
    // The source directory must still flow; only the flag surfaces the degradation.
    const failingBuilder = createMockQueryBuilder(null, 0, {
      message: 'relation media_owners does not exist',
    })
    const fallbackBuilder = createMockQueryBuilder(
      [{ id: 'src-1', name: 'CNN', bias: 'lean-left' }],
      1
    )
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce(failingBuilder)
        .mockReturnValueOnce(fallbackBuilder),
    } as unknown as SupabaseClient<Database>

    const result = await querySources(client, { page: 1, limit: 50 })
    expect(result.data).toHaveLength(1)
    expect(result.ownershipUnavailable).toBe(true)
    // Second select should NOT include the owner relation
    const fallbackSelect = fallbackBuilder.select.mock.calls[0][0] as string
    expect(fallbackSelect).not.toContain('owner:media_owners')
  })

  it('falls back to pre-migration schema (no owner_id) if both owner selects fail', async () => {
    // Simulates an app deployed before migration 048 ran: both the owner
    // embed and the owner_id column don't exist. Route must still return
    // sources with ownershipUnavailable=true instead of 500'ing.
    const embedFail = createMockQueryBuilder(null, 0, {
      message: 'relation media_owners does not exist',
    })
    const fkFail = createMockQueryBuilder(null, 0, {
      message: 'column sources.owner_id does not exist',
    })
    const bareOk = createMockQueryBuilder(
      [{ id: 'src-1', name: 'CNN', bias: 'lean-left' }],
      1
    )
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce(embedFail)
        .mockReturnValueOnce(fkFail)
        .mockReturnValueOnce(bareOk),
    } as unknown as SupabaseClient<Database>

    const result = await querySources(client, { page: 1, limit: 50 })
    expect(result.data).toHaveLength(1)
    expect(result.ownershipUnavailable).toBe(true)
    const thirdSelect = bareOk.select.mock.calls[0][0] as string
    expect(thirdSelect).not.toContain('owner_id')
    expect(thirdSelect).not.toContain('media_owners')
  })

  it('flags ownershipUnavailable=true when embed returns owner_id populated but owner=null (silent RLS miss)', async () => {
    // PostgREST returns source rows with owner_id + owner: null without
    // raising an error when RLS filters the joined row. Must degrade, not
    // silently report "unaffiliated".
    const rows = [
      { id: 'src-1', name: 'CNN', bias: 'lean-left', owner_id: 'owner-1', owner: null },
      { id: 'src-2', name: 'Indie', bias: 'center', owner_id: null, owner: null },
    ]
    const builder = createMockQueryBuilder(rows, 2)
    const client = createMockClient(builder)

    const result = await querySources(client, { page: 1, limit: 50 })
    expect(result.data).toHaveLength(2)
    expect(result.ownershipUnavailable).toBe(true)
  })

  it('keeps ownershipUnavailable=false when every owner_id has a resolved owner embed', async () => {
    const rows = [
      {
        id: 'src-1',
        name: 'CNN',
        bias: 'lean-left',
        owner_id: 'owner-1',
        owner: {
          id: 'owner-1',
          name: 'Warner',
          slug: 'warner',
          owner_type: 'public_company',
          is_individual: false,
          country: 'US',
          wikidata_qid: 'Q1',
          owner_source: 'manual',
          owner_verified_at: '2026-01-01',
        },
      },
      { id: 'src-2', name: 'Indie', bias: 'center', owner_id: null, owner: null },
    ]
    const builder = createMockQueryBuilder(rows, 2)
    const client = createMockClient(builder)

    const result = await querySources(client, { page: 1, limit: 50 })
    expect(result.ownershipUnavailable).toBe(false)
  })

  it('returns hydrated owner on rows where the join resolves', async () => {
    const row = {
      id: 'src-1',
      name: 'CNN',
      bias: 'lean-left',
      owner: {
        id: 'warner',
        name: 'Warner Bros. Discovery',
        slug: 'warner-bros-discovery',
        owner_type: 'public_company',
        is_individual: false,
        country: 'US',
        wikidata_qid: 'Q3570967',
        owner_source: 'manual',
        owner_verified_at: '2026-01-01T00:00:00Z',
      },
    }
    const builder = createMockQueryBuilder([row], 1)
    const client = createMockClient(builder)

    const result = await querySources(client, { page: 1, limit: 50 })
    expect(result.data[0].owner?.name).toBe('Warner Bros. Discovery')
  })

  it('returns null owner when the source is unlinked', async () => {
    const row = {
      id: 'src-2',
      name: 'Indie News',
      bias: 'center',
      owner: null,
    }
    const builder = createMockQueryBuilder([row], 1)
    const client = createMockClient(builder)

    const result = await querySources(client, { page: 1, limit: 50 })
    expect(result.data[0].owner).toBeNull()
  })

  it('throws on error', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'Source error' })
    const client = createMockClient(builder)

    await expect(
      querySources(client, { page: 1, limit: 50 })
    ).rejects.toThrow('Failed to query sources')
  })
})

describe('querySourceBySlug', () => {
  it('returns source when found', async () => {
    const source = { id: 'src-1', slug: 'reuters', name: 'Reuters' }
    const builder = createMockQueryBuilder(source, 0)
    const client = createMockClient(builder)

    const result = await querySourceBySlug(client, 'reuters')
    expect(result).toEqual(source)
    expect(builder.eq).toHaveBeenCalledWith('slug', 'reuters')
  })

  it('returns null when source is not found', async () => {
    const singleBuilder = createMockQueryBuilder(null, 0, { message: 'Not found', code: 'PGRST116' })
    const listBuilder = createMockQueryBuilder([], 0)
    const client = {
      from: vi.fn()
        .mockReturnValueOnce(singleBuilder)
        .mockReturnValueOnce(listBuilder),
    } as unknown as SupabaseClient<Database>

    const result = await querySourceBySlug(client, 'missing-source')
    expect(result).toBeNull()
  })

  it('falls back to a derived slug when older source rows do not have one persisted', async () => {
    const singleBuilder = createMockQueryBuilder(null, 0, { message: 'Not found', code: 'PGRST116' })
    const listBuilder = createMockQueryBuilder([
      {
        id: 'src-1',
        slug: '',
        name: 'ABC News',
        bias: 'lean-left',
        factuality: 'high',
        ownership: 'corporate',
        url: 'abcnews.go.com',
        rss_url: null,
        region: 'us',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ])

    const client = {
      from: vi.fn()
        .mockReturnValueOnce(singleBuilder)
        .mockReturnValueOnce(listBuilder),
    } as unknown as SupabaseClient<Database>

    const result = await querySourceBySlug(client, 'abc-news')
    expect(result).toMatchObject({ id: 'src-1', name: 'ABC News' })
  })
})

describe('queryRecentStoriesForSource', () => {
  it('deduplicates stories and keeps the newest article per story', async () => {
    const builder = createMockQueryBuilder([
      {
        url: 'https://reuters.com/story-1-new',
        published_at: '2026-03-03T10:00:00Z',
        stories: {
          id: 'story-1',
          headline: 'Top Story',
          topic: 'politics',
          region: 'us',
          is_blindspot: false,
          first_published: '2026-03-02T10:00:00Z',
          last_updated: '2026-03-03T10:30:00Z',
        },
      },
      {
        url: 'https://reuters.com/story-1-old',
        published_at: '2026-03-02T10:00:00Z',
        stories: {
          id: 'story-1',
          headline: 'Top Story',
          topic: 'politics',
          region: 'us',
          is_blindspot: false,
          first_published: '2026-03-02T10:00:00Z',
          last_updated: '2026-03-03T10:30:00Z',
        },
      },
      {
        url: 'https://reuters.com/story-2',
        published_at: '2026-03-01T09:00:00Z',
        stories: {
          id: 'story-2',
          headline: 'Blindspot Story',
          topic: 'world',
          region: 'international',
          is_blindspot: true,
          first_published: '2026-03-01T09:00:00Z',
          last_updated: '2026-03-01T09:15:00Z',
        },
      },
    ])
    const client = createMockClient(builder)

    const result = await queryRecentStoriesForSource(client, 'src-1', '2026-02-20T00:00:00Z')

    expect(builder.eq).toHaveBeenCalledWith('source_id', 'src-1')
    expect(builder.gte).toHaveBeenCalledWith('published_at', '2026-02-20T00:00:00Z')
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      id: 'story-1',
      articleUrl: 'https://reuters.com/story-1-new',
    })
    expect(result[1]).toMatchObject({
      id: 'story-2',
      isBlindspot: true,
    })
  })
})

describe('queryArticlesWithSourcesForStory', () => {
  it('returns empty array when no articles', async () => {
    const builder = createMockQueryBuilder([])
    const client = createMockClient(builder)

    const result = await queryArticlesWithSourcesForStory(client, 'story-1')
    expect(result).toEqual([])
  })

  it('returns flattened article-source records', async () => {
    const mockArticles = [
      {
        id: 'art-1',
        title: 'Test Article',
        published_at: '2026-03-01T10:00:00Z',
        source_id: 'src-1',
        sources: { name: 'Reuters', bias: 'center', factuality: 'very-high' },
      },
    ]
    const builder = createMockQueryBuilder(mockArticles)
    const client = createMockClient(builder)

    const result = await queryArticlesWithSourcesForStory(client, 'story-1')
    expect(result).toHaveLength(1)
    expect(result[0].source_name).toBe('Reuters')
    expect(result[0].source_bias).toBe('center')
  })

  it('filters out articles with null sources', async () => {
    const mockArticles = [
      {
        id: 'art-1',
        title: 'Good Article',
        published_at: '2026-03-01T10:00:00Z',
        source_id: 'src-1',
        sources: { name: 'Reuters', bias: 'center', factuality: 'very-high' },
      },
      {
        id: 'art-2',
        title: 'Bad Article',
        published_at: '2026-03-01T11:00:00Z',
        source_id: 'src-2',
        sources: null,
      },
    ]
    const builder = createMockQueryBuilder(mockArticles)
    const client = createMockClient(builder)

    const result = await queryArticlesWithSourcesForStory(client, 'story-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('art-1')
  })

  it('throws on query error', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'DB error' })
    const client = createMockClient(builder)

    await expect(
      queryArticlesWithSourcesForStory(client, 'story-1')
    ).rejects.toThrow('Failed to fetch articles for timeline')
  })
})

describe('queryTagBySlug', () => {
  const mockTag = {
    id: 't1',
    slug: 'jordan',
    label: 'Jordan',
    description: null,
    tag_type: 'person',
    story_count: 50,
    created_at: '2026-01-01T00:00:00Z',
  }

  it('returns single-element array for single type', async () => {
    const builder = createMockQueryBuilder([mockTag])
    const client = createMockClient(builder)

    const result = await queryTagBySlug(client, 'jordan')

    expect(result).toEqual([mockTag])
    expect(builder.eq).toHaveBeenCalledWith('slug', 'jordan')
    expect(builder.order).toHaveBeenCalledWith('story_count', { ascending: false })
  })

  it('returns multiple rows when slug has multiple types', async () => {
    const locationTag = { ...mockTag, id: 't2', tag_type: 'location', story_count: 30 }
    const builder = createMockQueryBuilder([mockTag, locationTag])
    const client = createMockClient(builder)

    const result = await queryTagBySlug(client, 'jordan')

    expect(result).toEqual([mockTag, locationTag])
  })

  it('returns single exact match when tagType provided', async () => {
    const builder = createMockQueryBuilder([mockTag])
    const client = createMockClient(builder)

    const result = await queryTagBySlug(client, 'jordan', 'person')

    expect(result).toEqual([mockTag])
    expect(builder.eq).toHaveBeenCalledWith('tag_type', 'person')
    expect(builder.limit).toHaveBeenCalledWith(1)
  })

  it('returns empty array when not found', async () => {
    const builder = createMockQueryBuilder([])
    const client = createMockClient(builder)

    const result = await queryTagBySlug(client, 'nonexistent')

    expect(result).toEqual([])
  })
})

describe('queryTags', () => {
  const mockTag = {
    id: 't1',
    slug: 'iran',
    label: 'Iran',
    description: null,
    tag_type: 'location',
    story_count: 100,
    created_at: '2026-01-01T00:00:00Z',
  }

  it('returns tags with count', async () => {
    const builder = createMockQueryBuilder([mockTag], 1)
    const client = createMockClient(builder)

    const result = await queryTags(client, { page: 1, limit: 20 })

    expect(result.data).toHaveLength(1)
    expect(result.count).toBe(1)
  })

  it('applies type filter', async () => {
    const builder = createMockQueryBuilder([mockTag], 1)
    const client = createMockClient(builder)

    await queryTags(client, { type: 'location', page: 1, limit: 20 })

    expect(builder.eq).toHaveBeenCalledWith('tag_type', 'location')
  })

  it('applies search filter', async () => {
    const builder = createMockQueryBuilder([mockTag], 1)
    const client = createMockClient(builder)

    await queryTags(client, { search: 'iran', page: 1, limit: 20 })

    expect(builder.ilike).toHaveBeenCalledWith('label', '%iran%')
  })

  it('applies pagination', async () => {
    const builder = createMockQueryBuilder([], 0)
    const client = createMockClient(builder)

    await queryTags(client, { page: 3, limit: 10 })

    expect(builder.range).toHaveBeenCalledWith(20, 29)
  })

  it('throws on query error', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'DB error' })
    const client = createMockClient(builder)

    await expect(queryTags(client, { page: 1, limit: 20 })).rejects.toThrow('Failed to query tags')
  })
})

describe('queryTagsForStory', () => {
  it('returns empty array when no tags', async () => {
    const builder = createMockQueryBuilder([], 0)
    const client = createMockClient(builder)

    const result = await queryTagsForStory(client, 'story-1')

    expect(result).toEqual([])
  })

  it('returns tags with relevance', async () => {
    const builder = createMockQueryBuilder([
      {
        relevance: 0.95,
        tags: {
          id: 't1',
          slug: 'iran',
          label: 'Iran',
          description: null,
          tag_type: 'location',
          story_count: 50,
          created_at: '2026-01-01T00:00:00Z',
        },
      },
    ])
    const client = createMockClient(builder)

    const result = await queryTagsForStory(client, 'story-1')

    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('iran')
    expect((result[0] as typeof result[number] & { relevance: number }).relevance).toBe(0.95)
  })

  it('filters out rows with null tags', async () => {
    const builder = createMockQueryBuilder([
      { relevance: 0.9, tags: { id: 't1', slug: 'iran', label: 'Iran', description: null, tag_type: 'location', story_count: 50, created_at: '2026-01-01T00:00:00Z' } },
      { relevance: 0.5, tags: null },
    ])
    const client = createMockClient(builder)

    const result = await queryTagsForStory(client, 'story-1')

    expect(result).toHaveLength(1)
  })

  it('throws on query error', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'DB error' })
    const client = createMockClient(builder)

    await expect(queryTagsForStory(client, 'story-1')).rejects.toThrow('Failed to fetch tags for story')
  })
})

describe('queryHeadlinesForStory', () => {
  it('returns headlines sorted by bias spectrum', async () => {
    const mockHeadlines = [
      { title: 'Right Headline', sources: { name: 'Fox News', bias: 'right' } },
      { title: 'Left Headline', sources: { name: 'CNN', bias: 'lean-left' } },
      { title: 'Center Headline', sources: { name: 'Reuters', bias: 'center' } },
    ]
    const builder = createMockQueryBuilder(mockHeadlines)
    const client = createMockClient(builder)

    const result = await queryHeadlinesForStory(client, 'story-1')

    expect(result).toHaveLength(3)
    // Should be sorted: lean-left, center, right
    expect(result[0].sourceBias).toBe('lean-left')
    expect(result[1].sourceBias).toBe('center')
    expect(result[2].sourceBias).toBe('right')
  })

  it('returns empty array for no articles', async () => {
    const builder = createMockQueryBuilder([])
    const client = createMockClient(builder)

    const result = await queryHeadlinesForStory(client, 'story-1')
    expect(result).toEqual([])
  })

  it('filters out rows with null sources', async () => {
    const mockHeadlines = [
      { title: 'Good', sources: { name: 'CNN', bias: 'lean-left' } },
      { title: 'Bad', sources: null },
    ]
    const builder = createMockQueryBuilder(mockHeadlines)
    const client = createMockClient(builder)

    const result = await queryHeadlinesForStory(client, 'story-1')
    expect(result).toHaveLength(1)
  })

  it('deduplicates by source name keeping first (most recent) entry', async () => {
    const mockHeadlines = [
      { title: 'CNN Update 2', sources: { name: 'CNN', bias: 'lean-left' } },
      { title: 'CNN Update 1', sources: { name: 'CNN', bias: 'lean-left' } },
      { title: 'Fox Headline', sources: { name: 'Fox News', bias: 'right' } },
    ]
    const builder = createMockQueryBuilder(mockHeadlines)
    const client = createMockClient(builder)

    const result = await queryHeadlinesForStory(client, 'story-1')

    expect(result).toHaveLength(2)
    expect(result.find((h) => h.sourceName === 'CNN')?.title).toBe('CNN Update 2')
    expect(result.find((h) => h.sourceName === 'Fox News')?.title).toBe('Fox Headline')
  })

  it('keeps first row per outlet even with identical published_at', async () => {
    // Rows arrive pre-sorted by published_at DESC, created_at DESC from query
    // First row per source is the most recently created
    const mockHeadlines = [
      { title: 'Reuters Latest', sources: { name: 'Reuters', bias: 'center' } },
      { title: 'Reuters Older', sources: { name: 'Reuters', bias: 'center' } },
    ]
    const builder = createMockQueryBuilder(mockHeadlines)
    const client = createMockClient(builder)

    const result = await queryHeadlinesForStory(client, 'story-1')

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Reuters Latest')
  })

  it('throws on query error', async () => {
    const builder = createMockQueryBuilder(null, 0, { message: 'DB error' })
    const client = createMockClient(builder)

    await expect(queryHeadlinesForStory(client, 'story-1')).rejects.toThrow('Failed to fetch headlines for story')
  })
})

describe('queryRelatedTags', () => {
  it('calls RPC with correct params', async () => {
    const rpcFn = vi.fn().mockResolvedValue({
      data: [{ id: 't2', slug: 'nato', label: 'NATO', description: null, tag_type: 'organization', story_count: 30, created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    })
    const client = { rpc: rpcFn } as unknown as SupabaseClient<Database>

    const result = await queryRelatedTags(client, 'tag-1', 10)

    expect(rpcFn).toHaveBeenCalledWith('related_tags_by_co_occurrence', { p_tag_id: 'tag-1', p_limit: 10 })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('nato')
  })

  it('returns empty array when no related tags', async () => {
    const rpcFn = vi.fn().mockResolvedValue({ data: [], error: null })
    const client = { rpc: rpcFn } as unknown as SupabaseClient<Database>

    const result = await queryRelatedTags(client, 'tag-1')

    expect(result).toEqual([])
  })

  it('throws on RPC error', async () => {
    const rpcFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'RPC error' } })
    const client = { rpc: rpcFn } as unknown as SupabaseClient<Database>

    await expect(queryRelatedTags(client, 'tag-1')).rejects.toThrow('Failed to fetch related tags')
  })
})
