import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { BiasLegend } from '@/components/molecules/BiasLegend'

describe('BiasLegend', () => {
  it('renders all 7 bias category labels', () => {
    render(<BiasLegend />)

    expect(screen.getByText('Far Left')).toBeTruthy()
    expect(screen.getByText('Left')).toBeTruthy()
    expect(screen.getByText('Lean Left')).toBeTruthy()
    expect(screen.getByText('Center')).toBeTruthy()
    expect(screen.getByText('Lean Right')).toBeTruthy()
    expect(screen.getByText('Right')).toBeTruthy()
    expect(screen.getByText('Far Right')).toBeTruthy()
  })
})
