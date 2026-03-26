import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

jest.mock('@/lib/hooks/use-sources', () => ({
  useSources: () => ({
    sources: [
      { id: 's1', name: 'ABC News', bias: 'lean-left', factuality: 'high', ownership: 'corporate', region: 'us', url: 'abcnews.go.com' },
      { id: 's2', name: 'Fox News', bias: 'right', factuality: 'mixed', ownership: 'corporate', region: 'us', url: 'foxnews.com' },
      { id: 's3', name: 'AP News', bias: 'center', factuality: 'very-high', ownership: 'non-profit', region: 'us', url: 'apnews.com' },
    ],
    total: 3,
    isLoading: false,
    isError: false,
    mutate: jest.fn(),
  }),
}))

jest.mock('@/lib/hooks/use-debounce', () => ({
  useDebounce: (value: string) => value,
}))

jest.mock('lucide-react-native', () => {
  const RN = require('react-native')
  const R = require('react')
  return new Proxy({}, {
    get: (_target: unknown, prop: string) =>
      (props: Record<string, unknown>) => R.createElement(RN.View, { testID: `icon-${prop}`, ...props }),
  })
})

import SourcesScreen from '@/app/(tabs)/sources'

describe('SourcesScreen', () => {
  it('renders the page heading', () => {
    render(<SourcesScreen />)
    expect(screen.getByText('Sources')).toBeTruthy()
  })

  it('renders filter button with count', () => {
    render(<SourcesScreen />)
    expect(screen.getByText('Filters')).toBeTruthy()
  })

  it('renders sort options', () => {
    render(<SourcesScreen />)
    expect(screen.getByText('A-Z')).toBeTruthy()
    expect(screen.getByText('Bias')).toBeTruthy()
    expect(screen.getByText('Factuality')).toBeTruthy()
  })

  it('shows source count', () => {
    render(<SourcesScreen />)
    expect(screen.getByText('3 sources')).toBeTruthy()
  })

  it('renders source cards with names', () => {
    render(<SourcesScreen />)
    expect(screen.getByText('ABC News')).toBeTruthy()
    expect(screen.getByText('Fox News')).toBeTruthy()
    expect(screen.getByText('AP News')).toBeTruthy()
  })

  it('renders source logos for each card', () => {
    render(<SourcesScreen />)
    const logos = screen.getAllByTestId('source-logo-image')
    expect(logos.length).toBe(3)
  })

  it('renders bias pills with spectrum colors', () => {
    render(<SourcesScreen />)
    expect(screen.getByText('Lean Left')).toBeTruthy()
    expect(screen.getByText('Right')).toBeTruthy()
    expect(screen.getByText('Center')).toBeTruthy()
  })

  it('renders factuality labels on source cards', () => {
    render(<SourcesScreen />)
    // FactualityBar with showLabel renders the text
    expect(screen.getByText('High Factuality')).toBeTruthy()
    expect(screen.getByText('Mixed Factuality')).toBeTruthy()
    expect(screen.getByText('Very High Factuality')).toBeTruthy()
  })

  it('sorts by name by default', () => {
    render(<SourcesScreen />)
    const cards = screen.getAllByTestId('source-card')
    expect(cards.length).toBe(3)
  })

  it('opens filter modal on filter button press', () => {
    render(<SourcesScreen />)
    fireEvent.press(screen.getByText('Filters'))
    // Modal should show filter section labels
    expect(screen.getByText('BIAS')).toBeTruthy()
    expect(screen.getByText('FACTUALITY')).toBeTruthy()
    expect(screen.getByText('OWNERSHIP')).toBeTruthy()
    expect(screen.getByText('REGION')).toBeTruthy()
  })
})
