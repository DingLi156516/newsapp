/**
 * Tests for components/organisms/BiasDriftChart.tsx
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BiasDriftChart } from '@/components/organisms/BiasDriftChart'
import type { TimelineEvent, SpectrumSegment } from '@/lib/types'

vi.mock('framer-motion')

function evt(
  id: string,
  timestamp: string,
  spectrum: SpectrumSegment[],
  sourceCount: number
): TimelineEvent {
  return {
    id,
    timestamp,
    kind: 'source-added',
    sourceName: `Source ${id}`,
    sourceBias: 'center',
    description: 'added',
    cumulativeSourceCount: sourceCount,
    cumulativeSpectrum: spectrum,
  }
}

const THREE_EVENTS: TimelineEvent[] = [
  evt('e1', '2026-03-01T00:00:00Z', [{ bias: 'left', percentage: 100 }], 1),
  evt('e2', '2026-03-01T02:00:00Z', [
    { bias: 'left', percentage: 50 },
    { bias: 'center', percentage: 50 },
  ], 2),
  evt('e3', '2026-03-02T00:00:00Z', [
    { bias: 'left', percentage: 33 },
    { bias: 'center', percentage: 33 },
    { bias: 'right', percentage: 34 },
  ], 3),
]

describe('BiasDriftChart', () => {
  it('renders one row per event', () => {
    render(<BiasDriftChart events={THREE_EVENTS} />)
    const rows = screen.getAllByTestId('bias-drift-row')
    expect(rows).toHaveLength(3)
  })

  it('renders relative time labels from the first event', () => {
    render(<BiasDriftChart events={THREE_EVENTS} />)
    expect(screen.getByText('+0h')).toBeInTheDocument()
    expect(screen.getByText('+2h')).toBeInTheDocument()
    expect(screen.getByText('+1d')).toBeInTheDocument()
  })

  it('renders cumulative source counts', () => {
    render(<BiasDriftChart events={THREE_EVENTS} />)
    expect(screen.getByText('1 src')).toBeInTheDocument()
    expect(screen.getByText('2 src')).toBeInTheDocument()
    expect(screen.getByText('3 src')).toBeInTheDocument()
  })

  it('renders segment widths from cumulativeSpectrum', () => {
    render(<BiasDriftChart events={THREE_EVENTS} />)
    // motion.div is passthrough via framer-motion mock → segments render as plain divs.
    const firstRow = screen.getAllByTestId('bias-drift-row')[0]
    const segments = firstRow.querySelectorAll('.spectrum-left')
    expect(segments.length).toBeGreaterThan(0)
    expect((segments[0] as HTMLElement).getAttribute('title')).toContain('100%')
  })

  it('returns null when fewer than 3 events', () => {
    const { container } = render(<BiasDriftChart events={THREE_EVENTS.slice(0, 2)} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null for empty events', () => {
    const { container } = render(<BiasDriftChart events={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the section heading', () => {
    render(<BiasDriftChart events={THREE_EVENTS} />)
    expect(screen.getByText(/How Coverage Shifted/i)).toBeInTheDocument()
  })

  it('collapses duplicate events that share timestamp and source count', () => {
    // transformTimeline() can emit source-added + spectrum-shift + milestone
    // for a single publication; those rows must collapse to one bar.
    const dupSpectrum: SpectrumSegment[] = [{ bias: 'left', percentage: 100 }]
    const dup: TimelineEvent[] = [
      evt('e1', '2026-03-01T00:00:00Z', dupSpectrum, 1),
      { ...evt('e2', '2026-03-01T00:00:00Z', dupSpectrum, 1), kind: 'spectrum-shift' },
      { ...evt('e3', '2026-03-01T00:00:00Z', dupSpectrum, 1), kind: 'milestone' },
      evt('e4', '2026-03-01T02:00:00Z', dupSpectrum, 2),
      evt('e5', '2026-03-01T05:00:00Z', dupSpectrum, 3),
    ]
    render(<BiasDriftChart events={dup} />)
    const rows = screen.getAllByTestId('bias-drift-row')
    expect(rows).toHaveLength(3)
  })

  it('renders a truncation note when the story has more sources than drift rows', () => {
    // Simulates the capped-timeline case: timeline.events stops at 20, but
    // the story's live `sourceCount` is higher. We do NOT fabricate a
    // synthetic spectrum bar because drift events and article.spectrumSegments
    // use different weighting — we report the gap in text instead.
    render(
      <BiasDriftChart events={THREE_EVENTS} currentSourceCount={50} />,
    )
    const rows = screen.getAllByTestId('bias-drift-row')
    expect(rows).toHaveLength(3)
    const note = screen.getByTestId('bias-drift-truncation-note')
    expect(note).toHaveTextContent('47 more sources joined')
  })

  it('omits the truncation note when current count matches the last event', () => {
    render(
      <BiasDriftChart
        events={THREE_EVENTS}
        currentSourceCount={THREE_EVENTS[2].cumulativeSourceCount}
      />,
    )
    expect(screen.queryByTestId('bias-drift-truncation-note')).not.toBeInTheDocument()
  })

  it('omits the truncation note when currentSourceCount is not provided', () => {
    render(<BiasDriftChart events={THREE_EVENTS} />)
    expect(screen.queryByTestId('bias-drift-truncation-note')).not.toBeInTheDocument()
  })

  it('floors elapsed time rather than rounding', () => {
    // 90 minutes → "+1h" (not "+2h"); 36 hours → "+1d" (not "+2d").
    const events: TimelineEvent[] = [
      evt('a', '2026-03-01T00:00:00Z', [{ bias: 'center', percentage: 100 }], 1),
      evt('b', '2026-03-01T01:30:00Z', [{ bias: 'center', percentage: 100 }], 2),
      evt('c', '2026-03-02T12:00:00Z', [{ bias: 'center', percentage: 100 }], 3),
    ]
    render(<BiasDriftChart events={events} />)
    expect(screen.getByText('+0h')).toBeInTheDocument()
    expect(screen.getByText('+1h')).toBeInTheDocument()
    expect(screen.getByText('+1d')).toBeInTheDocument()
  })
})
