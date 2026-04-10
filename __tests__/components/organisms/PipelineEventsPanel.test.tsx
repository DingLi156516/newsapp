/**
 * Tests for components/organisms/PipelineEventsPanel.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { DbPipelineStageEvent } from '@/lib/supabase/types'

const mockMutate = vi.fn()
const mockUsePipelineEvents = vi.fn()

vi.mock('@/lib/hooks/use-pipeline-events', () => ({
  usePipelineEvents: (...args: unknown[]) => mockUsePipelineEvents(...args),
}))

import { PipelineEventsPanel } from '@/components/organisms/PipelineEventsPanel'

function makeEvent(overrides: Partial<DbPipelineStageEvent> = {}): DbPipelineStageEvent {
  return {
    id: overrides.id ?? 'event-1',
    run_id: overrides.run_id ?? 'run-1',
    claim_owner: overrides.claim_owner ?? 'owner-1',
    stage: overrides.stage ?? 'cluster',
    source_id: overrides.source_id ?? null,
    provider: overrides.provider ?? null,
    level: overrides.level ?? 'warn',
    event_type: overrides.event_type ?? 'pgvector_fallback',
    item_id: overrides.item_id ?? null,
    duration_ms: overrides.duration_ms ?? null,
    payload: overrides.payload ?? { error: 'function does not exist' },
    created_at: overrides.created_at ?? '2026-04-10T12:00:00Z',
  }
}

describe('PipelineEventsPanel', () => {
  beforeEach(() => {
    mockUsePipelineEvents.mockReset()
    mockMutate.mockReset()
  })

  it('renders loading skeletons while events are fetching', () => {
    mockUsePipelineEvents.mockReturnValue({
      events: [],
      isLoading: true,
      error: null,
      mutate: mockMutate,
    })

    const { container } = render(<PipelineEventsPanel />)
    // Loading state renders pulsing skeleton rows; we assert at least one
    // shimmer-class element is present.
    expect(container.querySelector('.animate-shimmer')).not.toBeNull()
  })

  it('renders empty-state message when no events are returned', () => {
    mockUsePipelineEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      mutate: mockMutate,
    })

    render(<PipelineEventsPanel />)
    expect(screen.getByText(/No stage events/i)).toBeInTheDocument()
  })

  it('renders event rows showing stage, level, and eventType', () => {
    mockUsePipelineEvents.mockReturnValue({
      events: [
        makeEvent({
          id: 'e1',
          stage: 'cluster',
          level: 'warn',
          event_type: 'pgvector_fallback',
        }),
        makeEvent({
          id: 'e2',
          stage: 'embed',
          level: 'error',
          event_type: 'dlq_pushed',
        }),
      ],
      isLoading: false,
      error: null,
      mutate: mockMutate,
    })

    render(<PipelineEventsPanel />)
    expect(screen.getByText('pgvector_fallback')).toBeInTheDocument()
    expect(screen.getByText('dlq_pushed')).toBeInTheDocument()
    // Both cluster and embed stage labels should be visible.
    expect(screen.getAllByText(/cluster/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/embed/i).length).toBeGreaterThanOrEqual(1)
  })

  it('opens a modal with the JSON payload when an event row is clicked', () => {
    mockUsePipelineEvents.mockReturnValue({
      events: [
        makeEvent({
          id: 'e1',
          event_type: 'dlq_pushed',
          payload: { articleId: 'abc', retryCount: 6, error: 'boom' },
        }),
      ],
      isLoading: false,
      error: null,
      mutate: mockMutate,
    })

    render(<PipelineEventsPanel />)
    fireEvent.click(screen.getByRole('button', { name: /dlq_pushed/i }))

    // Modal shows the pretty-printed payload including both keys.
    expect(screen.getByText(/articleId/)).toBeInTheDocument()
    expect(screen.getByText(/retryCount/)).toBeInTheDocument()
  })

  it('toggles a level filter and re-queries the hook with the new levels', () => {
    mockUsePipelineEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      mutate: mockMutate,
    })

    render(<PipelineEventsPanel />)

    // Default state: all three levels (info/warn/error) selected, so the
    // hook was called with levels: ['info','warn','error'].
    expect(mockUsePipelineEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        levels: expect.arrayContaining(['warn', 'error']),
      })
    )

    // Toggle "info" off via its chip.
    fireEvent.click(screen.getByRole('button', { name: /^info$/i }))

    // After the toggle, the most recent call should have dropped 'info'.
    const lastCall = mockUsePipelineEvents.mock.calls.at(-1)?.[0] as
      | { levels?: string[] }
      | undefined
    expect(lastCall?.levels).not.toContain('info')
  })

  it('does not forward an invalid run id to the events hook while the operator is typing', () => {
    mockUsePipelineEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      mutate: mockMutate,
    })

    render(<PipelineEventsPanel />)

    // Type a partial UUID — too short, missing dashes, etc.
    const input = screen.getByLabelText(/run id filter/i)
    fireEvent.change(input, { target: { value: 'abc-123' } })

    // The last hook call must have runId = undefined; otherwise the
    // API would return 400 on every keystroke and spam the panel.
    const lastCall = mockUsePipelineEvents.mock.calls.at(-1)?.[0] as
      | { runId?: string | undefined }
      | undefined
    expect(lastCall?.runId).toBeUndefined()

    // Helper hint should be visible to the operator.
    expect(screen.getByText(/enter a full uuid/i)).toBeInTheDocument()
  })

  it('forwards a well-formed UUID run id to the events hook', () => {
    mockUsePipelineEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      mutate: mockMutate,
    })

    render(<PipelineEventsPanel />)

    const input = screen.getByLabelText(/run id filter/i)
    const validUuid = '019d791a-29e5-7c30-aca5-8a239348c7c6'
    fireEvent.change(input, { target: { value: validUuid } })

    const lastCall = mockUsePipelineEvents.mock.calls.at(-1)?.[0] as
      | { runId?: string | undefined }
      | undefined
    expect(lastCall?.runId).toBe(validUuid)
  })
})
