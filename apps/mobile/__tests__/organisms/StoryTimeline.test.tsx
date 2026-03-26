import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { StoryTimeline } from '@/components/organisms/StoryTimeline'
import type { TimelineEvent } from '@/lib/shared/types'

const mockEvents: TimelineEvent[] = [
  {
    id: 'ev-1',
    timestamp: '2026-03-20T08:00:00Z',
    kind: 'source-added',
    sourceName: 'Reuters',
    sourceBias: 'center',
    description: 'Reuters published an initial report.',
    cumulativeSourceCount: 1,
    cumulativeSpectrum: [{ bias: 'center', percentage: 100 }],
  },
  {
    id: 'ev-2',
    timestamp: '2026-03-20T10:00:00Z',
    kind: 'source-added',
    sourceName: 'CNN',
    sourceBias: 'lean-left',
    description: 'CNN added coverage with left-leaning analysis.',
    cumulativeSourceCount: 2,
    cumulativeSpectrum: [
      { bias: 'center', percentage: 50 },
      { bias: 'lean-left', percentage: 50 },
    ],
  },
]

describe('StoryTimeline', () => {
  it('renders timeline events with source names', () => {
    render(<StoryTimeline events={mockEvents} />)

    expect(screen.getByText('Reuters')).toBeTruthy()
    expect(screen.getByText('CNN')).toBeTruthy()
  })

  it('renders event descriptions', () => {
    render(<StoryTimeline events={mockEvents} />)

    expect(screen.getByText('Reuters published an initial report.')).toBeTruthy()
    expect(screen.getByText(/CNN added coverage/)).toBeTruthy()
  })

  it('renders cumulative source counts', () => {
    render(<StoryTimeline events={mockEvents} />)

    expect(screen.getByText(/1 sources/)).toBeTruthy()
    expect(screen.getByText(/2 sources/)).toBeTruthy()
  })

  it('returns null for empty events', () => {
    const { toJSON } = render(<StoryTimeline events={[]} />)
    expect(toJSON()).toBeNull()
  })
})
