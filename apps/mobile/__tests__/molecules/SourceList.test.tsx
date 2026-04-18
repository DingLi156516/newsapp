import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { SourceList } from '@/components/molecules/SourceList'
import type { MediaOwner, NewsSource } from '@/lib/shared/types'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

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
  { id: 's1', slug: 'reuters', name: 'Reuters', bias: 'center', factuality: 'very-high', ownership: 'independent' },
  { id: 's2', slug: 'cnn', name: 'CNN', bias: 'lean-left', factuality: 'high', ownership: 'corporate' },
  { id: 's3', slug: 'fox-news', name: 'Fox News', bias: 'right', factuality: 'mixed', ownership: 'corporate' },
]

describe('SourceList', () => {
  it('renders a group per non-empty bucket', () => {
    render(<SourceList sources={mockSources} />)

    expect(screen.getByTestId('source-lean-group-left')).toBeTruthy()
    expect(screen.getByTestId('source-lean-group-center')).toBeTruthy()
    expect(screen.getByTestId('source-lean-group-right')).toBeTruthy()
  })

  it('expands the first non-empty group by default', () => {
    render(<SourceList sources={mockSources} />)

    // Left group is first non-empty → CNN is visible
    expect(screen.getByText('CNN')).toBeTruthy()
  })

  it('keeps non-default groups collapsed until tapped', () => {
    render(<SourceList sources={mockSources} />)

    // Right group is collapsed, so Fox News should not be visible yet
    expect(screen.queryByText('Fox News')).toBeNull()

    fireEvent.press(screen.getByTestId('source-lean-group-right-header'))
    expect(screen.getByText('Fox News')).toBeTruthy()
  })

  it('handles empty list', () => {
    const { toJSON } = render(<SourceList sources={[]} />)
    expect(toJSON()).toBeTruthy()
  })

  it('buckets all 7 bias tiers correctly into 3 groups', () => {
    const sources: NewsSource[] = [
      { id: '1', slug: 's1', name: 'FL', bias: 'far-left', factuality: 'high', ownership: 'independent' },
      { id: '2', slug: 's2', name: 'L', bias: 'left', factuality: 'high', ownership: 'independent' },
      { id: '3', slug: 's3', name: 'LL', bias: 'lean-left', factuality: 'high', ownership: 'independent' },
      { id: '4', slug: 's4', name: 'C', bias: 'center', factuality: 'high', ownership: 'independent' },
      { id: '5', slug: 's5', name: 'LR', bias: 'lean-right', factuality: 'high', ownership: 'independent' },
      { id: '6', slug: 's6', name: 'R', bias: 'right', factuality: 'high', ownership: 'independent' },
      { id: '7', slug: 's7', name: 'FR', bias: 'far-right', factuality: 'high', ownership: 'independent' },
    ]
    render(<SourceList sources={sources} />)

    // 3/7 left (≈43%), 1/7 center (14%), 3/7 right (43%)
    expect(screen.getAllByText('43% · 3 sources')).toHaveLength(2)
    expect(screen.getByText('14% · 1 source')).toBeTruthy()
  })

  it('single source renders only one group', () => {
    const sources: NewsSource[] = [
      { id: 's1', slug: 'reuters', name: 'Reuters', bias: 'center', factuality: 'very-high', ownership: 'independent' },
    ]
    render(<SourceList sources={sources} />)

    expect(screen.getByTestId('source-lean-group-center')).toBeTruthy()
    expect(screen.queryByTestId('source-lean-group-left')).toBeNull()
    expect(screen.queryByTestId('source-lean-group-right')).toBeNull()
  })

  it('sorts sources within a group by factuality desc then name', () => {
    const sources: NewsSource[] = [
      { id: 's1', slug: 'alpha', name: 'Alpha Times', bias: 'lean-left', factuality: 'mixed', ownership: 'independent' },
      { id: 's2', slug: 'beta', name: 'Beta Herald', bias: 'lean-left', factuality: 'very-high', ownership: 'independent' },
      { id: 's3', slug: 'charlie', name: 'Charlie Chronicle', bias: 'lean-left', factuality: 'very-high', ownership: 'independent' },
    ]
    render(<SourceList sources={sources} />)

    // `queryAllByTestId` matches regex against testID; queries return nodes
    // in document order, which maps to render order. Sorted order:
    //   very-high first (Beta, Charlie alpha-sorted) then mixed (Alpha).
    const rows = screen
      .queryAllByTestId(/^source-row-/)
      .map((n) => n.props.testID as string)

    expect(rows).toEqual(['source-row-s2', 'source-row-s3', 'source-row-s1'])
  })

  it('caps visible sources at 5 and reveals the rest when "Show more" is tapped', () => {
    const sources: NewsSource[] = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i + 1}`,
      slug: `source-${i + 1}`,
      name: `Source ${i + 1}`,
      bias: 'lean-left',
      factuality: 'high',
      ownership: 'independent',
    }))
    render(<SourceList sources={sources} />)

    // Initially only 5 of 8 are visible
    expect(screen.queryByText('Source 1')).toBeTruthy()
    expect(screen.queryByText('Source 5')).toBeTruthy()
    expect(screen.queryByText('Source 6')).toBeNull()
    expect(screen.queryByText('Source 8')).toBeNull()

    const overflow = screen.getByTestId('source-lean-group-left-overflow')
    expect(overflow).toBeTruthy()

    fireEvent.press(overflow)

    // All 8 are now visible; overflow pill is gone
    expect(screen.queryByText('Source 6')).toBeTruthy()
    expect(screen.queryByText('Source 8')).toBeTruthy()
    expect(screen.queryByTestId('source-lean-group-left-overflow')).toBeNull()
  })

  it('renders owner chips when 2+ sources share the same owner within a group', () => {
    const warner = makeOwner('warner', 'Warner Bros. Discovery')
    const sources: NewsSource[] = [
      { id: 's1', slug: 'cnn', name: 'CNN', bias: 'lean-left', factuality: 'high', ownership: 'corporate', owner: warner },
      { id: 's2', slug: 'hbo', name: 'HBO', bias: 'lean-left', factuality: 'high', ownership: 'corporate', owner: warner },
    ]
    render(<SourceList sources={sources} />)

    expect(screen.getByTestId('source-lean-group-left-owners')).toBeTruthy()
    expect(screen.getByText('2 from Warner Bros. Discovery')).toBeTruthy()
  })
})
