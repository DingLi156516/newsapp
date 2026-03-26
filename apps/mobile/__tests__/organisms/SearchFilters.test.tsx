import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

import { SearchFilters } from '@/components/organisms/SearchFilters'
import { ALL_BIASES } from '@/lib/shared/types'
import type { BiasCategory, DatePreset, FactualityLevel, Region, Topic } from '@/lib/shared/types'

function renderFilters(overrides: Partial<React.ComponentProps<typeof SearchFilters>> = {}) {
  const defaultProps = {
    topic: null as Topic | null,
    onTopicChange: jest.fn(),
    region: null as Region | null,
    onRegionChange: jest.fn(),
    biasRange: [...ALL_BIASES] as BiasCategory[],
    onBiasRangeChange: jest.fn(),
    minFactuality: null as FactualityLevel | null,
    onMinFactualityChange: jest.fn(),
    datePreset: 'all' as DatePreset,
    onDatePresetChange: jest.fn(),
    onClose: jest.fn(),
  }
  const props = { ...defaultProps, ...overrides }
  return { ...render(<SearchFilters {...props} />), props }
}

describe('SearchFilters', () => {
  it('renders all filter section labels', () => {
    renderFilters()
    expect(screen.getByText('REGION')).toBeTruthy()
    expect(screen.getByText('PERSPECTIVE')).toBeTruthy()
    expect(screen.getByText('BIAS RANGE')).toBeTruthy()
    expect(screen.getByText('MIN FACTUALITY')).toBeTruthy()
    expect(screen.getByText('DATE RANGE')).toBeTruthy()
  })

  it('calls onRegionChange when a region pill is pressed', () => {
    const { props } = renderFilters()
    fireEvent.press(screen.getByText('United States'))
    expect(props.onRegionChange).toHaveBeenCalledWith('us')
  })

  it('calls onDatePresetChange when a date preset is pressed', () => {
    const { props } = renderFilters()
    fireEvent.press(screen.getByText('24 Hours'))
    expect(props.onDatePresetChange).toHaveBeenCalledWith('24h')
  })

  it('calls onMinFactualityChange when a factuality pill is pressed', () => {
    const { props } = renderFilters()
    fireEvent.press(screen.getByText('High Factuality'))
    expect(props.onMinFactualityChange).toHaveBeenCalledWith('high')
  })

  it('shows clear button when filters are active and calls reset on press', () => {
    const { props } = renderFilters({ topic: 'politics' })
    const clearBtn = screen.getByText('Clear filters')
    expect(clearBtn).toBeTruthy()

    fireEvent.press(clearBtn)
    expect(props.onTopicChange).toHaveBeenCalledWith(null)
    expect(props.onRegionChange).toHaveBeenCalledWith(null)
    expect(props.onBiasRangeChange).toHaveBeenCalledWith(ALL_BIASES)
    expect(props.onMinFactualityChange).toHaveBeenCalledWith(null)
    expect(props.onDatePresetChange).toHaveBeenCalledWith('all')
  })

  it('hides clear button when no filters are active', () => {
    renderFilters()
    expect(screen.queryByText('Clear filters')).toBeNull()
  })
})
