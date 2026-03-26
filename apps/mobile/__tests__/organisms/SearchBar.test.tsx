import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { SearchBar } from '@/components/organisms/SearchBar'

describe('SearchBar', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    onClear: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders a text input with placeholder', () => {
    render(<SearchBar {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search stories...')).toBeTruthy()
  })

  it('calls onChange when text is typed', () => {
    const onChange = jest.fn()
    render(<SearchBar {...defaultProps} onChange={onChange} />)

    fireEvent.changeText(screen.getByPlaceholderText('Search stories...'), 'climate')
    expect(onChange).toHaveBeenCalledWith('climate')
  })

  it('calls onClear when clear button is pressed', () => {
    const onClear = jest.fn()
    render(<SearchBar value="test" onChange={jest.fn()} onClear={onClear} />)

    // The X clear button appears when value.length > 0
    const pressables = screen.root.findAll(
      (node: { props: Record<string, unknown> }) => node.props.onPress !== undefined && node.props.hitSlop === 8
    )
    expect(pressables.length).toBeGreaterThan(0)
    fireEvent.press(pressables[0])

    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('does not show clear button when value is empty', () => {
    render(<SearchBar {...defaultProps} />)

    const pressables = screen.root.findAll(
      (node: { props: Record<string, unknown> }) => node.props.onPress !== undefined && node.props.hitSlop === 8
    )
    expect(pressables).toHaveLength(0)
  })
})
