import { transformSource, transformStory, transformStoryList } from '@/lib/api/transformers'
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
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
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
  first_published: '2024-06-01T12:00:00Z',
  last_updated: '2024-06-01T14:00:00Z',
}

describe('transformSource', () => {
  it('maps DbSource to NewsSource', () => {
    const result = transformSource(mockSource)
    expect(result).toEqual({
      id: 'src-1',
      name: 'New York Times',
      bias: 'lean-left',
      factuality: 'high',
      ownership: 'corporate',
      url: 'nytimes.com',
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
