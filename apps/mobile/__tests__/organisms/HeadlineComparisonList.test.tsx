import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { HeadlineComparisonList } from '@/components/organisms/HeadlineComparisonList'

describe('HeadlineComparisonList', () => {
  it('returns null for empty headlines', () => {
    const { toJSON } = render(<HeadlineComparisonList headlines={[]} />)
    expect(toJSON()).toBeNull()
  })

  it('renders section title', () => {
    render(
      <HeadlineComparisonList headlines={[
        { title: 'Test Headline', sourceName: 'CNN', sourceBias: 'lean-left' },
      ]} />
    )
    expect(screen.getByText('How They Headlined It')).toBeTruthy()
  })

  it('renders outlet count in subtitle', () => {
    render(
      <HeadlineComparisonList headlines={[
        { title: 'Headline 1', sourceName: 'CNN', sourceBias: 'lean-left' },
        { title: 'Headline 2', sourceName: 'Fox News', sourceBias: 'right' },
      ]} />
    )
    expect(screen.getByText('2 outlets')).toBeTruthy()
  })
})
