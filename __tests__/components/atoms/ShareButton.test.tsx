import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareButton } from '@/components/atoms/ShareButton'

vi.mock('framer-motion')

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
})
