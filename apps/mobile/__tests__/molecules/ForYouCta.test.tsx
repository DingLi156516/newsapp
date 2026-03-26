import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ForYouCta } from '@/components/molecules/ForYouCta'

describe('ForYouCta', () => {
  it('renders CTA text', () => {
    render(<ForYouCta onDismiss={jest.fn()} />)

    expect(screen.getByText('Get personalized news')).toBeTruthy()
    expect(screen.getByText(/Sign in to see stories/)).toBeTruthy()
    expect(screen.getByText('Sign In')).toBeTruthy()
  })

  it('calls onDismiss when dismiss button is pressed', () => {
    const onDismiss = jest.fn()
    render(<ForYouCta onDismiss={onDismiss} />)

    // The X dismiss button is the first Pressable in the component
    // It wraps the X icon — we find all pressables and press the dismiss one
    const allPressables = screen.root.findAll(
      (node: { props: Record<string, unknown> }) => node.props.onPress && node !== screen.root
    )
    // First pressable is the dismiss button (X icon)
    fireEvent.press(allPressables[0])

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
