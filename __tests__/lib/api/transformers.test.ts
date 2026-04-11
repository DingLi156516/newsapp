import { transformSource, transformStory, transformStoryList, transformTag, transformHeadlines } from '@/lib/api/transformers'
import type { DbSource } from '@/lib/supabase/types'

const mockSource: DbSource = {
  id: 'src-1',
  slug: 'nytimes',
  name: 'New York Times',
  bias: 'lean-left',
  factuality: 'high',
  ownership: 'corporate',
  url: 'nytimes.com',
  rss_url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  region: 'us',
  is_active: true,
  last_fetch_at: null,
  last_fetch_status: 'success',
  last_fetch_error: null,
  consecutive_failures: 0,
  total_articles_ingested: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  bias_mbfc: null,
  bias_allsides: null,
  bias_adfm: null,
  factuality_mbfc: null,
  factuality_allsides: null,
  bias_override: false,
  bias_sources_synced_at: null,
  source_type: 'rss',
  ingestion_config: {},
  cooldown_until: null,
  auto_disabled_at: null,
  auto_disabled_reason: null,
}

const mockStory = {
  id: 'story-1',
  headline: 'Test Headline',
  topic: 'technology',
  region: 'us',
  source_count: 5,
  is_blindspot: false,
  image_url: 'https://example.com/image.jpg',
  factuality: 'high',
  ownership: 'corporate',
  spectrum_segments: [
    { bias: 'left', percentage: 30 },
    { bias: 'center', percentage: 40 },
    { bias: 'right', percentage: 30 },
  ],
  ai_summary: {
    commonGround: 'Both sides agree on X.',
    leftFraming: 'Left sees it as Y.',
    rightFraming: 'Right sees it as Z.',
  },
  published_at: '2024-06-01T11:00:00Z',
  first_published: '2024-06-01T12:00:00Z',
  last_updated: '2024-06-01T14:00:00Z',
}

describe('transformSource', () => {
  it('maps DbSource to NewsSource', () => {
    const result = transformSource(mockSource)
    expect(result).toEqual({
      id: 'src-1',
      slug: 'nytimes',
      name: 'New York Times',
      bias: 'lean-left',
      factuality: 'high',
      ownership: 'corporate',
      region: 'us',
      url: 'nytimes.com',
      totalArticlesIngested: 0,
    })
  })

  it('omits url when null', () => {
    const noUrl = { ...mockSource, url: null }
    const result = transformSource(noUrl)
    expect(result.url).toBeUndefined()
  })
})

describe('transformStory', () => {
  it('maps story row + sources to NewsArticle', () => {
    const result = transformStory(mockStory, [mockSource])
    expect(result.id).toBe('story-1')
    expect(result.headline).toBe('Test Headline')
    expect(result.topic).toBe('technology')
    expect(result.sourceCount).toBe(5)
    expect(result.isBlindspot).toBe(false)
    expect(result.imageUrl).toBe('https://example.com/image.jpg')
    expect(result.sources).toHaveLength(1)
    expect(result.sources[0].name).toBe('New York Times')
    expect(result.spectrumSegments).toHaveLength(3)
    expect(result.aiSummary.commonGround).toBe('Both sides agree on X.')
  })

  it('handles null image_url', () => {
    const noImage = { ...mockStory, image_url: null }
    const result = transformStory(noImage, [])
    expect(result.imageUrl).toBeNull()
  })

  it('handles invalid ai_summary', () => {
    const bad = { ...mockStory, ai_summary: 'not-an-object' }
    const result = transformStory(bad, [])
    expect(result.aiSummary.commonGround).toBe('Summary not yet generated.')
  })

  it('handles invalid spectrum_segments', () => {
    const bad = { ...mockStory, spectrum_segments: 'not-an-array' }
    const result = transformStory(bad, [])
    expect(result.spectrumSegments).toEqual([])
  })
})

describe('transformStoryList', () => {
  it('returns story with empty sources array', () => {
    const result = transformStoryList(mockStory)
    expect(result.sources).toEqual([])
    expect(result.headline).toBe('Test Headline')
  })
})

