import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { HeroCard } from '@/components/organisms/HeroCard'
import type { NewsArticle } from '@/lib/shared/types'

jest.mock('expo-image', () => {
  const { View } = require('react-native')
  return { Image: View }
})

const mockArticle: NewsArticle = {
  id: 'story-1',
  headline: 'Test Story Headline',
  topic: 'politics',
  sourceCount: 5,
  isBlindspot: false,
  imageUrl: null,
  factuality: 'high',
  ownership: 'corporate',
  sources: [],
  spectrumSegments: [{ bias: 'center', percentage: 100 }],
  aiSummary: { commonGround: 'Summary', leftFraming: 'Left view', rightFraming: 'Right view' },
  timestamp: '2026-03-20T10:00:00Z',
  region: 'us',
}

describe('HeroCard', () => {
  const defaultProps = {
    article: mockArticle,
    onClick: jest.fn(),
    onSave: jest.fn(),
    isSaved: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the headline', () => {
    render(<HeroCard {...defaultProps} />)
    expect(screen.getByText('Test Story Headline')).toBeTruthy()
  })

  it('calls onClick when card is pressed', () => {
    const onClick = jest.fn()
    render(<HeroCard {...defaultProps} onClick={onClick} />)

    fireEvent.press(screen.getByText('Test Story Headline'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders the share button', () => {
    render(<HeroCard {...defaultProps} />)
    expect(screen.getByTestId('share-button')).toBeTruthy()
  })

  describe('Hot badge', () => {
    it('renders when velocity phase is "breaking"', () => {
      const article: NewsArticle = {
        ...mockArticle,
        storyVelocity: { articles_24h: 40, articles_48h: 40, articles_7d: 40, phase: 'breaking' },
      }
      render(<HeroCard {...defaultProps} article={article} />)
      expect(screen.getByTestId('hot-badge')).toBeTruthy()
    })

    it('does not render when phase is not "breaking"', () => {
      const article: NewsArticle = {
        ...mockArticle,
        storyVelocity: { articles_24h: 5, articles_48h: 10, articles_7d: 20, phase: 'developing' },
      }
      render(<HeroCard {...defaultProps} article={article} />)
      expect(screen.queryByTestId('hot-badge')).toBeNull()
    })

    it('does not render when story has no velocity data', () => {
      render(<HeroCard {...defaultProps} />)
      expect(screen.queryByTestId('hot-badge')).toBeNull()
    })

    it('does not render when suppressHotBadge is true', () => {
      const article: NewsArticle = {
        ...mockArticle,
        storyVelocity: { articles_24h: 40, articles_48h: 40, articles_7d: 40, phase: 'breaking' },
      }
      render(<HeroCard {...defaultProps} article={article} suppressHotBadge />)
      expect(screen.queryByTestId('hot-badge')).toBeNull()
    })
  })
})
