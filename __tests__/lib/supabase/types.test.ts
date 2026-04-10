/**
 * Tests for lib/supabase/types.ts — validates DB type interfaces
 * match expected shapes and that the Database type map is well-formed.
 */
import type {
  DbSource,
  DbSourceInsert,
  DbArticle,
  DbArticleInsert,
  DbStory,
  DbStoryInsert,
  Database,
} from '@/lib/supabase/types'

describe('Database type interfaces', () => {
  it('DbSource has all required fields', () => {
    const source: DbSource = {
      id: '123',
      slug: 'test-source',
      name: 'Test Source',
      bias: 'center',
      factuality: 'high',
      ownership: 'corporate',
      url: 'test.com',
      rss_url: 'https://test.com/feed',
      region: 'us',
      is_active: true,
      last_fetch_at: null,
      last_fetch_status: 'success',
      last_fetch_error: null,
      consecutive_failures: 0,
      total_articles_ingested: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      bias_mbfc: null,
      bias_allsides: null,
      bias_adfm: null,
      factuality_mbfc: null,
      factuality_allsides: null,
      bias_override: false,
      bias_sources_synced_at: null,
      source_type: 'rss',
      ingestion_config: {},
    }
    expect(source.id).toBe('123')
    expect(source.slug).toBe('test-source')
    expect(source.name).toBe('Test Source')
    expect(source.bias).toBe('center')
    expect(source.factuality).toBe('high')
    expect(source.ownership).toBe('corporate')
    expect(source.region).toBe('us')
    expect(source.is_active).toBe(true)
  })

  it('DbSourceInsert requires only mandatory fields', () => {
    const insert: DbSourceInsert = {
      slug: 'test',
      name: 'Test',
      bias: 'left',
      factuality: 'mixed',
      ownership: 'independent',
    }
    expect(insert.slug).toBe('test')
    expect(insert.region).toBeUndefined()
    expect(insert.url).toBeUndefined()
  })

  it('DbArticle has all required fields', () => {
    const article: DbArticle = {
      id: 'a1',
      source_id: 's1',
      title: 'Test Article',
      description: 'Test description',
      content: 'Test content',
      url: 'https://test.com/article',
      canonical_url: 'https://test.com/article',
      title_fingerprint: 'test-article',
      image_url: null,
      published_at: '2026-01-01T00:00:00Z',
      ingested_at: '2026-01-01T00:00:00Z',
      embedding: null,
      is_embedded: false,
      embedding_claimed_at: null,
      embedding_claim_owner: null,
      clustering_claimed_at: null,
      clustering_claim_owner: null,
      story_id: null,
      clustering_attempts: 0,
      clustering_status: 'pending' as const,
      created_at: '2026-01-01T00:00:00Z',
      fetched_at: '2026-01-01T00:00:00Z',
      published_at_estimated: false,
    }
    expect(article.id).toBe('a1')
    expect(article.source_id).toBe('s1')
    expect(article.is_embedded).toBe(false)
    expect(article.embedding).toBeNull()
    expect(article.story_id).toBeNull()
  })

  it('DbArticleInsert requires only mandatory fields', () => {
    const insert: DbArticleInsert = {
      source_id: 's1',
      title: 'Test',
      url: 'https://test.com',
      published_at: '2026-01-01T00:00:00Z',
    }
    expect(insert.source_id).toBe('s1')
    expect(insert.description).toBeUndefined()
    expect(insert.embedding).toBeUndefined()
  })

  it('DbStory has all required fields including JSONB', () => {
    const story: DbStory = {
      id: 'st1',
      headline: 'Test Headline',
      story_kind: 'standard',
      topic: 'politics',
      region: 'us',
      source_count: 5,
      is_blindspot: false,
      image_url: null,
      factuality: 'high',
      ownership: 'corporate',
      spectrum_segments: [{ bias: 'center', percentage: 100 }],
      ai_summary: {
        commonGround: 'Common facts',
        leftFraming: 'Left perspective',
        rightFraming: 'Right perspective',
      },
      cluster_centroid: null,
      assembly_status: 'completed',
      publication_status: 'needs_review',
      review_reasons: ['blindspot'],
      confidence_score: 0.42,
      processing_error: null,
      assembled_at: '2026-01-01T00:00:00Z',
      published_at: null,
      assembly_claimed_at: null,
      assembly_claim_owner: null,
      assembly_version: 0,
      review_status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      story_velocity: null,
      impact_score: null,
      source_diversity: null,
      controversy_score: null,
      sentiment: null,
      key_quotes: null,
      key_claims: null,
      first_published: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    }
    expect(story.headline).toBe('Test Headline')
    expect(story.topic).toBe('politics')
    expect(story.spectrum_segments).toHaveLength(1)
    expect(story.ai_summary.commonGround).toBe('Common facts')
  })

  it('DbStoryInsert requires only mandatory fields', () => {
    const insert: DbStoryInsert = {
      headline: 'Test',
      topic: 'world',
      first_published: '2026-01-01T00:00:00Z',
    }
    expect(insert.headline).toBe('Test')
    expect(insert.source_count).toBeUndefined()
    expect(insert.is_blindspot).toBeUndefined()
  })

  it('Database type map has correct table structure', () => {
    type Tables = Database['public']['Tables']
    type SourceRow = Tables['sources']['Row']
    type ArticleRow = Tables['articles']['Row']
    type StoryRow = Tables['stories']['Row']

    const sourceRow: SourceRow = {} as DbSource
    const articleRow: ArticleRow = {} as DbArticle
    const storyRow: StoryRow = {} as DbStory

    expect(sourceRow).toBeDefined()
    expect(articleRow).toBeDefined()
    expect(storyRow).toBeDefined()
  })
})
