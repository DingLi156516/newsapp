import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'

describe('BlindspotBadge', () => {
  it('renders "Blindspot" text', () => {
    render(<BlindspotBadge />)
    expect(screen.getByText('Blindspot')).toBeTruthy()
  })

  it('has accessibility label', () => {
    render(<BlindspotBadge />)
    expect(screen.getByLabelText('Blindspot story')).toBeTruthy()
  })
})
