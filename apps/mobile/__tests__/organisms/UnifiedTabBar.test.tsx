import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

import { UnifiedTabBar } from '@/components/organisms/UnifiedTabBar'
import type { UnifiedTab } from '@/lib/shared/types'

const visibleTabs: UnifiedTab[] = ['for-you', 'trending', 'latest', 'politics', 'technology']

describe('UnifiedTabBar', () => {
  it('renders all visible tabs', () => {
    render(<UnifiedTabBar value="trending" onChange={jest.fn()} visibleTabs={visibleTabs} />)
    expect(screen.getByTestId('feed-tab-for-you')).toBeTruthy()
    expect(screen.getByTestId('feed-tab-trending')).toBeTruthy()
    expect(screen.getByTestId('feed-tab-latest')).toBeTruthy()
    expect(screen.getByTestId('feed-tab-politics')).toBeTruthy()
    expect(screen.getByTestId('feed-tab-technology')).toBeTruthy()
  })

  it('does not render tabs not in visibleTabs', () => {
    render(<UnifiedTabBar value="trending" onChange={jest.fn()} visibleTabs={['trending', 'politics']} />)
    expect(screen.queryByTestId('feed-tab-for-you')).toBeNull()
    expect(screen.queryByTestId('feed-tab-latest')).toBeNull()
    expect(screen.getByTestId('feed-tab-trending')).toBeTruthy()
    expect(screen.getByTestId('feed-tab-politics')).toBeTruthy()
  })

  it('calls onChange with tab value when pressed', () => {
    const onChange = jest.fn()
    render(<UnifiedTabBar value="trending" onChange={onChange} visibleTabs={visibleTabs} />)

    fireEvent.press(screen.getByTestId('feed-tab-politics'))
    expect(onChange).toHaveBeenCalledWith('politics')
  })

  it('displays correct labels for feed tabs and topic tabs', () => {
    render(<UnifiedTabBar value="trending" onChange={jest.fn()} visibleTabs={['trending', 'politics']} />)
    expect(screen.getByText('Trending')).toBeTruthy()
    expect(screen.getByText('Politics')).toBeTruthy()
  })
})
