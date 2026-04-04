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

  it('renders sentiment pills when sentiment is provided', () => {
    render(
      <AISummaryTabs
        {...defaultProps}
        sentiment={{ left: 'hopeful', right: 'critical' }}
      />
    )

    expect(screen.getByLabelText('Sentiment: Hopeful')).toBeTruthy()
    expect(screen.getByLabelText('Sentiment: Critical')).toBeTruthy()
  })

  it('does not render sentiment pills when sentiment is null', () => {
    render(<AISummaryTabs {...defaultProps} sentiment={null} />)

    expect(screen.queryByLabelText(/Sentiment:/)).toBeNull()
  })

  it('tabs have accessibilityRole="tab" and selected state', () => {
    render(<AISummaryTabs {...defaultProps} />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)

    // Common Ground is selected by default
    expect(tabs[0].props.accessibilityState).toEqual({ selected: true })
    expect(tabs[1].props.accessibilityState).toEqual({ selected: false })
    expect(tabs[2].props.accessibilityState).toEqual({ selected: false })
  })

  it('updates selected state when switching tabs', () => {
    render(<AISummaryTabs {...defaultProps} />)

    fireEvent.press(screen.getByText('Left'))

    const tabs = screen.getAllByRole('tab')
    expect(tabs[0].props.accessibilityState).toEqual({ selected: false })
    expect(tabs[1].props.accessibilityState).toEqual({ selected: true })
    expect(tabs[2].props.accessibilityState).toEqual({ selected: false })
  })

  describe('single-source mode', () => {
    it('renders only 1 "Summary" tab when sourceCount is 1', () => {
      render(<AISummaryTabs {...defaultProps} sourceCount={1} />)

      expect(screen.getByText('Summary')).toBeTruthy()
      expect(screen.queryByText('Common Ground')).toBeNull()
      expect(screen.queryByText('Left')).toBeNull()
      expect(screen.queryByText('Right')).toBeNull()
    })

    it('shows common ground content in the Summary tab', () => {
      render(<AISummaryTabs {...defaultProps} sourceCount={1} />)

      expect(screen.getByText(/Both sides agree/)).toBeTruthy()
    })

    it('has only 1 tab element', () => {
      render(<AISummaryTabs {...defaultProps} sourceCount={1} />)

      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(1)
    })
  })

  describe('backward compatibility', () => {
    it('renders 3 tabs when sourceCount is undefined', () => {
      render(<AISummaryTabs {...defaultProps} />)

      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(3)
    })

    it('renders 3 tabs when sourceCount > 1', () => {
      render(<AISummaryTabs {...defaultProps} sourceCount={5} />)

      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(3)
      expect(screen.getByText('Common Ground')).toBeTruthy()
    })
  })
})
