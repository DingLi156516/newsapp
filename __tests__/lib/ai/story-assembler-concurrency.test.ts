import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Region, Topic } from '@/lib/types'

vi.mock('@/lib/ai/headline-generator', () => ({
  generateNeutralHeadline: vi.fn(),
}))

vi.mock('@/lib/ai/summary-generator', () => ({
  generateAISummary: vi.fn(),
  isFallbackSummary: vi.fn(() => false),
}))

vi.mock('@/lib/ai/topic-classifier', () => ({
  classifyTopic: vi.fn(),
}))

vi.mock('@/lib/ai/region-classifier', () => ({
  classifyRegion: vi.fn(),
}))

vi.mock('@/lib/ai/spectrum-calculator', () => ({
  calculateSpectrum: vi.fn(() => []),
}))

vi.mock('@/lib/ai/blindspot-detector', () => ({
  isBlindspot: vi.fn(() => false),
}))

vi.mock('@/lib/ai/entity-extractor', () => ({
  extractEntities: vi.fn(() => Promise.resolve([])),
}))

vi.mock('@/lib/ai/tag-upsert', () => ({
  upsertStoryTags: vi.fn(() => Promise.resolve(undefined)),
}))

import { assembleStories } from '@/lib/ai/story-assembler'
import { generateNeutralHeadline } from '@/lib/ai/headline-generator'
import { generateAISummary } from '@/lib/ai/summary-generator'
import { classifyTopic } from '@/lib/ai/topic-classifier'
import { classifyRegion } from '@/lib/ai/region-classifier'

const mockHeadline = vi.mocked(generateNeutralHeadline)
const mockSummary = vi.mocked(generateAISummary)
const mockTopic = vi.mocked(classifyTopic)
const mockRegion = vi.mocked(classifyRegion)

function headlineResult(headline: string) {
  return { headline, usedCheapModel: true, usedFallback: false }
}

function topicResult(topic: Topic) {
  return { topic, usedCheapModel: true, usedFallback: false }
}

function regionResult(region: Region) {
  return { region, usedCheapModel: true, usedFallback: false }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function createMockClient() {
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'stories') {
        return {
          select: vi.fn().mockImplementation((columns: string) => {
            if (columns === 'first_published') {
              return {
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { first_published: '2026-03-22T10:00:00Z' },
                    error: null,
                  }),
                }),
              }
            }
            return {
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      returns: vi.fn().mockResolvedValue({
                        data: [
                          { id: 'story-1', assembly_claimed_at: null, first_published: '2026-03-22T10:00:00Z' },
                          { id: 'story-2', assembly_claimed_at: null, first_published: '2026-03-22T10:00:00Z' },
                        ],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }
          }),
          update: updateFn,
        }
      }

      if (table === 'articles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  returns: vi.fn().mockResolvedValue({
                    data: [
                      { id: 'a1', title: 'One', description: 'Desc', source_id: 'source-1', image_url: null, published_at: '2026-03-22T10:00:00Z' },
                      { id: 'a2', title: 'Two', description: 'Desc', source_id: 'source-2', image_url: null, published_at: '2026-03-22T11:00:00Z' },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }
      }

      if (table === 'sources') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              returns: vi.fn().mockResolvedValue({
                data: [
                  { id: 'source-1', bias: 'left', factuality: 'high', ownership: 'corporate' },
                  { id: 'source-2', bias: 'right', factuality: 'high', ownership: 'independent' },
                ],
                error: null,
              }),
            }),
          }),
        }
      }

      return {}
    }),
  }
}

describe('assembleStories concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSummary.mockResolvedValue({ aiSummary: { commonGround: 'cg', leftFraming: 'lf', rightFraming: 'rf' }, sentiment: null, keyQuotes: null, keyClaims: null })
    mockTopic.mockResolvedValue(topicResult('politics'))
    mockRegion.mockResolvedValue(regionResult('us'))
  })

  it('starts multiple story assemblies before the first headline generation resolves', async () => {
    const firstHeadline = deferred<ReturnType<typeof headlineResult>>()
    const secondHeadline = deferred<ReturnType<typeof headlineResult>>()
    mockHeadline
      .mockReturnValueOnce(firstHeadline.promise)
      .mockReturnValueOnce(secondHeadline.promise)

    const run = assembleStories(createMockClient() as never, 2)
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mockHeadline).toHaveBeenCalledTimes(2)

    firstHeadline.resolve(headlineResult('Headline 1'))
    secondHeadline.resolve(headlineResult('Headline 2'))

    await expect(run).resolves.toEqual(expect.objectContaining({
      claimedStories: 2,
    }))
  })
})
