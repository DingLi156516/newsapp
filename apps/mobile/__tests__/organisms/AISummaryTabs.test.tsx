import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { AISummaryTabs } from '@/components/organisms/AISummaryTabs'

describe('AISummaryTabs', () => {
  const defaultProps = {
    commonGround: 'Both sides agree on the core facts.',
    leftFraming: 'Progressive outlets emphasize equity.',
    rightFraming: 'Conservative outlets emphasize freedom.',
  }

  it('renders all 3 tab labels', () => {
    render(<AISummaryTabs {...defaultProps} />)

    expect(screen.getByText('Common Ground')).toBeTruthy()
    expect(screen.getByText('Left')).toBeTruthy()
    expect(screen.getByText('Right')).toBeTruthy()
  })

  it('shows Common Ground content by default', () => {
    render(<AISummaryTabs {...defaultProps} />)

    expect(screen.getByText(/Both sides agree/)).toBeTruthy()
  })

  it('switches content when a different tab is pressed', () => {
    render(<AISummaryTabs {...defaultProps} />)

    fireEvent.press(screen.getByText('Left'))
    expect(screen.getByText(/Progressive outlets/)).toBeTruthy()
  })
})
