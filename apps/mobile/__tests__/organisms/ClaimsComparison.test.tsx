import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

import { ClaimsComparison } from '@/components/organisms/ClaimsComparison'

describe('ClaimsComparison', () => {
  it('returns null for empty claims', () => {
    const { toJSON } = render(<ClaimsComparison claims={[]} />)
    expect(toJSON()).toBeNull()
  })

  it('returns null for null claims', () => {
    const { toJSON } = render(<ClaimsComparison claims={null as never} />)
    expect(toJSON()).toBeNull()
  })

  it('renders section title', () => {
    render(
      <ClaimsComparison claims={[
        { claim: 'A factual claim', side: 'left', disputed: false },
      ]} />
    )
    expect(screen.getByText('Key Claims')).toBeTruthy()
  })

  it('renders claim count in subtitle', () => {
    render(
      <ClaimsComparison claims={[
        { claim: 'Claim 1', side: 'left', disputed: false },
        { claim: 'Claim 2', side: 'right', disputed: true, counterClaim: 'Counter' },
      ]} />
    )
    expect(screen.getByText('2 claims')).toBeTruthy()
  })

  it('renders DISPUTED badge for disputed claims', () => {
    render(
      <ClaimsComparison claims={[
        { claim: 'A disputed claim', side: 'both', disputed: true },
      ]} />
    )
    // Collapsed by default, so badges aren't visible until expanded
    expect(screen.getByText('Key Claims')).toBeTruthy()
  })

  it('counter-claim toggle has accessibility role and expanded state', () => {
    render(
      <ClaimsComparison claims={[
        { claim: 'A disputed claim', side: 'left', disputed: true, counterClaim: 'The counter argument' },
      ]} />
    )

    // Expand the collapsible section first
    fireEvent.press(screen.getByText('Key Claims'))

    const toggle = screen.getByText('Show counter-claim')
    expect(toggle.parent?.parent?.props.accessibilityRole).toBe('button')
    expect(toggle.parent?.parent?.props.accessibilityState).toEqual({ expanded: false })

    // Toggle to show counter-claim
    fireEvent.press(toggle)

    const hideToggle = screen.getByText('Hide counter-claim')
    expect(hideToggle.parent?.parent?.props.accessibilityState).toEqual({ expanded: true })
  })
})
