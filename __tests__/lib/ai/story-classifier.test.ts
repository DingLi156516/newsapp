import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Topic, Region } from '@/lib/types'

vi.mock('@/lib/ai/gemini-client', () => ({
  generateText: vi.fn(),
  CHEAP_GENERATION_MODEL: 'models/test-cheap',
}))

vi.mock('@/lib/ai/topic-classifier', () => ({
  fallbackTopic: vi.fn(() => 'politics' as Topic),
}))

vi.mock('@/lib/ai/region-classifier', () => ({
  fallbackRegion: vi.fn(() => 'us' as Region),
}))

import { generateText } from '@/lib/ai/gemini-client'
import { fallbackTopic } from '@/lib/ai/topic-classifier'
import { fallbackRegion } from '@/lib/ai/region-classifier'
import { classifyStory } from '@/lib/ai/story-classifier'

const mockGenerateText = vi.mocked(generateText)
const mockFallbackTopic = vi.mocked(fallbackTopic)
const mockFallbackRegion = vi.mocked(fallbackRegion)

describe('classifyStory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFallbackTopic.mockReturnValue('politics')
    mockFallbackRegion.mockReturnValue('us')
  })

  it('classifies headline, topic, and region from article titles', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"headline": "Congress Passes New Bill", "topic": "politics", "region": "us"}',
    })

    const result = await classifyStory(['Congress passes landmark bill', 'Senate approves new legislation'])

    expect(result).toEqual({
      headline: 'Congress Passes New Bill',
      topic: 'politics',
      region: 'us',
      usedCheapModel: true,
      headlineFallback: false,
      topicFallback: false,
      regionFallback: false,
    })
    expect(mockFallbackTopic).not.toHaveBeenCalled()
    expect(mockFallbackRegion).not.toHaveBeenCalled()
  })

  it('falls back to keyword matching on invalid topic', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"headline": "Tech News", "topic": "invalid_topic", "region": "us"}',
    })
    mockFallbackTopic.mockReturnValue('technology')

    const result = await classifyStory(['New AI breakthrough announced'])

    expect(result.topic).toBe('technology')
    expect(result.headlineFallback).toBe(false)
    expect(result.topicFallback).toBe(true)
    expect(result.regionFallback).toBe(false)
    expect(mockFallbackTopic).toHaveBeenCalledWith(['New AI breakthrough announced'])
  })

  it('falls back to keyword matching on invalid region', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"headline": "World News", "topic": "world", "region": "invalid_region"}',
    })
    mockFallbackRegion.mockReturnValue('international')

    const result = await classifyStory(['Global summit wraps up'])

    expect(result.region).toBe('international')
    expect(result.headlineFallback).toBe(false)
    expect(result.topicFallback).toBe(false)
    expect(result.regionFallback).toBe(true)
    expect(mockFallbackRegion).toHaveBeenCalledWith(['Global summit wraps up'])
  })

  it('falls back completely on API error', async () => {
    mockGenerateText.mockRejectedValue(new Error('API error'))

    const result = await classifyStory(['Some headline'])

    expect(result).toEqual({
      headline: 'Some headline',
      topic: 'politics',
      region: 'us',
      usedCheapModel: true,
      headlineFallback: true,
      topicFallback: true,
      regionFallback: true,
    })
    expect(mockFallbackTopic).toHaveBeenCalledWith(['Some headline'])
    expect(mockFallbackRegion).toHaveBeenCalledWith(['Some headline'])
  })

  it('handles empty article list', async () => {
    const result = await classifyStory([])

    expect(result).toEqual({
      headline: 'Developing story',
      topic: 'politics',
      region: 'us',
      usedCheapModel: false,
      headlineFallback: true,
      topicFallback: true,
      regionFallback: true,
    })
    expect(mockGenerateText).not.toHaveBeenCalled()
  })

  it('handles empty Gemini response headline', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"headline": "", "topic": "politics", "region": "us"}',
    })

    const result = await classifyStory(['Original Title Here'])

    expect(result.headline).toBe('Original Title Here')
    expect(result.headlineFallback).toBe(true)
    expect(result.topicFallback).toBe(false)
    expect(result.regionFallback).toBe(false)
  })
})
