import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/hooks/use-admin-sources', () => ({
  useUpdateSource: vi.fn(),
}))

import { useUpdateSource } from '@/lib/hooks/use-admin-sources'
import { AdminSourceDetail } from '@/components/organisms/AdminSourceDetail'
import type { DbSource } from '@/lib/supabase/types'

const mockUpdate = vi.fn()
const mockUseUpdateSource = vi.mocked(useUpdateSource)

function makeSource(overrides: Partial<DbSource> = {}): DbSource {
  return {
    id: 'src-1',
    slug: 'reuters',
    name: 'Reuters',
    bias: 'center',
    factuality: 'high',
    ownership: 'corporate',
    url: 'https://reuters.com',
    rss_url: 'https://reuters.com/feed',
    region: 'us',
    is_active: true,
    last_fetch_at: '2026-04-01T00:00:00Z',
    last_fetch_status: 'success',
    last_fetch_error: null,
    consecutive_failures: 0,
    total_articles_ingested: 500,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    bias_mbfc: 'center',
    bias_allsides: 'center',
    bias_adfm: null,
    factuality_mbfc: 'high',
    factuality_allsides: null,
    bias_override: false,
    bias_sources_synced_at: '2026-04-01T00:00:00Z',
    source_type: 'rss',
    ingestion_config: {},
    cooldown_until: null,
    auto_disabled_at: null,
    auto_disabled_reason: null,
    ...overrides,
  }
}

