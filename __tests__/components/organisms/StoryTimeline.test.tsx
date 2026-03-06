import { render, screen } from '@testing-library/react'
import { StoryTimeline } from '@/components/organisms/StoryTimeline'
import type { StoryTimeline as StoryTimelineType } from '@/lib/types'

vi.mock('framer-motion')

const mockTimeline: StoryTimelineType = {
  storyId: 'test-story',
  totalArticles: 15,
  timeSpanHours: 48,
  events: [
    {
      id: 'evt-0',
      timestamp: '2026-03-01T10:00:00Z',
      kind: 'source-added',
      sourceName: 'Reuters',
      sourceBias: 'center',
      description: 'Reuters began covering this story',
      cumulativeSourceCount: 1,
      cumulativeSpectrum: [{ bias: 'center', percentage: 100 }],
    },
    {
      id: 'evt-1',
      timestamp: '2026-03-02T06:00:00Z',
      kind: 'spectrum-shift',
      sourceName: 'The Guardian',
      sourceBias: 'left',
      description: 'Coverage spectrum shifted significantly',
      cumulativeSourceCount: 3,
      cumulativeSpectrum: [
        { bias: 'left', percentage: 33 },
        { bias: 'center', percentage: 67 },
      ],
    },
    {
      id: 'evt-2',
      timestamp: '2026-03-02T14:00:00Z',
      kind: 'milestone',
      sourceName: 'NPR',
      sourceBias: 'lean-left',
      description: '5 sources now covering this story',
      cumulativeSourceCount: 5,
      cumulativeSpectrum: [
        { bias: 'left', percentage: 20 },
        { bias: 'lean-left', percentage: 20 },
        { bias: 'center', percentage: 40 },
        { bias: 'lean-right', percentage: 20 },
      ],
    },
  ],
}

describe('StoryTimeline', () => {
  it('renders timeline event descriptions', () => {
    render(<StoryTimeline timeline={mockTimeline} isLoading={false} />)

    expect(screen.getByText('Reuters began covering this story')).toBeInTheDocument()
    expect(screen.getByText('Coverage spectrum shifted significantly')).toBeInTheDocument()
    expect(screen.getByText('5 sources now covering this story')).toBeInTheDocument()
  })

  it('renders source count badges', () => {
    render(<StoryTimeline timeline={mockTimeline} isLoading={false} />)

    expect(screen.getByText('1 source')).toBeInTheDocument()
    expect(screen.getByText('3 sources')).toBeInTheDocument()
    expect(screen.getByText('5 sources')).toBeInTheDocument()
  })

  it('renders summary footer', () => {
    render(<StoryTimeline timeline={mockTimeline} isLoading={false} />)

    expect(screen.getByText('15 articles over 2 days')).toBeInTheDocument()
  })

  it('renders skeleton when loading', () => {
    render(<StoryTimeline timeline={null} isLoading={true} />)

    expect(screen.getByTestId('timeline-skeleton')).toBeInTheDocument()
  })

  it('returns null when timeline is null and not loading', () => {
    const { container } = render(<StoryTimeline timeline={null} isLoading={false} />)

    expect(container.firstChild).toBeNull()
  })

  it('returns null when timeline has zero events', () => {
    const emptyTimeline: StoryTimelineType = {
      storyId: 'test',
      totalArticles: 0,
      timeSpanHours: 0,
      events: [],
    }
    const { container } = render(<StoryTimeline timeline={emptyTimeline} isLoading={false} />)

    expect(container.firstChild).toBeNull()
  })

  it('renders spectrum bars for events', () => {
    render(<StoryTimeline timeline={mockTimeline} isLoading={false} />)

    const spectrumBars = screen.getAllByRole('img', { name: 'Source bias distribution' })
    expect(spectrumBars.length).toBe(3)
  })

  it('renders summary with hours for short timelines', () => {
    const shortTimeline: StoryTimelineType = {
      storyId: 'test',
      totalArticles: 3,
      timeSpanHours: 6,
      events: [
        {
          id: 'evt-0',
          timestamp: '2026-03-01T10:00:00Z',
          kind: 'source-added',
          sourceName: 'Reuters',
          sourceBias: 'center',
          description: 'Reuters began covering this story',
          cumulativeSourceCount: 1,
          cumulativeSpectrum: [{ bias: 'center', percentage: 100 }],
        },
      ],
    }
    render(<StoryTimeline timeline={shortTimeline} isLoading={false} />)

    expect(screen.getByText('3 articles over 6 hours')).toBeInTheDocument()
  })
})
