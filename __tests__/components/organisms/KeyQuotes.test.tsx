import { render, screen } from '@testing-library/react'
import { KeyQuotes } from '@/components/organisms/KeyQuotes'

describe('KeyQuotes', () => {
  const mockQuotes = [
    { text: 'This is a very important development', sourceName: 'CNN', sourceBias: 'lean-left' },
    { text: 'The market will respond positively', sourceName: 'WSJ', sourceBias: 'center' },
  ]

  it('renders all quotes', () => {
    render(<KeyQuotes quotes={mockQuotes} />)
    expect(screen.getByText(/This is a very important development/)).toBeInTheDocument()
    expect(screen.getByText(/The market will respond positively/)).toBeInTheDocument()
  })

  it('renders source attribution', () => {
    render(<KeyQuotes quotes={mockQuotes} />)
    expect(screen.getByText(/CNN/)).toBeInTheDocument()
    expect(screen.getByText(/WSJ/)).toBeInTheDocument()
  })

  it('renders section heading', () => {
    render(<KeyQuotes quotes={mockQuotes} />)
    expect(screen.getByText('Key Quotes')).toBeInTheDocument()
  })

  it('returns null for empty quotes', () => {
    const { container } = render(<KeyQuotes quotes={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
