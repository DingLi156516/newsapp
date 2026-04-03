import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { MomentumBadge } from '@/components/atoms/MomentumBadge'

describe('MomentumBadge', () => {
  it('renders "Breaking" label for breaking phase', () => {
    render(<MomentumBadge phase="breaking" />)
    expect(screen.getByText('Breaking')).toBeTruthy()
  })

  it('renders "Developing" label for developing phase', () => {
    render(<MomentumBadge phase="developing" />)
    expect(screen.getByText('Developing')).toBeTruthy()
  })

  it('renders "Analysis" label for analysis phase', () => {
    render(<MomentumBadge phase="analysis" />)
    expect(screen.getByText('Analysis')).toBeTruthy()
  })

  it('returns null for aftermath phase', () => {
    const { toJSON } = render(<MomentumBadge phase="aftermath" />)
    expect(toJSON()).toBeNull()
  })

  it('has accessibility label', () => {
    render(<MomentumBadge phase="breaking" />)
    expect(screen.getByLabelText('Story phase: Breaking')).toBeTruthy()
  })
})
