import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { MonochromeSpectrumBar } from '@/components/molecules/MonochromeSpectrumBar'

describe('MonochromeSpectrumBar', () => {
  it('renders with segments', () => {
    const segments = [
      { bias: 'left' as const, percentage: 40 },
      { bias: 'center' as const, percentage: 30 },
      { bias: 'right' as const, percentage: 30 },
    ]

    const { toJSON } = render(<MonochromeSpectrumBar segments={segments} />)
    expect(toJSON()).not.toBeNull()
  })

  it('returns null for empty segments', () => {
    const { toJSON } = render(<MonochromeSpectrumBar segments={[]} />)
    expect(toJSON()).toBeNull()
  })

  it('returns null when all percentages are zero', () => {
    const segments = [
      { bias: 'center' as const, percentage: 0 },
    ]

    const { toJSON } = render(<MonochromeSpectrumBar segments={segments} />)
    expect(toJSON()).toBeNull()
  })

  it('has accessibility label with bias percentages', () => {
    const segments = [
      { bias: 'left' as const, percentage: 40 },
      { bias: 'center' as const, percentage: 30 },
      { bias: 'right' as const, percentage: 30 },
    ]

    render(<MonochromeSpectrumBar segments={segments} />)
    expect(screen.getByLabelText(/Bias spectrum:.*Left 40%.*Center 30%.*Right 30%/)).toBeTruthy()
  })
})
