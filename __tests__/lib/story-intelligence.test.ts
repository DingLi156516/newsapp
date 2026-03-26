import { buildStoryIntelligence } from '@/lib/story-intelligence'
import type { NewsArticle, StoryTimeline } from '@/lib/types'

const baseArticle: NewsArticle = {
  id: 'story-1',
  headline: 'Test story',
  topic: 'politics',
  sourceCount: 5,
  isBlindspot: false,
  imageUrl: null,
  factuality: 'high',
  ownership: 'corporate',
  sources: [
    {
      id: 's1',
      name: 'Reuters',
      bias: 'center',
      factuality: 'very-high',
      ownership: 'corporate',
      region: 'international',
      url: 'reuters.com',
    },
    {
      id: 's2',
      name: 'NPR',
      bias: 'lean-left',
      factuality: 'very-high',
      ownership: 'non-profit',
      region: 'us',
      url: 'npr.org',
    },
    {
      id: 's3',
      name: 'National Review',
      bias: 'right',
      factuality: 'mixed',
      ownership: 'independent',
      region: 'us',
      url: 'nationalreview.com',
    },
  ],
  spectrumSegments: [
    { bias: 'left', percentage: 35 },
    { bias: 'lean-left', percentage: 20 },
    { bias: 'center', percentage: 20 },
    { bias: 'right', percentage: 15 },
    { bias: 'far-right', percentage: 10 },
  ],
  aiSummary: {
    commonGround: 'Summary',
    leftFraming: 'Left',
    rightFraming: 'Right',
  },
  timestamp: '2026-03-20T10:00:00Z',
  region: 'us',
}

const timeline: StoryTimeline = {
  storyId: 'story-1',
  totalArticles: 12,
  timeSpanHours: 18,
  events: [
    {
      id: 'evt-1',
      timestamp: '2026-03-20T09:00:00Z',
      kind: 'source-added',
      sourceName: 'Reuters',
      sourceBias: 'center',
      description: 'Reuters began covering this story',
      cumulativeSourceCount: 1,
      cumulativeSpectrum: [{ bias: 'center', percentage: 100 }],
    },
    {
      id: 'evt-2',
      timestamp: '2026-03-20T12:00:00Z',
      kind: 'milestone',
      sourceName: 'Fox News',
      sourceBias: 'right',
      description: 'Coverage expanded to five sources',
      cumulativeSourceCount: 5,
      cumulativeSpectrum: [
        { bias: 'left', percentage: 40 },
        { bias: 'center', percentage: 20 },
        { bias: 'right', percentage: 40 },
      ],
    },
  ],
}

describe('buildStoryIntelligence', () => {
  it('summarizes the current coverage mix and momentum', () => {
    const intelligence = buildStoryIntelligence(baseArticle, timeline)

    expect(intelligence.overview).toBe(
      'Coverage leans left overall: 55% left, 20% center, 25% right.'
    )
    expect(intelligence.momentumSummary).toBe(
      'Reuters opened coverage, and the story grew to 5 sources over 18 hours. The spectrum widened from center-only coverage to include left, center, and right lanes.'
    )
  })

  it('describes the main coverage gap for blindspot stories', () => {
    const intelligence = buildStoryIntelligence({
      ...baseArticle,
      isBlindspot: true,
      sourceCount: 4,
      spectrumSegments: [
        { bias: 'left', percentage: 82 },
        { bias: 'center', percentage: 10 },
        { bias: 'right', percentage: 8 },
      ],
    })

    expect(intelligence.coverageGapSummary).toBe(
      'Coverage gap: the story is heavily left-weighted, with only 10% center coverage and 8% right coverage.'
    )
  })

  it('describes balanced coverage when no lane is missing', () => {
    const intelligence = buildStoryIntelligence(baseArticle)

    expect(intelligence.coverageGapSummary).toBe(
      'No major coverage gap is visible: left, center, and right lanes are all represented in the current source mix.'
    )
  })

  it('summarizes framing deltas from the AI perspectives', () => {
    const intelligence = buildStoryIntelligence(baseArticle)

    expect(intelligence.framingDeltaSummary).toBe(
      'Shared reporting centers on Summary. Left-leaning coverage emphasizes Left, while right-leaning coverage emphasizes Right.'
    )
  })

  it('explains how the story was assembled from current metadata', () => {
    const intelligence = buildStoryIntelligence(baseArticle)

    expect(intelligence.methodologySummary).toBe(
      'This view combines 5 sources across 3 active lanes. Blindspot flags trigger when one lane dominates coverage, and the timeline updates as new sources join the cluster.'
    )
    expect(intelligence.ownershipSummary).toBe(
      'Ownership mix spans 3 models: corporate (1), non-profit (1), and independent (1).'
    )
  })

  it('falls back gracefully when there is no timeline data', () => {
    const intelligence = buildStoryIntelligence(baseArticle, null)

    expect(intelligence.momentumSummary).toBe(
      'Coverage momentum will become clearer as more sources join this story.'
    )
  })
})
