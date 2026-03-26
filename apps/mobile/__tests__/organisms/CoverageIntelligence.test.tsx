import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { CoverageIntelligence } from '@/components/organisms/CoverageIntelligence'
import type { NewsArticle } from '@/lib/shared/types'

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
    { id: 's1', name: 'Reuters', bias: 'center', factuality: 'very-high', ownership: 'corporate', url: 'reuters.com' },
  ],
  spectrumSegments: [
    { bias: 'left', percentage: 35 },
    { bias: 'center', percentage: 40 },
    { bias: 'right', percentage: 25 },
  ],
  aiSummary: { commonGround: 'Summary', leftFraming: 'Left', rightFraming: 'Right' },
  timestamp: '2026-03-20T10:00:00Z',
  region: 'us',
}

describe('CoverageIntelligence', () => {
  it('renders the heading', () => {
    render(<CoverageIntelligence article={baseArticle} timeline={null} />)
    expect(screen.getByText('Coverage Intelligence')).toBeTruthy()
  })

  it('renders section labels', () => {
    render(<CoverageIntelligence article={baseArticle} timeline={null} />)
    expect(screen.getByText('Coverage shape')).toBeTruthy()
    expect(screen.getByText('Coverage momentum')).toBeTruthy()
    expect(screen.getByText('Coverage gaps')).toBeTruthy()
    expect(screen.getByText('Framing delta')).toBeTruthy()
    expect(screen.getByText('How this story was assembled')).toBeTruthy()
  })

  it('renders the overview text from buildStoryIntelligence', () => {
    render(<CoverageIntelligence article={baseArticle} timeline={null} />)
    expect(screen.getByText(/Coverage leans center overall/)).toBeTruthy()
  })

  it('renders the fallback momentum text when timeline is null', () => {
    render(<CoverageIntelligence article={baseArticle} timeline={null} />)
    expect(screen.getByText(/Coverage momentum will become clearer/)).toBeTruthy()
  })
})
