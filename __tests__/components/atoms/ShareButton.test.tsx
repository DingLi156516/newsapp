import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareButton } from '@/components/atoms/ShareButton'

vi.mock('framer-motion')
vi.mock('@/lib/hooks/use-telemetry-consent', () => ({
  useTelemetryConsent: () => true,
}))

describe('ShareButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    })
  })

  it('renders with aria-label', () => {
    render(<ShareButton url="/story/1" title="Test Story" />)
    expect(screen.getByLabelText('Share Test Story')).toBeInTheDocument()
  })

  it('has the correct data-testid', () => {
    render(<ShareButton url="/story/1" title="Test Story" />)
    expect(screen.getByTestId('share-button')).toBeInTheDocument()
  })

  it('shows "Link copied!" toast after clicking (clipboard fallback)', async () => {
    const user = userEvent.setup()
    render(<ShareButton url="/story/1" title="Test Story" />)
    await user.click(screen.getByTestId('share-button'))
    await waitFor(() => {
      expect(screen.getByText('Link copied!')).toBeInTheDocument()
    })
  })

  it('emits a share telemetry event when storyId is provided', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
    vi.stubGlobal('fetch', fetchSpy)
    const user = userEvent.setup()
    render(<ShareButton url="/story/1" title="Test Story" storyId="550e8400-e29b-41d4-a716-446655440000" />)
    await user.click(screen.getByTestId('share-button'))
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/events/story',
        expect.objectContaining({ method: 'POST' })
      )
    })
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toMatchObject({
      storyId: '550e8400-e29b-41d4-a716-446655440000',
      action: 'share',
      client: 'web',
    })
    vi.unstubAllGlobals()
  })

  it('does not emit a telemetry event without storyId', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
    vi.stubGlobal('fetch', fetchSpy)
    const user = userEvent.setup()
    render(<ShareButton url="/story/1" title="Test Story" />)
    await user.click(screen.getByTestId('share-button'))
    await waitFor(() => {
      expect(screen.getByText('Link copied!')).toBeInTheDocument()
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
