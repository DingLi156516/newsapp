import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

import { StickyFilterBar } from '@/components/organisms/StickyFilterBar'
import { ALL_BIASES } from '@/lib/shared/types'
import type { BiasCategory, DatePreset, FactualityLevel, Region, Topic } from '@/lib/shared/types'

const defaultProps = {
  topic: null as Topic | null,
  onClearTopic: jest.fn(),
  region: null as Region | null,
  onClearRegion: jest.fn(),
  biasRange: [...ALL_BIASES] as BiasCategory[],
  onClearBiasRange: jest.fn(),
  minFactuality: null as FactualityLevel | null,
  onClearMinFactuality: jest.fn(),
  datePreset: 'all' as DatePreset,
  onClearDatePreset: jest.fn(),
}

describe('StickyFilterBar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when no filters are active', () => {
    const { toJSON } = render(<StickyFilterBar {...defaultProps} />)
    expect(toJSON()).toBeNull()
  })

  it('shows topic chip when topic is set', () => {
    render(<StickyFilterBar {...defaultProps} topic="politics" />)
    expect(screen.getByText('Politics')).toBeTruthy()
  })

  it('shows region chip when region is set', () => {
    render(<StickyFilterBar {...defaultProps} region="us" />)
    expect(screen.getByText('United States')).toBeTruthy()
  })

  it('shows bias chip when bias range is filtered', () => {
    render(<StickyFilterBar {...defaultProps} biasRange={['center', 'lean-left']} />)
    expect(screen.getByText('Bias filtered')).toBeTruthy()
  })

  it('shows factuality chip when min factuality is set', () => {
    render(<StickyFilterBar {...defaultProps} minFactuality="high" />)
    expect(screen.getByText('High Factuality')).toBeTruthy()
  })

  it('shows date chip when date preset is not all', () => {
    render(<StickyFilterBar {...defaultProps} datePreset="24h" />)
    expect(screen.getByText('24 Hours')).toBeTruthy()
  })

  it('calls onClearTopic when topic chip X is pressed', () => {
    const onClearTopic = jest.fn()
    render(<StickyFilterBar {...defaultProps} topic="politics" onClearTopic={onClearTopic} />)
    const chips = screen.getAllByTestId('filter-chip-dismiss')
    fireEvent.press(chips[0])
    expect(onClearTopic).toHaveBeenCalled()
  })
})
