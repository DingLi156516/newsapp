import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { OwnershipBar } from '@/components/molecules/OwnershipBar'
import type { OwnershipDistribution } from '@/lib/shared/ownership-aggregator'

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
  it('renders nothing when totalSources is 0', () => {
    const { toJSON } = render(
      <OwnershipBar distribution={buildDistribution()} totalSources={0} />
    )
    expect(toJSON()).toBeNull()
  })

  it('renders one segment per owner group', () => {
    const distribution = buildDistribution({
      groups: [
        {
          ownerId: 'a',
          ownerName: 'A',
          ownerSlug: 'a',
          ownerType: 'public_company',
          isIndividual: false,
          country: 'US',
          sourceCount: 2,
          percentage: 50,
        },
        {
          ownerId: 'b',
          ownerName: 'B',
          ownerSlug: 'b',
          ownerType: 'nonprofit',
          isIndividual: false,
          country: 'US',
          sourceCount: 2,
          percentage: 50,
        },
      ],
    })
    render(<OwnershipBar distribution={distribution} totalSources={4} />)

    expect(screen.getByTestId('ownership-bar')).toBeTruthy()
    expect(screen.getByTestId('ownership-segment-a')).toBeTruthy()
    expect(screen.getByTestId('ownership-segment-b')).toBeTruthy()
    expect(screen.queryByTestId('ownership-segment-unknown')).toBeNull()
  })

  it('does not render a phantom unknown slice when 3 owners each cover 1/3 of sources', () => {
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

  it('renders an unknown segment when unknown share is non-zero', () => {
    const distribution = buildDistribution({
      groups: [
        {
          ownerId: 'a',
          ownerName: 'A',
          ownerSlug: 'a',
          ownerType: 'public_company',
          isIndividual: false,
          country: 'US',
          sourceCount: 2,
          percentage: 40,
        },
      ],
      unknownCount: 3,
    })
    render(<OwnershipBar distribution={distribution} totalSources={5} />)

    expect(screen.getByTestId('ownership-segment-unknown')).toBeTruthy()
  })
})
