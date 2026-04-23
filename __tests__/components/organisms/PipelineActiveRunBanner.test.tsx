import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DbPipelineRun } from '@/lib/supabase/types'

const mockUseSWR = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('swr', () => ({
  // The banner fires up to two SWR keys (runs + events). Tests below pass
  // a router function that returns the right payload per key.
  default: (key: string | null) => mockUseSWR(key),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}))

import { PipelineActiveRunBanner } from '@/components/organisms/PipelineActiveRunBanner'

function makeRun(overrides: Partial<DbPipelineRun> = {}): DbPipelineRun {
  return {
    id: 'run-1',
    run_type: 'full',
    triggered_by: 'manual',
    status: 'running',
    started_at: new Date(Date.now() - 4_000).toISOString(),
    completed_at: null,
    duration_ms: null,
    steps: [
      { step: 'fetch_feeds', status: 'success', duration_ms: 1200 },
      { step: 'embed_pass_1', status: 'success', duration_ms: 2000 },
    ],
    summary: null,
    error: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('PipelineActiveRunBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } })
  })

  function routeSWR(payloads: { runs: unknown[]; events?: unknown[] }) {
    mockUseSWR.mockImplementation((key: string | null) => {
      if (!key) return { data: undefined }
      if (key.startsWith('/api/admin/pipeline/events')) {
        return { data: { success: true, data: payloads.events ?? [] } }
      }
      return { data: { success: true, data: payloads.runs } }
    })
  }

  it('renders nothing when the running-only query returns empty', () => {
    // The banner now hits /api/admin/pipeline?status=running so an empty
    // response means no run is in flight.
    routeSWR({ runs: [] })
    const { container } = render(<PipelineActiveRunBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders banner with current step from latest event and elapsed time', () => {
    routeSWR({
      runs: [makeRun()],
      events: [{ stage: 'embed', event_type: 'pgvector_fallback', created_at: new Date().toISOString() }],
    })

    render(<PipelineActiveRunBanner />)
    expect(screen.getByTestId('pipeline-active-run-banner')).toBeInTheDocument()
    expect(screen.getByText('full')).toBeInTheDocument()
    expect(screen.getByText(/manual/)).toBeInTheDocument()
    expect(screen.getByText(/embed: pgvector_fallback/)).toBeInTheDocument()
    expect(screen.getByLabelText('elapsed').textContent).toMatch(/s$/)
  })

  it('falls back to persisted steps when no events yet', () => {
    routeSWR({ runs: [makeRun()] })
    render(<PipelineActiveRunBanner />)
    expect(screen.getByText(/embed_pass_1/)).toBeInTheDocument()
  })

  it('cancel button is disabled', () => {
    routeSWR({ runs: [makeRun()] })
    render(<PipelineActiveRunBanner />)
    const btn = screen.getByRole('button', { name: /cancel/ })
    expect(btn).toBeDisabled()
  })
})
