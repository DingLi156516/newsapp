import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

import { BookmarkButton } from '@/components/atoms/BookmarkButton'

// lucide-react-native icons render as a generic component; mock to inspect props
jest.mock('lucide-react-native', () => {
  const RN = require('react-native')
  const R = require('react')
  return {
    Bookmark: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: 'bookmark-icon', ...props }),
  }
})

describe('BookmarkButton', () => {
  it('renders without crashing', () => {
    render(<BookmarkButton isSaved={false} onPress={jest.fn()} />)
    expect(screen.getByTestId('bookmark-icon')).toBeTruthy()
  })

  it('calls onPress when pressed', () => {
    const onPress = jest.fn()
    render(<BookmarkButton isSaved={false} onPress={onPress} />)

    fireEvent.press(screen.getByTestId('bookmark-icon'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('passes filled color when isSaved is true', () => {
    const { getByTestId } = render(
      <BookmarkButton isSaved={true} onPress={jest.fn()} />
    )
    const icon = getByTestId('bookmark-icon')
    expect(icon.props.fill).toBe('#FFFFFF')
    expect(icon.props.color).toBe('#FFFFFF')
  })

  it('passes transparent fill when isSaved is false', () => {
    const { getByTestId } = render(
      <BookmarkButton isSaved={false} onPress={jest.fn()} />
    )
    const icon = getByTestId('bookmark-icon')
    expect(icon.props.fill).toBe('transparent')
    expect(icon.props.color).toBe('rgba(255, 255, 255, 0.4)')
  })

  it('has accessibility label "Bookmark story" when unsaved', () => {
    render(<BookmarkButton isSaved={false} onPress={jest.fn()} />)
    expect(screen.getByLabelText('Bookmark story')).toBeTruthy()
  })

  it('has accessibility label "Remove bookmark" when saved', () => {
    render(<BookmarkButton isSaved={true} onPress={jest.fn()} />)
    expect(screen.getByLabelText('Remove bookmark')).toBeTruthy()
  })

  it('has accessibility role button', () => {
    render(<BookmarkButton isSaved={false} onPress={jest.fn()} />)
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('has minimum 44pt touch target', () => {
    render(<BookmarkButton isSaved={false} onPress={jest.fn()} />)
    const btn = screen.getByTestId('bookmark-button')
    const style = btn.props.style
    expect(style.minHeight).toBeGreaterThanOrEqual(44)
    expect(style.minWidth).toBeGreaterThanOrEqual(44)
  })
})