describe('AdminSourceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdate.mockResolvedValue({ success: true, data: makeSource() })
    mockUseUpdateSource.mockReturnValue({
      update: mockUpdate,
      isUpdating: false,
      error: null,
    })
  })

  // -----------------------------------------------------------------------
  // Finding B — stale provider warning
  // -----------------------------------------------------------------------

  describe('stale provider warning', () => {
    it('shows warning when synced, no providers match, and no override', () => {
      const source = makeSource({
        bias_override: false,
        bias_sources_synced_at: '2026-04-01T00:00:00Z',
        bias_mbfc: null,
        bias_allsides: null,
        bias_adfm: null,
      })

      render(<AdminSourceDetail source={source} onUpdated={vi.fn()} />)

      expect(screen.getByText(/no bias providers currently match/i)).toBeInTheDocument()
    })

    it('hides warning when bias_override is true', () => {
      const source = makeSource({
        bias_override: true,
        bias_sources_synced_at: '2026-04-01T00:00:00Z',
        bias_mbfc: null,
        bias_allsides: null,
        bias_adfm: null,
      })

      render(<AdminSourceDetail source={source} onUpdated={vi.fn()} />)

      expect(screen.queryByText(/no bias providers currently match/i)).not.toBeInTheDocument()
    })

    it('hides warning when never synced', () => {
      const source = makeSource({
        bias_override: false,
        bias_sources_synced_at: null,
        bias_mbfc: null,
        bias_allsides: null,
        bias_adfm: null,
      })

      render(<AdminSourceDetail source={source} onUpdated={vi.fn()} />)

      expect(screen.queryByText(/no bias providers currently match/i)).not.toBeInTheDocument()
    })

    it('hides warning when at least one provider matches', () => {
      const source = makeSource({
        bias_override: false,
        bias_sources_synced_at: '2026-04-01T00:00:00Z',
        bias_mbfc: 'center',
        bias_allsides: null,
        bias_adfm: null,
      })

      render(<AdminSourceDetail source={source} onUpdated={vi.fn()} />)

      expect(screen.queryByText(/no bias providers currently match/i)).not.toBeInTheDocument()
    })

    it('hides warning when admin checks override checkbox during editing', () => {
      const source = makeSource({
        bias_override: false,
        bias_sources_synced_at: '2026-04-01T00:00:00Z',
        bias_mbfc: null,
        bias_allsides: null,
        bias_adfm: null,
      })

      render(<AdminSourceDetail source={source} onUpdated={vi.fn()} />)

      // Warning visible initially
      expect(screen.getByText(/no bias providers currently match/i)).toBeInTheDocument()

      // Enter edit mode and check override
      fireEvent.click(screen.getByText('Edit'))
      const checkbox = screen.getByRole('checkbox', { name: /manual override/i })
      fireEvent.click(checkbox)

      // Warning should disappear reactively
      expect(screen.queryByText(/no bias providers currently match/i)).not.toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // Finding A — override passthrough
  // -----------------------------------------------------------------------

  describe('override passthrough', () => {
    it('includes bias_override: false in payload when bias changes but checkbox untouched', async () => {
      const source = makeSource({ bias: 'center', bias_override: false })
      const onUpdated = vi.fn()
      mockUpdate.mockResolvedValue({ success: true, data: makeSource({ bias: 'left' }) })

      render(<AdminSourceDetail source={source} onUpdated={onUpdated} />)

      // Enter edit mode
      fireEvent.click(screen.getByText('Edit'))

      // Change bias to 'left' without touching the override checkbox
      fireEvent.change(screen.getByDisplayValue('Center'), { target: { value: 'left' } })

      // Save
      fireEvent.click(screen.getByText('Save'))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({
          id: 'src-1',
          data: expect.objectContaining({
            bias: 'left',
            bias_override: false,
          }),
        })
      })
    })

    it('does NOT include bias_override when only name changes', async () => {
      const source = makeSource({ name: 'Reuters', bias_override: false })
      const onUpdated = vi.fn()
      mockUpdate.mockResolvedValue({ success: true, data: makeSource({ name: 'Reuters Updated' }) })

      render(<AdminSourceDetail source={source} onUpdated={onUpdated} />)

      fireEvent.click(screen.getByText('Edit'))

      // Change only the name
      const nameInput = screen.getByDisplayValue('Reuters')
      fireEvent.change(nameInput, { target: { value: 'Reuters Updated' } })

      fireEvent.click(screen.getByText('Save'))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({
          id: 'src-1',
          data: { name: 'Reuters Updated' },
        })
      })

      // Verify bias_override is NOT in the payload
      const payload = mockUpdate.mock.calls[0][0].data
      expect(payload).not.toHaveProperty('bias_override')
    })

    it('preserves bias_override: true when changing bias on an already-overridden source', async () => {
      const source = makeSource({ bias: 'center', bias_override: true })
      const onUpdated = vi.fn()
      mockUpdate.mockResolvedValue({ success: true, data: makeSource({ bias: 'left', bias_override: true }) })

      render(<AdminSourceDetail source={source} onUpdated={onUpdated} />)

      fireEvent.click(screen.getByText('Edit'))
      fireEvent.change(screen.getByDisplayValue('Center'), { target: { value: 'left' } })
      fireEvent.click(screen.getByText('Save'))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({
          id: 'src-1',
          data: expect.objectContaining({
            bias: 'left',
            bias_override: true,
          }),
        })
      })
    })

    it('sends bias_override: false when admin unchecks existing override', async () => {
      const source = makeSource({ bias_override: true })
      const onUpdated = vi.fn()
      mockUpdate.mockResolvedValue({ success: true, data: makeSource({ bias_override: false }) })

      render(<AdminSourceDetail source={source} onUpdated={onUpdated} />)

      fireEvent.click(screen.getByText('Edit'))

      // Uncheck the override
      const checkbox = screen.getByRole('checkbox', { name: /manual override/i })
      fireEvent.click(checkbox)

      fireEvent.click(screen.getByText('Save'))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({
          id: 'src-1',
          data: { bias_override: false },
        })
      })
    })

    it('sends bias_override: true when admin checks override box while changing bias', async () => {
      const source = makeSource({ bias: 'center', bias_override: false })
      const onUpdated = vi.fn()
      mockUpdate.mockResolvedValue({ success: true, data: makeSource({ bias: 'left', bias_override: true }) })

      render(<AdminSourceDetail source={source} onUpdated={onUpdated} />)

      fireEvent.click(screen.getByText('Edit'))

      // Change bias
      fireEvent.change(screen.getByDisplayValue('Center'), { target: { value: 'left' } })

      // Check the override checkbox
      const checkbox = screen.getByRole('checkbox', { name: /manual override/i })
      fireEvent.click(checkbox)

      fireEvent.click(screen.getByText('Save'))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({
          id: 'src-1',
          data: expect.objectContaining({
            bias: 'left',
            bias_override: true,
          }),
        })
      })
    })
  })
})
