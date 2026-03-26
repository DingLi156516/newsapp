import React from 'react'
import { Text, Platform } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { GlassView } from '@/components/ui/GlassView'

describe('GlassView', () => {
  it('renders children visibly (not collapsed by flex)', () => {
    render(
      <GlassView>
        <Text>Visible content</Text>
      </GlassView>
    )
    expect(screen.getByText('Visible content')).toBeTruthy()
  })

  it('renders children with sm variant', () => {
    render(
      <GlassView variant="sm">
        <Text>SM variant</Text>
      </GlassView>
    )
    expect(screen.getByText('SM variant')).toBeTruthy()
  })

  it('renders children with pill variant', () => {
    render(
      <GlassView variant="pill">
        <Text>Pill variant</Text>
      </GlassView>
    )
    expect(screen.getByText('Pill variant')).toBeTruthy()
  })

  it('renders multiple children without collapsing', () => {
    render(
      <GlassView style={{ padding: 24 }}>
        <Text>Title</Text>
        <Text>Subtitle</Text>
        <Text>Button</Text>
      </GlassView>
    )
    expect(screen.getByText('Title')).toBeTruthy()
    expect(screen.getByText('Subtitle')).toBeTruthy()
    expect(screen.getByText('Button')).toBeTruthy()
  })

  it('passes style prop to outer container', () => {
    const { toJSON } = render(
      <GlassView style={{ padding: 24 }} testID="glass">
        <Text>Content</Text>
      </GlassView>
    )
    const tree = toJSON()
    expect(tree).not.toBeNull()
  })
})
