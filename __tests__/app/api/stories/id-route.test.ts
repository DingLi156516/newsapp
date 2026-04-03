/**
 * Tests for GET /api/stories/[id] — Story detail endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/api/query-helpers', () => ({
  queryStoryById: vi.fn(),
  querySourcesForStory: vi.fn(),
  queryHeadlinesForStory: vi.fn(),
  queryTagsForStory: vi.fn(),
}))

vi.mock('@/lib/api/transformers', () => ({
  transformStory: vi.fn(),
}))

import { GET } from '@/app/api/stories/[id]/route'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import {
  queryStoryById,
  querySourcesForStory,
  queryHeadlinesForStory,
  queryTagsForStory,
} from '@/lib/api/query-helpers'
import { transformStory } from '@/lib/api/transformers'

const mockGetClient = vi.mocked(getSupabaseServerClient)
const mockQueryStoryById = vi.mocked(queryStoryById)
const mockQuerySourcesForStory = vi.mocked(querySourcesForStory)
const mockQueryHeadlinesForStory = vi.mocked(queryHeadlinesForStory)
const mockQueryTagsForStory = vi.mocked(queryTagsForStory)
const mockTransformStory = vi.mocked(transformStory)

const VALID_UUID = '12345678-1234-1234-1234-123456789abc'

function makeParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id })
}

describe('GET /api/stories/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetClient.mockReturnValue({} as never)
  })

  it('returns 400 for invalid UUID format', async () => {
    const request = new NextRequest(new URL('http://localhost/api/stories/not-a-uuid'))
    const response = await GET(request, { params: makeParams('not-a-uuid') })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toContain('Invalid story ID')
  })

  it('returns 404 when story not found', async () => {
    mockQueryStoryById.mockResolvedValue(null)

    const request = new NextRequest(new URL(`http://localhost/api/stories/${VALID_UUID}`))
    const response = await GET(request, { params: makeParams(VALID_UUID) })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.success).toBe(false)
  })

  it('returns 200 with transformed story on success', async () => {
    const mockStory = { id: VALID_UUID, title: 'Test Story' }
    const mockSources = { sources: [{ id: 's1' }], articleUrlMap: new Map() }
    const mockHeadlines = [{ title: 'Headline', sourceName: 'CNN', sourceBias: 'lean-left' }]
    const mockTags = [{ slug: 'iran', label: 'Iran', tag_type: 'location', story_count: 5 }]
    const mockTransformed = { id: VALID_UUID, title: 'Test Story', sources: [] }

    mockQueryStoryById.mockResolvedValue(mockStory as never)
    mockQuerySourcesForStory.mockResolvedValue(mockSources as never)
    mockQueryHeadlinesForStory.mockResolvedValue(mockHeadlines as never)
    mockQueryTagsForStory.mockResolvedValue(mockTags as never)
    mockTransformStory.mockReturnValue(mockTransformed as never)

    const request = new NextRequest(new URL(`http://localhost/api/stories/${VALID_UUID}`))
    const response = await GET(request, { params: makeParams(VALID_UUID) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockTransformStory).toHaveBeenCalledWith(
      mockStory,
      mockSources.sources,
      mockSources.articleUrlMap,
      mockTags,
      mockHeadlines,
    )
  })

  it('returns 200 with empty headlines when headline fetch throws', async () => {
    const mockStory = { id: VALID_UUID, title: 'Test Story' }
    const mockSources = { sources: [{ id: 's1' }], articleUrlMap: new Map() }
    const mockTags = [{ slug: 'iran', label: 'Iran', tag_type: 'location', story_count: 5 }]
    const mockTransformed = { id: VALID_UUID, title: 'Test Story', sources: [] }

    mockQueryStoryById.mockResolvedValue(mockStory as never)
    mockQuerySourcesForStory.mockResolvedValue(mockSources as never)
    mockQueryHeadlinesForStory.mockRejectedValue(new Error('Headline DB error'))
    mockQueryTagsForStory.mockResolvedValue(mockTags as never)
    mockTransformStory.mockReturnValue(mockTransformed as never)

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const request = new NextRequest(new URL(`http://localhost/api/stories/${VALID_UUID}`))
    const response = await GET(request, { params: makeParams(VALID_UUID) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockTransformStory).toHaveBeenCalledWith(
      mockStory,
      mockSources.sources,
      mockSources.articleUrlMap,
      mockTags,
      [],
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Headline fetch failed'),
      'Headline DB error',
    )

    consoleErrorSpy.mockRestore()
  })

  it('returns 200 with empty tags when tag fetch throws', async () => {
    const mockStory = { id: VALID_UUID, title: 'Test Story' }
    const mockSources = { sources: [{ id: 's1' }], articleUrlMap: new Map() }
    const mockHeadlines = [{ title: 'Headline', sourceName: 'CNN', sourceBias: 'lean-left' }]
    const mockTransformed = { id: VALID_UUID, title: 'Test Story', sources: [] }

    mockQueryStoryById.mockResolvedValue(mockStory as never)
    mockQuerySourcesForStory.mockResolvedValue(mockSources as never)
    mockQueryHeadlinesForStory.mockResolvedValue(mockHeadlines as never)
    mockQueryTagsForStory.mockRejectedValue(new Error('Tag DB error'))
    mockTransformStory.mockReturnValue(mockTransformed as never)

    vi.spyOn(console, 'error').mockImplementation(() => {})

    const request = new NextRequest(new URL(`http://localhost/api/stories/${VALID_UUID}`))
    const response = await GET(request, { params: makeParams(VALID_UUID) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockTransformStory).toHaveBeenCalledWith(
      mockStory,
      mockSources.sources,
      mockSources.articleUrlMap,
      [],
      mockHeadlines,
    )

    vi.restoreAllMocks()
  })

  it('returns 500 when source fetch throws', async () => {
    const mockStory = { id: VALID_UUID, title: 'Test Story' }
    mockQueryStoryById.mockResolvedValue(mockStory as never)
    mockQuerySourcesForStory.mockRejectedValue(new Error('Source DB error'))

    const request = new NextRequest(new URL(`http://localhost/api/stories/${VALID_UUID}`))
    const response = await GET(request, { params: makeParams(VALID_UUID) })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Source DB error')
  })
})
