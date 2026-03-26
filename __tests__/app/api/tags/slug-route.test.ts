/**
 * Tests for GET /api/tags/[slug] — Tag detail endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/api/query-helpers', () => ({
  queryTagBySlug: vi.fn(),
  queryRelatedTags: vi.fn(),
}))

import { GET } from '@/app/api/tags/[slug]/route'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryTagBySlug, queryRelatedTags } from '@/lib/api/query-helpers'

const mockGetClient = vi.mocked(getSupabaseServerClient)
const mockQueryTagBySlug = vi.mocked(queryTagBySlug)
const mockQueryRelatedTags = vi.mocked(queryRelatedTags)

function makeRequest(slug = 'iran', queryParams?: Record<string, string>) {
  const url = new URL(`http://localhost/api/tags/${slug}`)
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value)
    }
  }
  return new NextRequest(url)
}

const mockTagRow = {
  id: 't1',
  slug: 'iran',
  label: 'Iran',
  description: 'A country in Western Asia',
  tag_type: 'location',
  story_count: 150,
  created_at: '2026-01-01T00:00:00Z',
}

describe('GET /api/tags/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetClient.mockReturnValue({} as never)
  })

  it('returns standard tag detail for unambiguous slug', async () => {
    mockQueryTagBySlug.mockResolvedValue([mockTagRow])
    mockQueryRelatedTags.mockResolvedValue([
      { id: 't2', slug: 'donald-trump', label: 'Donald Trump', description: null, tag_type: 'person', story_count: 120, created_at: '2026-01-01T00:00:00Z' },
    ])

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ slug: 'iran' }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.tag.slug).toBe('iran')
    expect(body.data.tag.type).toBe('location')
    expect(body.data.tag.description).toBe('A country in Western Asia')
    expect(body.data.relatedTags).toHaveLength(1)
    expect(body.data.relatedTags[0].slug).toBe('donald-trump')
  })

  it('returns disambiguation list when multiple types share slug', async () => {
    const personTag = {
      id: 't3',
      slug: 'jordan',
      label: 'Jordan (person)',
      description: null,
      tag_type: 'person',
      story_count: 80,
      created_at: '2026-01-01T00:00:00Z',
    }
    const locationTag = {
      ...mockTagRow,
      slug: 'jordan',
      label: 'Jordan',
      tag_type: 'location',
      story_count: 150,
    }
    mockQueryTagBySlug.mockResolvedValue([locationTag, personTag])

    const response = await GET(makeRequest('jordan'), {
      params: Promise.resolve({ slug: 'jordan' }),
    })

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.tags).toHaveLength(2)
    expect(body.data.tags[0].type).toBe('location')
    expect(body.data.tags[1].type).toBe('person')
  })

  it('omits relatedTags in disambiguation response', async () => {
    const personTag = {
      id: 't3',
      slug: 'jordan',
      label: 'Jordan (person)',
      description: null,
      tag_type: 'person',
      story_count: 80,
      created_at: '2026-01-01T00:00:00Z',
    }
    const locationTag = {
      ...mockTagRow,
      slug: 'jordan',
      label: 'Jordan',
      tag_type: 'location',
      story_count: 150,
    }
    mockQueryTagBySlug.mockResolvedValue([locationTag, personTag])

    const response = await GET(makeRequest('jordan'), {
      params: Promise.resolve({ slug: 'jordan' }),
    })

    const body = await response.json()
    expect(body.data.relatedTags).toBeUndefined()
    expect(body.data.tag).toBeUndefined()
    expect(mockQueryRelatedTags).not.toHaveBeenCalled()
  })

  it('passes type param to queryTagBySlug', async () => {
    mockQueryTagBySlug.mockResolvedValue([mockTagRow])
    mockQueryRelatedTags.mockResolvedValue([])

    await GET(makeRequest('iran', { type: 'location' }), {
      params: Promise.resolve({ slug: 'iran' }),
    })

    expect(mockQueryTagBySlug).toHaveBeenCalledWith(
      expect.anything(),
      'iran',
      'location'
    )
  })

  it('returns 400 for invalid type param', async () => {
    const response = await GET(makeRequest('iran', { type: 'animal' }), {
      params: Promise.resolve({ slug: 'iran' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Invalid tag type')
  })

  it('returns 404 when tag not found', async () => {
    mockQueryTagBySlug.mockResolvedValue([])

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ slug: 'nonexistent' }),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Tag not found')
  })

  it('returns 500 on query error', async () => {
    mockQueryTagBySlug.mockRejectedValue(new Error('DB error'))

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ slug: 'iran' }),
    })

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.success).toBe(false)
  })
})
