import { render, screen } from '@testing-library/react'
import { HeadlineComparison } from '@/components/organisms/HeadlineComparison'

describe('HeadlineComparison', () => {
  const mockHeadlines = [
    { title: 'Progressive Bill Passes House', sourceName: 'CNN', sourceBias: 'lean-left' as const },
    { title: 'Tax Bill Clears Committee', sourceName: 'Reuters', sourceBias: 'center' as const },
    { title: 'Spending Bill Faces Opposition', sourceName: 'Fox News', sourceBias: 'right' as const },
  ]

  it('renders all headlines', () => {
    render(<HeadlineComparison headlines={mockHeadlines} />)
    expect(screen.getByText('Progressive Bill Passes House')).toBeInTheDocument()
    expect(screen.getByText('Tax Bill Clears Committee')).toBeInTheDocument()
    expect(screen.getByText('Spending Bill Faces Opposition')).toBeInTheDocument()
  })

  it('renders source names', () => {
    render(<HeadlineComparison headlines={mockHeadlines} />)
    expect(screen.getByText(/CNN/)).toBeInTheDocument()
    expect(screen.getByText(/Reuters/)).toBeInTheDocument()
    expect(screen.getByText(/Fox News/)).toBeInTheDocument()
  })

  it('renders section heading', () => {
    render(<HeadlineComparison headlines={mockHeadlines} />)
    expect(screen.getByText('How They Headlined It')).toBeInTheDocument()
  })

  it('returns null for empty headlines', () => {
    const { container } = render(<HeadlineComparison headlines={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('has aria label on section', () => {
    render(<HeadlineComparison headlines={mockHeadlines} />)
    expect(screen.getByLabelText('Headline comparison across outlets')).toBeInTheDocument()
  })
})
