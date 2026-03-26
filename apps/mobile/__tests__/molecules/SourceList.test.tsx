import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { SourceList } from '@/components/molecules/SourceList'
import type { NewsSource } from '@/lib/shared/types'

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
})
