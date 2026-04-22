import React from 'react'
import { Share } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'

jest.mock('@/lib/hooks/fetcher', () => ({
  authFetch: jest.fn(() => Promise.resolve({ ok: true })),
}))

jest.mock('@/lib/hooks/use-session-id', () => ({
  useSessionId: jest.fn(() => ({ sessionId: 'sess-1', ready: true })),
}))

jest.mock('@/lib/hooks/use-telemetry-consent', () => ({
  useTelemetryConsent: jest.fn(() => ({ consent: true, ready: true })),
}))

import { ShareButton } from '@/components/atoms/ShareButton'
import { authFetch } from '@/lib/hooks/fetcher'
import { useTelemetryConsent } from '@/lib/hooks/use-telemetry-consent'

const mockFetch = authFetch as jest.Mock
const mockConsent = useTelemetryConsent as jest.Mock

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

  it('emits a share telemetry event when storyId is provided', async () => {
    mockFetch.mockClear()
    render(<ShareButton url="/story/123" title="X" storyId="550e8400-e29b-41d4-a716-446655440000" />)
    fireEvent.press(screen.getByTestId('share-button'))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/events/story',
        expect.objectContaining({ method: 'POST' })
      )
    })
    const call = mockFetch.mock.calls[0]
    expect(JSON.parse(call[1].body)).toMatchObject({
      storyId: '550e8400-e29b-41d4-a716-446655440000',
      action: 'share',
      client: 'mobile',
    })
    expect(call[1].headers['x-session-id']).toBe('sess-1')
  })

  it('does not emit a share telemetry event when storyId is omitted', async () => {
    mockFetch.mockClear()
    render(<ShareButton url="https://example.com/story/1" title="X" />)
    fireEvent.press(screen.getByTestId('share-button'))
    await waitFor(() => {
      expect(Share.share).toHaveBeenCalled()
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not emit a share telemetry event when consent is denied', async () => {
    mockFetch.mockClear()
    mockConsent.mockReturnValueOnce({ consent: false, ready: true })
    render(<ShareButton url="/story/1" title="X" storyId="550e8400-e29b-41d4-a716-446655440000" />)
    fireEvent.press(screen.getByTestId('share-button'))
    await waitFor(() => {
      expect(Share.share).toHaveBeenCalled()
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