describe('transformStory enrichment fields', () => {
  const enrichedStory = {
    ...mockStory,
    story_velocity: { articles_24h: 5, articles_48h: 8, articles_7d: 12, phase: 'breaking' },
    impact_score: 75,
    source_diversity: 4,
    controversy_score: 0.82,
    sentiment: { left: 'critical', right: 'hopeful' },
    key_quotes: [{ text: 'Important quote', sourceName: 'CNN', sourceBias: 'lean-left' }],
    key_claims: [{ claim: 'Taxes rise', side: 'left', disputed: true, counterClaim: 'Offsets exist' }],
  }

  it('transforms all enrichment fields in transformStory', () => {
    const result = transformStory(enrichedStory, [mockSource])
    expect(result.storyVelocity).toEqual({ articles_24h: 5, articles_48h: 8, articles_7d: 12, phase: 'breaking' })
    expect(result.impactScore).toBe(75)
    expect(result.sourceDiversity).toBe(4)
    expect(result.controversyScore).toBe(0.82)
    expect(result.sentiment).toEqual({ left: 'critical', right: 'hopeful' })
    expect(result.keyQuotes).toEqual([{ text: 'Important quote', sourceName: 'CNN', sourceBias: 'lean-left' }])
    expect(result.keyClaims).toEqual([{ claim: 'Taxes rise', side: 'left', disputed: true, counterClaim: 'Offsets exist' }])
  })

  it('transforms enrichment fields in transformStoryList', () => {
    const result = transformStoryList(enrichedStory)
    expect(result.storyVelocity).toEqual({ articles_24h: 5, articles_48h: 8, articles_7d: 12, phase: 'breaking' })
    expect(result.impactScore).toBe(75)
    expect(result.sourceDiversity).toBe(4)
    expect(result.controversyScore).toBe(0.82)
    expect(result.sentiment).toEqual({ left: 'critical', right: 'hopeful' })
  })

  it('returns null for missing enrichment fields', () => {
    const result = transformStory(mockStory, [])
    expect(result.storyVelocity).toBeNull()
    expect(result.impactScore).toBeNull()
    expect(result.sourceDiversity).toBeNull()
    expect(result.controversyScore).toBeNull()
    expect(result.sentiment).toBeNull()
    expect(result.keyQuotes).toBeNull()
    expect(result.keyClaims).toBeNull()
  })

  it('rejects invalid velocity phase', () => {
    const bad = { ...mockStory, story_velocity: { articles_24h: 1, articles_48h: 2, articles_7d: 3, phase: 'invalid' } }
    const result = transformStory(bad, [])
    expect(result.storyVelocity).toBeNull()
  })

  it('rejects invalid sentiment values', () => {
    const bad = { ...mockStory, sentiment: { left: 'invalid', right: 'hopeful' } }
    const result = transformStory(bad, [])
    expect(result.sentiment).toBeNull()
  })

  it('filters out malformed key quotes', () => {
    const bad = {
      ...mockStory,
      key_quotes: [
        { text: 'Good', sourceName: 'CNN', sourceBias: 'lean-left' },
        { text: 123 }, // invalid
      ],
    }
    const result = transformStory(bad, [])
    expect(result.keyQuotes).toHaveLength(1)
  })

  it('includes headlines when provided to transformStory', () => {
    const headlines = [
      { title: 'Left Title', sourceName: 'NYT', sourceBias: 'lean-left' },
      { title: 'Right Title', sourceName: 'Fox', sourceBias: 'right' },
    ]
    const result = transformStory(mockStory, [], undefined, undefined, headlines)
    expect(result.headlines).toHaveLength(2)
    expect(result.headlines![0].title).toBe('Left Title')
  })
})

describe('transformHeadlines', () => {
  it('transforms headline rows into HeadlineComparison array', () => {
    const rows = [
      { title: 'Left Headline', sourceName: 'CNN', sourceBias: 'lean-left' },
      { title: 'Right Headline', sourceName: 'Fox News', sourceBias: 'right' },
    ]
    const result = transformHeadlines(rows)
    expect(result).toEqual([
      { title: 'Left Headline', sourceName: 'CNN', sourceBias: 'lean-left' },
      { title: 'Right Headline', sourceName: 'Fox News', sourceBias: 'right' },
    ])
  })

  it('returns empty array for empty input', () => {
    expect(transformHeadlines([])).toEqual([])
  })
})

describe('transformTag', () => {
  it('maps tag row fields correctly', () => {
    const result = transformTag({
      slug: 'iran',
      label: 'Iran',
      tag_type: 'location',
      story_count: 50,
      description: 'Country in the Middle East',
      relevance: 0.95,
    })

    expect(result).toEqual({
      slug: 'iran',
      label: 'Iran',
      type: 'location',
      relevance: 0.95,
      storyCount: 50,
      description: 'Country in the Middle East',
    })
  })

  it('defaults relevance to 1 when not provided', () => {
    const result = transformTag({
      slug: 'nato',
      label: 'NATO',
      tag_type: 'organization',
      story_count: 30,
    })

    expect(result.relevance).toBe(1)
  })

  it('omits description when null', () => {
    const result = transformTag({
      slug: 'nato',
      label: 'NATO',
      tag_type: 'organization',
      story_count: 30,
      description: null,
    })

    expect(result.description).toBeUndefined()
  })
})
