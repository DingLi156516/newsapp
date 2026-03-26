import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

import type { UnifiedTab } from '@/lib/shared/types'
import { EditFeedModal } from '@/components/organisms/EditFeedModal'

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  visibleFeeds: ['for-you', 'trending', 'latest', 'politics'] as readonly UnifiedTab[],
  feedSort: 'most-covered' as const,
  onUpdateConfig: jest.fn(),
}

describe('EditFeedModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders feed and topic toggles when visible', () => {
    render(<EditFeedModal {...defaultProps} />)
    expect(screen.getByText('FEEDS')).toBeTruthy()
    expect(screen.getByText('TOPICS')).toBeTruthy()
    expect(screen.getByTestId('edit-feed-toggle-for-you')).toBeTruthy()
    expect(screen.getByTestId('edit-feed-toggle-trending')).toBeTruthy()
    expect(screen.getByTestId('edit-feed-toggle-politics')).toBeTruthy()
    expect(screen.getByTestId('edit-feed-toggle-technology')).toBeTruthy()
  })

  it('renders sort section', () => {
    render(<EditFeedModal {...defaultProps} />)
    expect(screen.getByText('SORT ORDER')).toBeTruthy()
    expect(screen.getByTestId('edit-feed-sort-most-covered')).toBeTruthy()
    expect(screen.getByTestId('edit-feed-sort-most-recent')).toBeTruthy()
  })

  it('calls onClose when Done is pressed', () => {
    const onClose = jest.fn()
    render(<EditFeedModal {...defaultProps} onClose={onClose} />)
    fireEvent.press(screen.getByTestId('edit-feed-done'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onUpdateConfig when toggling a topic on', () => {
    const onUpdateConfig = jest.fn()
    render(<EditFeedModal {...defaultProps} onUpdateConfig={onUpdateConfig} />)
    fireEvent(screen.getByTestId('edit-feed-toggle-technology'), 'valueChange', true)
    expect(onUpdateConfig).toHaveBeenCalledWith({
      visibleFeeds: expect.arrayContaining(['technology']),
    })
  })

  it('calls onUpdateConfig when toggling a feed off', () => {
    const onUpdateConfig = jest.fn()
    render(<EditFeedModal {...defaultProps} onUpdateConfig={onUpdateConfig} />)
    fireEvent(screen.getByTestId('edit-feed-toggle-politics'), 'valueChange', false)
    expect(onUpdateConfig).toHaveBeenCalledWith({
      visibleFeeds: expect.not.arrayContaining(['politics']),
    })
  })

  it('calls onUpdateConfig when changing sort order', () => {
    const onUpdateConfig = jest.fn()
    render(<EditFeedModal {...defaultProps} onUpdateConfig={onUpdateConfig} />)
    fireEvent.press(screen.getByTestId('edit-feed-sort-most-recent'))
    expect(onUpdateConfig).toHaveBeenCalledWith({ feedSort: 'most-recent' })
  })

  it('renders Edit Feed header', () => {
    render(<EditFeedModal {...defaultProps} />)
    expect(screen.getByText('Edit Feed')).toBeTruthy()
  })
})
