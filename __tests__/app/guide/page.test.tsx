import { render, screen } from '@testing-library/react'
import GuidePage from '@/app/guide/page'
import { ALL_BIASES, ALL_FACTUALITIES, ALL_OWNERSHIPS, BIAS_LABELS, FACTUALITY_LABELS, OWNERSHIP_LABELS } from '@/lib/types'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
}))

vi.mock('@/components/organisms/UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}))

describe('GuidePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Guide heading', () => {
    render(<GuidePage />)
    expect(screen.getByText('Guide')).toBeInTheDocument()
  })

  it('renders all 5 section headings', () => {
    render(<GuidePage />)
    expect(screen.getByText('Bias Spectrum')).toBeInTheDocument()
    expect(screen.getByText('Factuality Ratings')).toBeInTheDocument()
    expect(screen.getByText('Blindspots')).toBeInTheDocument()
    expect(screen.getByText('Coverage & Sources')).toBeInTheDocument()
    expect(screen.getByText('Ownership Types')).toBeInTheDocument()
  })

  it('renders all 7 bias labels', () => {
    render(<GuidePage />)
    for (const bias of ALL_BIASES) {
      expect(screen.getByLabelText(`Bias: ${BIAS_LABELS[bias]}`)).toBeInTheDocument()
    }
  })

  it('renders all 5 factuality levels with labels', () => {
    render(<GuidePage />)
    for (const level of ALL_FACTUALITIES) {
      expect(screen.getByText(FACTUALITY_LABELS[level])).toBeInTheDocument()
    }
  })

  it('renders BlindspotBadge', () => {
    render(<GuidePage />)
    expect(screen.getByLabelText(/blindspot/i)).toBeInTheDocument()
  })

  it('renders CoverageCount with 12', () => {
    render(<GuidePage />)
    expect(screen.getByText('12 sources')).toBeInTheDocument()
  })

  it('renders all 8 ownership labels', () => {
    render(<GuidePage />)
    for (const type of ALL_OWNERSHIPS) {
      expect(screen.getByText(OWNERSHIP_LABELS[type])).toBeInTheDocument()
    }
  })

  it('section ids exist for anchor links', () => {
    const { container } = render(<GuidePage />)
    const ids = ['bias-spectrum', 'factuality', 'blindspots', 'coverage', 'ownership']
    for (const id of ids) {
      expect(container.querySelector(`#${id}`)).toBeInTheDocument()
    }
  })

  it('back button navigates to /', () => {
    render(<GuidePage />)
    const backButton = screen.getByText('Feed')
    backButton.click()
    expect(mockPush).toHaveBeenCalledWith('/')
  })
})
