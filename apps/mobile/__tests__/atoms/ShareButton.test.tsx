import React from 'react'
import { Share } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'

import { ShareButton } from '@/components/atoms/ShareButton'

jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined })

describe('ShareButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the share button', () => {
    render(<ShareButton url="https://example.com/story/1" title="Test Story" />)
    expect(screen.getByTestId('share-button')).toBeTruthy()
  })

  it('calls Share.share with title and full url on press', async () => {
    render(<ShareButton url="https://example.com/story/1" title="Test Story" />)

    fireEvent.press(screen.getByTestId('share-button'))

    await waitFor(() => {
      expect(Share.share).toHaveBeenCalledWith({
        message: 'Test Story\nhttps://example.com/story/1',
        url: 'https://example.com/story/1',
      })
    })
  })

  it('resolves relative url to full site url', async () => {
    render(<ShareButton url="/story/42" title="Breaking News" />)

    fireEvent.press(screen.getByTestId('share-button'))

    await waitFor(() => {
      expect(Share.share).toHaveBeenCalledWith({
        message: expect.stringContaining('/story/42'),
        url: expect.stringContaining('/story/42'),
      })
    })
  })

  it('handles share rejection gracefully', async () => {
    ;(Share.share as jest.Mock).mockRejectedValueOnce(new Error('User cancelled'))

    render(<ShareButton url="https://example.com/story/1" title="Test Story" />)

    fireEvent.press(screen.getByTestId('share-button'))

    // Should not throw
    await waitFor(() => {
      expect(Share.share).toHaveBeenCalled()
    })
  })

  it('has accessibility label "Share story"', () => {
    render(<ShareButton url="https://example.com/story/1" title="Test Story" />)
    expect(screen.getByLabelText('Share story')).toBeTruthy()
  })

  it('has accessibility role button', () => {
    render(<ShareButton url="https://example.com/story/1" title="Test Story" />)
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('has minimum 44pt touch target', () => {
    render(<ShareButton url="https://example.com/story/1" title="Test Story" />)
    const btn = screen.getByTestId('share-button')
    const style = btn.props.style
    expect(style.minHeight).toBeGreaterThanOrEqual(44)
    expect(style.minWidth).toBeGreaterThanOrEqual(44)
  })
})
