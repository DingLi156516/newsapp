import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { ScoreGauge } from '@/components/atoms/ScoreGauge'

describe('ScoreGauge', () => {
  it('renders label and value', () => {
    render(<ScoreGauge label="Impact" value={72} />)
    expect(screen.getByText('Impact')).toBeTruthy()
    expect(screen.getByText('72')).toBeTruthy()
  })

  it('renders with zero value', () => {
    render(<ScoreGauge label="Diversity" value={0} />)
    expect(screen.getByText('0')).toBeTruthy()
  })

  it('displays non-integer values to one decimal place', () => {
    render(<ScoreGauge label="Score" value={85.7} />)
    expect(screen.getByText('85.7')).toBeTruthy()
  })
})
