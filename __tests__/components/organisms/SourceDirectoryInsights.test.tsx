import { render, screen } from '@testing-library/react'
import { SourceDirectoryInsights } from '@/components/organisms/SourceDirectoryInsights'
import type { NewsSource } from '@/lib/types'

const sources: NewsSource[] = [
  {
    id: '1',
    name: 'Reuters',
    bias: 'center',
    factuality: 'very-high',
    ownership: 'corporate',
    region: 'international',
    url: 'reuters.com',
  },
  {
    id: '2',
    name: 'BBC News',
    bias: 'center',
    factuality: 'very-high',
    ownership: 'state-funded',
    region: 'uk',
    url: 'bbc.com',
  },
  {
    id: '3',
    name: 'AP News',
    bias: 'center',
    factuality: 'very-high',
    ownership: 'corporate',
    region: 'us',
    url: 'apnews.com',
  },
]

describe('SourceDirectoryInsights', () => {
  it('renders count, leading ownership, and represented regions', () => {
    render(<SourceDirectoryInsights sources={sources} />)

    expect(screen.getByText('3 active sources in this directory.')).toBeInTheDocument()
    expect(screen.getByText('Ownership is led by corporate outlets in the current view.')).toBeInTheDocument()
    expect(screen.getByText('Regions represented: International, United Kingdom, United States.')).toBeInTheDocument()
  })

  it('handles an empty list gracefully', () => {
    render(<SourceDirectoryInsights sources={[]} />)

    expect(screen.getByText('0 active sources in this directory.')).toBeInTheDocument()
    expect(screen.getByText('Ownership mix will appear here as sources load.')).toBeInTheDocument()
    expect(screen.getByText('Regions represented: None.')).toBeInTheDocument()
  })
})
