import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

import { TagPill } from '@/components/atoms/TagPill'

describe('TagPill', () => {
  it('renders label text', () => {
    render(<TagPill label="Iran" type="location" />)
    expect(screen.getByText('Iran')).toBeTruthy()
  })

  it('has accessibility label', () => {
    render(<TagPill label="NATO" type="organization" />)
    expect(screen.getByLabelText('Tag: NATO')).toBeTruthy()
  })

  it('calls onPress when pressed', () => {
    const onPress = jest.fn()
    render(<TagPill label="Iran" type="location" onPress={onPress} />)
    fireEvent.press(screen.getByText('Iran'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
