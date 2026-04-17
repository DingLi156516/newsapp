/**
 * Tests for components/molecules/OwnershipBar.tsx
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OwnershipBar } from '@/components/molecules/OwnershipBar'
import type { OwnershipDistribution } from '@/lib/api/ownership-aggregator'

function buildDistribution(
  overrides: Partial<OwnershipDistribution> = {}
): OwnershipDistribution {
  return {
    groups: [],
    unknownCount: 0,
    concentrationIndex: 0,
    dominantOwner: null,
    ...overrides,
  }
}

describe('OwnershipBar', () => {
  it('returns null when totalSources is zero', () => {
    const { container } = render(
      <OwnershipBar distribution={buildDistribution()} totalSources={0} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a segment per owner group with correct width', () => {
    const distribution = buildDistribution({
      groups: [
        {
          ownerId: 'a',
          ownerName: 'A Corp',
          ownerSlug: 'a-corp',
          ownerType: 'public_company',
          isIndividual: false,
          country: 'US',
          sourceCount: 3,
          percentage: 60,
        },
        {
          ownerId: 'b',
          ownerName: 'B Corp',
          ownerSlug: 'b-corp',
          ownerType: 'nonprofit',
          isIndividual: false,
          country: 'US',
          sourceCount: 2,
          percentage: 40,
        },
      ],
      concentrationIndex: 0.52,
    })
    const { container } = render(
      <OwnershipBar distribution={distribution} totalSources={5} />
    )
    const a = container.querySelector('[data-testid="ownership-segment-a-corp"]') as HTMLElement
    const b = container.querySelector('[data-testid="ownership-segment-b-corp"]') as HTMLElement
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    expect(a.style.width).toBe('60%')
    expect(b.style.width).toBe('40%')
  })

  it('includes a trailing unknown slice when owner groups do not sum to 100%', () => {
    const distribution = buildDistribution({
      groups: [
        {
          ownerId: 'a',
          ownerName: 'A Corp',
          ownerSlug: 'a-corp',
          ownerType: 'public_company',
          isIndividual: false,
          country: 'US',
          sourceCount: 2,
          percentage: 40,
        },
      ],
      unknownCount: 3,
    })
    const { container } = render(
      <OwnershipBar distribution={distribution} totalSources={5} />
    )
    const unknown = container.querySelector(
      '[data-testid="ownership-segment-unknown"]'
    ) as HTMLElement
    expect(unknown).toBeTruthy()
    expect(unknown.style.width).toBe('60%')
  })

  it('omits the unknown slice when there are no unknowns', () => {
    const distribution = buildDistribution({
      groups: [
        {
          ownerId: 'a',
          ownerName: 'A Corp',
          ownerSlug: 'a-corp',
          ownerType: 'public_company',
          isIndividual: false,
          country: 'US',
          sourceCount: 4,
          percentage: 100,
        },
      ],
    })
    render(<OwnershipBar distribution={distribution} totalSources={4} />)
    expect(screen.queryByTestId('ownership-segment-unknown')).toBeNull()
  })

  it('does not render a phantom unknown slice when 3 owners each cover 1/3 of sources', () => {
    // 33% + 33% + 33% rounds to 99 in display; bar must still NOT render
    // an unknown segment because unknownCount is 0.
    const distribution = buildDistribution({
      groups: [
        { ownerId: 'a', ownerName: 'A', ownerSlug: 'a', ownerType: 'public_company', isIndividual: false, country: null, sourceCount: 1, percentage: 33 },
        { ownerId: 'b', ownerName: 'B', ownerSlug: 'b', ownerType: 'public_company', isIndividual: false, country: null, sourceCount: 1, percentage: 33 },
        { ownerId: 'c', ownerName: 'C', ownerSlug: 'c', ownerType: 'public_company', isIndividual: false, country: null, sourceCount: 1, percentage: 33 },
      ],
      unknownCount: 0,
    })
    render(<OwnershipBar distribution={distribution} totalSources={3} />)
    expect(screen.queryByTestId('ownership-segment-unknown')).toBeNull()
  })

  it('exposes an accessible label on each segment via title', () => {
    const distribution = buildDistribution({
      groups: [
        {
          ownerId: 'a',
          ownerName: 'A Corp',
          ownerSlug: 'a-corp',
          ownerType: 'public_company',
          isIndividual: false,
          country: 'US',
          sourceCount: 3,
          percentage: 60,
        },
      ],
    })
    const { container } = render(
      <OwnershipBar distribution={distribution} totalSources={5} />
    )
    const segment = container.querySelector(
      '[data-testid="ownership-segment-a-corp"]'
    ) as HTMLElement
    expect(segment.getAttribute('title')).toBe('A Corp · 3 sources')
  })
})
