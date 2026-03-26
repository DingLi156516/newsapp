import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { CoverageCount } from '@/components/atoms/CoverageCount'

describe('CoverageCount', () => {
  it('renders "3 sources" for count=3', () => {
    render(<CoverageCount count={3} />)
    expect(screen.getByText('3 sources')).toBeTruthy()
  })

  it('renders "Single Source" for count=1', () => {
    render(<CoverageCount count={1} />)
    expect(screen.getByText('Single Source')).toBeTruthy()
  })

  it('renders "12 sources" for count=12', () => {
    render(<CoverageCount count={12} />)
    expect(screen.getByText('12 sources')).toBeTruthy()
  })

  it('has accessibility label with correct pluralization', () => {
    const { rerender } = render(<CoverageCount count={1} />)
    expect(screen.getByLabelText('Single Source')).toBeTruthy()

    rerender(<CoverageCount count={5} />)
    expect(screen.getByLabelText('5 sources')).toBeTruthy()
  })

  it('applies amber background for single-source stories', () => {
    render(<CoverageCount count={1} />)
    const badge = screen.getByLabelText('Single Source')
    expect(badge.props.style.backgroundColor).toBe('rgba(245, 158, 11, 0.12)')
  })
})
