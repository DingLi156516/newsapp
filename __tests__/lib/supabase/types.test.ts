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
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
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
      image_url: null,
      published_at: '2026-01-01T00:00:00Z',
      ingested_at: '2026-01-01T00:00:00Z',
      embedding: null,
      is_embedded: false,
      story_id: null,
      created_at: '2026-01-01T00:00:00Z',
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
