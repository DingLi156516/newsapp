import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DbPipelineStageEvent } from '@/lib/supabase/types'

const mockUseSWR = vi.fn()

vi.mock('swr', () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}))

import { PipelineLiveFetchTicker } from '@/components/organisms/PipelineLiveFetchTicker'

function event(overrides: Partial<DbPipelineStageEvent>): DbPipelineStageEvent {
  return {
    id: Math.random().toString(36).slice(2),
    run_id: 'r1',
    claim_owner: null,
    stage: 'ingest',
    source_id: 's-1',
    provider: 'rss',
    level: 'info',
    event_type: 'source_fetch_start',
    item_id: null,
    duration_ms: null,
    payload: { slug: 'nytimes' },
    created_at: new Date(Date.now() - 3000).toISOString(),
    ...overrides,
  }
}

describe('PipelineLiveFetchTicker', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders nothing when no in-flight events', () => {
    mockUseSWR.mockReturnValue({ data: { success: true, data: [] } })
    const { container } = render(<PipelineLiveFetchTicker runId="r1" />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the slug for an in-flight source', () => {
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [event({})] },
    })
    render(<PipelineLiveFetchTicker runId="r1" />)
    expect(screen.getByTestId('pipeline-live-fetch-ticker')).toBeInTheDocument()
    expect(screen.getByText('nytimes')).toBeInTheDocument()
  })

  it('omits sources that already completed', () => {
    mockUseSWR.mockReturnValue({
      data: {
        success: true,
        data: [
          event({ event_type: 'source_fetch_complete', source_id: 's-1', payload: { slug: 'nytimes' } }),
          event({ event_type: 'source_fetch_start', source_id: 's-1', payload: { slug: 'nytimes' } }),
          event({ event_type: 'source_fetch_start', source_id: 's-2', payload: { slug: 'reuters' } }),
        ],
      },
    })
    render(<PipelineLiveFetchTicker runId="r1" />)
    expect(screen.queryByText('nytimes')).not.toBeInTheDocument()
    expect(screen.getByText('reuters')).toBeInTheDocument()
  })
})
