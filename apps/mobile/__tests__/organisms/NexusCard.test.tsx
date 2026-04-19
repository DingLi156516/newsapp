import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { NexusCard } from '@/components/organisms/NexusCard'
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

describe('NexusCard', () => {
  const defaultProps = {
    article: mockArticle,
    onSave: jest.fn(),
    isSaved: false,
    onClick: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the headline', () => {
    render(<NexusCard {...defaultProps} />)
    expect(screen.getByText('Test Story Headline')).toBeTruthy()
  })

  it('renders the topic badge', () => {
    render(<NexusCard {...defaultProps} />)
    expect(screen.getByText('Politics')).toBeTruthy()
  })

  it('calls onClick when card is pressed', () => {
    const onClick = jest.fn()
    render(<NexusCard {...defaultProps} onClick={onClick} />)

    fireEvent.press(screen.getByText('Test Story Headline'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('calls onSave with article id when bookmark is pressed', () => {
    const onSave = jest.fn()
    render(<NexusCard {...defaultProps} onSave={onSave} />)

    // BookmarkButton is a Pressable wrapping the Bookmark icon
    // Find it by testID since it now has one
    const bookmarkBtn = screen.getByTestId('bookmark-button')
    fireEvent.press(bookmarkBtn)

    expect(onSave).toHaveBeenCalledWith('story-1')
  })

  it('renders the footer band when provided', () => {
    render(
      <NexusCard
        {...defaultProps}
        footerBand={{ label: 'Under-covered by right-leaning outlets', tone: 'info' }}
      />,
    )
    expect(screen.getByTestId('nexus-card-footer-band')).toBeTruthy()
    expect(screen.getByText('Under-covered by right-leaning outlets')).toBeTruthy()
  })

  it('omits the footer band when not provided', () => {
    render(<NexusCard {...defaultProps} />)
    expect(screen.queryByTestId('nexus-card-footer-band')).toBeNull()
  })
})
