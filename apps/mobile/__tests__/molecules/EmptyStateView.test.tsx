import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

import { EmptyStateView } from '@/components/molecules/EmptyStateView'

jest.mock('lucide-react-native', () => {
  const RN = require('react-native')
  const R = require('react')
  return {
    SearchX: (props: Record<string, unknown>) => R.createElement(RN.View, { testID: 'icon-search', ...props }),
    Inbox: (props: Record<string, unknown>) => R.createElement(RN.View, { testID: 'icon-inbox', ...props }),
    BookOpen: (props: Record<string, unknown>) => R.createElement(RN.View, { testID: 'icon-book', ...props }),
    Zap: (props: Record<string, unknown>) => R.createElement(RN.View, { testID: 'icon-lightning', ...props }),
    Bookmark: (props: Record<string, unknown>) => R.createElement(RN.View, { testID: 'icon-bookmark', ...props }),
  }
})

describe('EmptyStateView', () => {
  it('renders the provided message', () => {
    render(<EmptyStateView message="No stories found" />)
    expect(screen.getByText('No stories found')).toBeTruthy()
  })

  it('renders with a custom message', () => {
    render(<EmptyStateView message="Your reading history is empty" />)
    expect(screen.getByText('Your reading history is empty')).toBeTruthy()
  })

  it('renders title when provided', () => {
    render(<EmptyStateView message="Body text" title="No Matches" />)
    expect(screen.getByText('No Matches')).toBeTruthy()
    expect(screen.getByText('Body text')).toBeTruthy()
  })

  it('renders action button when onAction provided', () => {
    const onAction = jest.fn()
    render(<EmptyStateView message="Empty" actionLabel="Clear Filters" onAction={onAction} />)

    const btn = screen.getByText('Clear Filters')
    expect(btn).toBeTruthy()
    fireEvent.press(screen.getByTestId('empty-state-action'))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('does not render action button when onAction is undefined', () => {
    render(<EmptyStateView message="Empty" actionLabel="Clear Filters" />)
    expect(screen.queryByTestId('empty-state-action')).toBeNull()
  })

  it('renders icon in circular background', () => {
    render(<EmptyStateView message="test" icon="book" />)
    expect(screen.getByTestId('icon-book')).toBeTruthy()
  })
})
