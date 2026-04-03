import React from 'react'
import { Text } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'

import { CollapsibleSection } from '@/components/molecules/CollapsibleSection'

describe('CollapsibleSection', () => {
  it('renders title', () => {
    render(
      <CollapsibleSection title="Test Section">
        <Text>Content</Text>
      </CollapsibleSection>
    )
    expect(screen.getByText('Test Section')).toBeTruthy()
  })

  it('renders subtitle when provided', () => {
    render(
      <CollapsibleSection title="Title" subtitle="3 items">
        <Text>Content</Text>
      </CollapsibleSection>
    )
    expect(screen.getByText('3 items')).toBeTruthy()
  })

  it('hides content by default', () => {
    render(
      <CollapsibleSection title="Title">
        <Text>Hidden Content</Text>
      </CollapsibleSection>
    )
    expect(screen.queryByText('Hidden Content')).toBeNull()
  })

  it('shows content when defaultExpanded is true', () => {
    render(
      <CollapsibleSection title="Title" defaultExpanded>
        <Text>Visible Content</Text>
      </CollapsibleSection>
    )
    expect(screen.getByText('Visible Content')).toBeTruthy()
  })

  it('toggles content on press', () => {
    render(
      <CollapsibleSection title="Title">
        <Text>Toggle Content</Text>
      </CollapsibleSection>
    )

    expect(screen.queryByText('Toggle Content')).toBeNull()
    fireEvent.press(screen.getByText('Title'))
    expect(screen.getByText('Toggle Content')).toBeTruthy()
  })
})
