import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Region, Topic } from '@/lib/types'

vi.mock('@/lib/ai/story-classifier', () => ({
  classifyStory: vi.fn(),
}))

vi.mock('@/lib/ai/summary-generator', () => ({
  generateAISummary: vi.fn(),
  isFallbackSummary: vi.fn(() => false),
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
import { classifyStory } from '@/lib/ai/story-classifier'
import { generateAISummary } from '@/lib/ai/summary-generator'

const mockClassifyStory = vi.mocked(classifyStory)
const mockSummary = vi.mocked(generateAISummary)

function classificationResult(headline: string, topic: Topic = 'politics', region: Region = 'us') {
  return { 
    headline, 
    topic, 
    region, 
    usedCheapModel: true, 
    headlineFallback: false,
    topicFallback: false,
    regionFallback: false
  }
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
    mockClassifyStory.mockResolvedValue(classificationResult('Generated Headline', 'politics', 'us'))
  })

  it('starts multiple story assemblies before the first classification resolves', async () => {
    const firstClassification = deferred<ReturnType<typeof classificationResult>>()
    const secondClassification = deferred<ReturnType<typeof classificationResult>>()
    mockClassifyStory
      .mockReturnValueOnce(firstClassification.promise)
      .mockReturnValueOnce(secondClassification.promise)

    const run = assembleStories(createMockClient() as never, 2)
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mockClassifyStory).toHaveBeenCalledTimes(2)

    firstClassification.resolve(classificationResult('Headline 1'))
    secondClassification.resolve(classificationResult('Headline 2'))

    await expect(run).resolves.toEqual(expect.objectContaining({
      claimedStories: 2,
    }))
  })
})
