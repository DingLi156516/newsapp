import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { SourceList } from '@/components/molecules/SourceList'
import type { MediaOwner, NewsSource } from '@/lib/shared/types'

function makeOwner(id: string, name: string): MediaOwner {
  return {
    id,
    name,
    slug: id,
    ownerType: 'public_company',
    isIndividual: false,
    country: 'US',
    wikidataQid: null,
    ownerSource: 'manual',
    ownerVerifiedAt: '2026-01-01T00:00:00Z',
  }
}

const mockSources: NewsSource[] = [
  { id: 's1', name: 'Reuters', bias: 'center', factuality: 'very-high', ownership: 'independent' },
  { id: 's2', name: 'CNN', bias: 'lean-left', factuality: 'high', ownership: 'corporate' },
  { id: 's3', name: 'Fox News', bias: 'right', factuality: 'mixed', ownership: 'corporate' },
]

describe('SourceList', () => {
  it('renders source names', () => {
    render(<SourceList sources={mockSources} />)

    expect(screen.getByText('Reuters')).toBeTruthy()
    expect(screen.getByText('CNN')).toBeTruthy()
    expect(screen.getByText('Fox News')).toBeTruthy()
  })

  it('renders source logos for each source', () => {
    render(<SourceList sources={mockSources} />)

    const logos = screen.getAllByTestId('source-logo-fallback')
    expect(logos).toHaveLength(mockSources.length)
  })

  it('handles empty list', () => {
    const { toJSON } = render(<SourceList sources={[]} />)
    expect(toJSON()).toBeTruthy()
  })

  it('renders owner chips when 2+ sources share the same owner', () => {
    const warner = makeOwner('warner', 'Warner Bros. Discovery')
    const sources: NewsSource[] = [
      { id: 's1', name: 'CNN', bias: 'lean-left', factuality: 'high', ownership: 'corporate', owner: warner },
      { id: 's2', name: 'HBO', bias: 'center', factuality: 'high', ownership: 'corporate', owner: warner },
      { id: 's3', name: 'Indie', bias: 'center', factuality: 'high', ownership: 'independent' },
    ]
    render(<SourceList sources={sources} />)

    expect(screen.getByTestId('source-list-owner-chips')).toBeTruthy()
    expect(screen.getByText('2 from Warner Bros. Discovery')).toBeTruthy()
  })

  it('does not render owner chips when no owner has 2+ sources', () => {
    const warner = makeOwner('warner', 'Warner Bros. Discovery')
    const sources: NewsSource[] = [
      { id: 's1', name: 'CNN', bias: 'lean-left', factuality: 'high', ownership: 'corporate', owner: warner },
      { id: 's2', name: 'Indie', bias: 'center', factuality: 'high', ownership: 'independent' },
    ]
    render(<SourceList sources={sources} />)
    expect(screen.queryByTestId('source-list-owner-chips')).toBeNull()
  })
})
