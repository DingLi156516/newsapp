import { render, screen } from '@testing-library/react'
import { CoverageIntelligence } from '@/components/organisms/CoverageIntelligence'
import type { NewsArticle, StoryTimeline } from '@/lib/types'

const article: NewsArticle = {
  id: 'story-1',
  headline: 'Test story',
  topic: 'politics',
  sourceCount: 4,
  isBlindspot: true,
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
      name: 'Jacobin',
      bias: 'far-left',
      factuality: 'mixed',
      ownership: 'independent',
      region: 'us',
      url: 'jacobin.com',
    },
  ],
  spectrumSegments: [
    { bias: 'left', percentage: 82 },
    { bias: 'center', percentage: 10 },
    { bias: 'right', percentage: 8 },
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
  totalArticles: 8,
  timeSpanHours: 12,
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
      sourceName: 'Jacobin',
      sourceBias: 'far-left',
      description: 'Coverage expanded to four sources',
      cumulativeSourceCount: 4,
      cumulativeSpectrum: [
        { bias: 'left', percentage: 82 },
        { bias: 'center', percentage: 10 },
        { bias: 'right', percentage: 8 },
      ],
    },
  ],
}

describe('CoverageIntelligence', () => {
  it('renders story analysis sections and derived summaries', () => {
    render(<CoverageIntelligence article={article} timeline={timeline} />)

    expect(screen.getByText('Coverage Intelligence')).toBeInTheDocument()
    expect(screen.getByText('Coverage momentum')).toBeInTheDocument()
    expect(screen.getByText('Coverage gaps')).toBeInTheDocument()
    expect(screen.getByText('Framing delta')).toBeInTheDocument()
    expect(screen.getByText('How this story was assembled')).toBeInTheDocument()
    expect(screen.getByText('Coverage leans left overall: 82% left, 10% center, 8% right.')).toBeInTheDocument()
    expect(screen.getByText('Reuters opened coverage, and the story grew to 4 sources over 12 hours. The spectrum widened from center-only coverage to include left, center, and right lanes.')).toBeInTheDocument()
    expect(screen.getByText('Coverage gap: the story is heavily left-weighted, with only 10% center coverage and 8% right coverage.')).toBeInTheDocument()
    expect(screen.getByText('Shared reporting centers on Summary. Left-leaning coverage emphasizes Left, while right-leaning coverage emphasizes Right.')).toBeInTheDocument()
    expect(screen.getByText('This view combines 4 sources across 3 active lanes. Blindspot flags trigger when one lane dominates coverage, and the timeline updates as new sources join the cluster.')).toBeInTheDocument()
    expect(screen.getByText('Ownership mix spans 2 models: corporate (1), and independent (1).')).toBeInTheDocument()
  })

  it('renders fallback copy when timeline data is unavailable', () => {
    render(<CoverageIntelligence article={{ ...article, isBlindspot: false }} timeline={null} />)

    expect(screen.getByText('Coverage momentum will become clearer as more sources join this story.')).toBeInTheDocument()
    expect(screen.getByText('Coverage gap: the story is heavily left-weighted, with only 10% center coverage and 8% right coverage.')).toBeInTheDocument()
  })

})
