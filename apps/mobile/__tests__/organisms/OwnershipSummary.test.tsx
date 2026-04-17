import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { OwnershipSummary } from '@/components/organisms/OwnershipSummary'
import type { MediaOwner, NewsSource } from '@/lib/shared/types'

function makeOwner(overrides: Partial<MediaOwner> & { id: string; name: string }): MediaOwner {
  return {
    id: overrides.id,
    name: overrides.name,
    slug: overrides.slug ?? overrides.id,
    ownerType: overrides.ownerType ?? 'public_company',
    isIndividual: overrides.isIndividual ?? false,
    country: overrides.country ?? 'US',
    wikidataQid: null,
    ownerSource: 'manual',
    ownerVerifiedAt: '2026-01-01T00:00:00Z',
  }
}

function makeSource(id: string, owner?: MediaOwner): NewsSource {
  return {
    id,
    name: `Source ${id}`,
    bias: 'center',
    factuality: 'high',
    ownership: 'corporate',
    owner,
  }
}

describe('OwnershipSummary (mobile)', () => {
  it('renders nothing with fewer than 3 sources', () => {
    const owner = makeOwner({ id: 'a', name: 'A' })
    const { toJSON } = render(
      <OwnershipSummary sources={[makeSource('1', owner), makeSource('2', owner)]} />
    )
    expect(toJSON()).toBeNull()
  })

  it('renders nothing when no sources have an owner', () => {
    const { toJSON } = render(
      <OwnershipSummary sources={[makeSource('1'), makeSource('2'), makeSource('3')]} />
    )
    expect(toJSON()).toBeNull()
  })

  it('shows a dominant-owner headline when share >= 50%', () => {
    const warner = makeOwner({ id: 'warner', name: 'Warner Bros. Discovery' })
    render(
      <OwnershipSummary
        sources={[
          makeSource('1', warner),
          makeSource('2', warner),
          makeSource('3', warner),
          makeSource('4'),
        ]}
      />
    )
    expect(screen.getByTestId('ownership-summary')).toBeTruthy()
    expect(
      screen.getByText(/Warner Bros\. Discovery covers 3 of 4 sources/i)
    ).toBeTruthy()
  })

  it('renders a degraded-state block when ownershipUnavailable is true', () => {
    render(
      <OwnershipSummary
        sources={[makeSource('1'), makeSource('2'), makeSource('3')]}
        ownershipUnavailable
      />
    )
    expect(screen.getByTestId('ownership-summary')).toBeTruthy()
    expect(
      screen.getByText(/Ownership data temporarily unavailable/i)
    ).toBeTruthy()
  })

  it('shows "spans N owners" headline when no dominant owner', () => {
    const a = makeOwner({ id: 'a', name: 'A' })
    const b = makeOwner({ id: 'b', name: 'B' })
    const c = makeOwner({ id: 'c', name: 'C' })
    render(
      <OwnershipSummary
        sources={[
          makeSource('1', a),
          makeSource('2', a),
          makeSource('3', b),
          makeSource('4', b),
          makeSource('5', c),
          makeSource('6', c),
        ]}
      />
    )
    expect(screen.getByText(/Coverage spans 3 owners across 6 sources/i)).toBeTruthy()
  })
})
