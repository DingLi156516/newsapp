/**
 * Tests for components/organisms/OwnershipSummary.tsx
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OwnershipSummary } from '@/components/organisms/OwnershipSummary'
import type { MediaOwner, NewsSource } from '@/lib/types'

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
    region: 'us',
    owner,
  }
}

describe('OwnershipSummary', () => {
  it('renders nothing with fewer than 3 sources', () => {
    const owner = makeOwner({ id: 'a', name: 'A Corp' })
    const { container } = render(
      <OwnershipSummary sources={[makeSource('1', owner), makeSource('2', owner)]} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when no sources have a known owner', () => {
    const { container } = render(
      <OwnershipSummary
        sources={[makeSource('1'), makeSource('2'), makeSource('3')]}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('announces the dominant owner when one owner covers >= 50%', () => {
    const warner = makeOwner({ id: 'warner', name: 'Warner Bros. Discovery' })
    const nyt = makeOwner({ id: 'nyt', name: 'New York Times Co' })
    render(
      <OwnershipSummary
        sources={[
          makeSource('1', warner),
          makeSource('2', warner),
          makeSource('3', warner),
          makeSource('4', warner),
          makeSource('5', nyt),
          makeSource('6'),
        ]}
      />
    )
    expect(
      screen.getByText(/Warner Bros\. Discovery covers 4 of 6 sources/i)
    ).toBeInTheDocument()
    expect(screen.getByTestId('ownership-summary')).toBeInTheDocument()
    expect(screen.getByTestId('ownership-bar')).toBeInTheDocument()
  })

  it('falls back to a "spans N owners" headline when no owner is dominant', () => {
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
    expect(screen.getByText(/Coverage spans 3 owners across 6 sources/i)).toBeInTheDocument()
  })

  it('renders a degraded-state block when ownershipUnavailable is true (no source data)', () => {
    // Simulates a media_owners outage: sources have no owner fields, but
    // the API told us hydration failed, not that owners are genuinely unknown.
    render(
      <OwnershipSummary
        sources={[makeSource('1'), makeSource('2'), makeSource('3')]}
        ownershipUnavailable
      />
    )
    const summary = screen.getByTestId('ownership-summary')
    expect(summary).toBeInTheDocument()
    expect(summary).toHaveAttribute('data-state', 'unavailable')
    expect(
      screen.getByText(/Ownership data temporarily unavailable/i)
    ).toBeInTheDocument()
  })

  it('degraded state wins over "not enough sources" short-circuit', () => {
    // Even with 1 source, the degraded state should still render so an
    // outage during a sparse-coverage story doesn't disappear silently.
    render(<OwnershipSummary sources={[makeSource('1')]} ownershipUnavailable />)
    expect(screen.getByTestId('ownership-summary')).toBeInTheDocument()
    expect(
      screen.getByText(/Ownership data temporarily unavailable/i)
    ).toBeInTheDocument()
  })

  it('renders the unknown count in the metadata footer when present', () => {
    const a = makeOwner({ id: 'a', name: 'A' })
    render(
      <OwnershipSummary
        sources={[makeSource('1', a), makeSource('2'), makeSource('3')]}
      />
    )
    expect(screen.getByText(/2 unknown/i)).toBeInTheDocument()
  })

  it('renders "View recent stories from X" link when a dominant owner exists', () => {
    const warner = makeOwner({ id: 'warner', name: 'Warner Bros. Discovery', slug: 'warner-bros-discovery' })
    render(
      <OwnershipSummary
        sources={[
          makeSource('1', warner),
          makeSource('2', warner),
          makeSource('3', warner),
          makeSource('4', warner),
          makeSource('5'),
          makeSource('6'),
        ]}
      />
    )
    const link = screen.getByTestId('ownership-summary-view-feed')
    expect(link).toBeInTheDocument()
    // Must include tab=latest — Trending (the default feed tab) applies a
    // 7-day server-side cutoff that would contradict the 180-day owner scope.
    expect(link).toHaveAttribute('href', '/?owner=warner-bros-discovery&tab=latest')
    expect(link).toHaveTextContent(/View recent stories from Warner Bros\. Discovery/)
    // Link title explains the bounded window to screen readers / hover users
    expect(link).toHaveAttribute('title', expect.stringMatching(/last 180 days/i))
  })

  it('does not render a View feed link when no owner dominates', () => {
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
    expect(screen.queryByTestId('ownership-summary-view-feed')).not.toBeInTheDocument()
  })
})
