import { render, screen } from '@testing-library/react'
import { ClaimsComparison } from '@/components/organisms/ClaimsComparison'

describe('ClaimsComparison', () => {
  const mockClaims = [
    {
      claim: 'The bill raises taxes on high earners',
      side: 'left' as const,
      disputed: true,
      counterClaim: 'Deductions offset any increase',
    },
    {
      claim: 'Economic growth will accelerate',
      side: 'right' as const,
      disputed: false,
    },
    {
      claim: 'Both parties agree on infrastructure',
      side: 'both' as const,
      disputed: false,
    },
  ]

  it('renders all claims', () => {
    render(<ClaimsComparison claims={mockClaims} />)
    expect(screen.getByText('The bill raises taxes on high earners')).toBeInTheDocument()
    expect(screen.getByText('Economic growth will accelerate')).toBeInTheDocument()
    expect(screen.getByText('Both parties agree on infrastructure')).toBeInTheDocument()
  })

  it('renders side badges', () => {
    render(<ClaimsComparison claims={mockClaims} />)
    expect(screen.getByText('Left')).toBeInTheDocument()
    expect(screen.getByText('Right')).toBeInTheDocument()
    expect(screen.getByText('Both')).toBeInTheDocument()
  })

  it('shows DISPUTED badge when claim is disputed', () => {
    render(<ClaimsComparison claims={mockClaims} />)
    expect(screen.getByText('DISPUTED')).toBeInTheDocument()
  })

  it('shows counter-claim when present', () => {
    render(<ClaimsComparison claims={mockClaims} />)
    expect(screen.getByText(/Deductions offset any increase/)).toBeInTheDocument()
  })

  it('renders section heading', () => {
    render(<ClaimsComparison claims={mockClaims} />)
    expect(screen.getByText('Key Claims')).toBeInTheDocument()
  })

  it('returns null for empty claims', () => {
    const { container } = render(<ClaimsComparison claims={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
