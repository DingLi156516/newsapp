import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/hooks/use-pipeline', () => ({
  useSourceHealth: vi.fn(),
}))

import { useSourceHealth } from '@/lib/hooks/use-pipeline'
import { SourceHealthTable } from '@/components/organisms/SourceHealthTable'
import type { SourceHealthEntry } from '@/lib/hooks/use-pipeline'

const mockUseSourceHealth = vi.mocked(useSourceHealth)

const mockSources: SourceHealthEntry[] = [
  {
    id: 'src-1',
    slug: 'reuters',
    name: 'Reuters',
    bias: 'center',
    region: 'us',
    source_type: 'rss',
    is_active: true,
    last_fetch_at: new Date(Date.now() - 30 * 60000).toISOString(), // 30 minutes ago
    last_fetch_status: 'success',
    last_fetch_error: null,
    consecutive_failures: 0,
    total_articles_ingested: 1250,
    cooldown_until: null,
    auto_disabled_at: null,
    auto_disabled_reason: null,
  },
  {
    id: 'src-2',
    slug: 'fox-news',
    name: 'Fox News',
    bias: 'right',
    region: 'us',
    source_type: 'rss',
    is_active: true,
    last_fetch_at: new Date(Date.now() - 120 * 60000).toISOString(), // 2 hours ago
    last_fetch_status: 'http_error',
    last_fetch_error: '503 Service Unavailable',
    consecutive_failures: 3,
    total_articles_ingested: 980,
    needs_attention: true,
    cooldown_until: null,
    auto_disabled_at: null,
    auto_disabled_reason: null,
  },
  {
    id: 'src-3',
    slug: 'bbc-news',
    name: 'BBC News',
    bias: 'lean-left',
    region: 'uk',
    source_type: 'rss',
    is_active: true,
    last_fetch_at: null,
    last_fetch_status: 'unknown',
    last_fetch_error: null,
    consecutive_failures: 0,
    total_articles_ingested: 0,
    needs_attention: false,
    cooldown_until: null,
    auto_disabled_at: null,
    auto_disabled_reason: null,
  },
]

describe('SourceHealthTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton when loading', () => {
    mockUseSourceHealth.mockReturnValue({
      sources: [],
      isLoading: true,
      mutate: vi.fn(),
    })

    const { container } = render(<SourceHealthTable />)

    const skeletons = container.querySelectorAll('.animate-shimmer')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state when no sources', () => {
    mockUseSourceHealth.mockReturnValue({
      sources: [],
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<SourceHealthTable />)

    expect(screen.getByText('No sources found')).toBeInTheDocument()
  })

  it('renders source rows with name and slug', () => {
    mockUseSourceHealth.mockReturnValue({
      sources: mockSources,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<SourceHealthTable />)

    expect(screen.getByText('Reuters')).toBeInTheDocument()
    expect(screen.getByText('reuters')).toBeInTheDocument()
    expect(screen.getByText('Fox News')).toBeInTheDocument()
    expect(screen.getByText('fox-news')).toBeInTheDocument()
    expect(screen.getByText('BBC News')).toBeInTheDocument()
    expect(screen.getByText('bbc-news')).toBeInTheDocument()
  })

  it('renders source status badges', () => {
    mockUseSourceHealth.mockReturnValue({
      sources: mockSources,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<SourceHealthTable />)

    expect(screen.getByText('success')).toBeInTheDocument()
    expect(screen.getByText('http_error')).toBeInTheDocument()
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  it('shows article counts', () => {
    mockUseSourceHealth.mockReturnValue({
      sources: mockSources,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<SourceHealthTable />)

    expect(screen.getByText('1250 articles')).toBeInTheDocument()
    expect(screen.getByText('980 articles')).toBeInTheDocument()
    expect(screen.getByText('0 articles')).toBeInTheDocument()
  })

  it('shows consecutive failure count when > 0', () => {
    mockUseSourceHealth.mockReturnValue({
      sources: mockSources,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<SourceHealthTable />)

    // Fox News has 3 consecutive failures
    expect(screen.getByText('3 fails')).toBeInTheDocument()

    // Reuters has 0 failures — should not show fail text
    expect(screen.queryByText('0 fails')).not.toBeInTheDocument()
    expect(screen.queryByText('0 fail')).not.toBeInTheDocument()
  })

  it('shows maintenance candidate badge for unhealthy sources', () => {
    mockUseSourceHealth.mockReturnValue({
      sources: mockSources,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<SourceHealthTable />)

    expect(screen.getByText('Needs attention')).toBeInTheDocument()
  })

  it('shows relative time for last fetch', () => {
    mockUseSourceHealth.mockReturnValue({
      sources: mockSources,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<SourceHealthTable />)

    // Reuters fetched 30 min ago
    expect(screen.getByText('30m ago')).toBeInTheDocument()
    // Fox News fetched 2 hours ago
    expect(screen.getByText('2h ago')).toBeInTheDocument()
    // BBC News never fetched
    expect(screen.getByText('Never')).toBeInTheDocument()
  })

  it('renders the Source Health heading', () => {
    mockUseSourceHealth.mockReturnValue({
      sources: mockSources,
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<SourceHealthTable />)

    expect(screen.getByText('Source Health')).toBeInTheDocument()
  })

  it('renders an Auto-disabled badge when auto_disabled_at is set', () => {
    const auto: SourceHealthEntry = {
      ...mockSources[0],
      id: 'src-auto',
      slug: 'auto-source',
      name: 'Auto Source',
      cooldown_until: new Date(Date.now() + 60 * 60000).toISOString(),
      auto_disabled_at: new Date(Date.now() - 60_000).toISOString(),
      auto_disabled_reason: 'Auto-disabled: 12 consecutive failures',
    }

    mockUseSourceHealth.mockReturnValue({
      sources: [auto],
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<SourceHealthTable />)

    expect(screen.getByText('Auto-disabled')).toBeInTheDocument()
    // Cooldown badge should NOT render when source is auto-disabled — the
    // auto-disable status is the more severe state and takes precedence.
    expect(screen.queryByText(/^Cooldown/)).not.toBeInTheDocument()
  })

  it('renders a Cooldown badge with countdown when in cooldown', () => {
    const cooling: SourceHealthEntry = {
      ...mockSources[1],
      id: 'src-cool',
      slug: 'cool-source',
      name: 'Cool Source',
      cooldown_until: new Date(Date.now() + 14 * 60_000).toISOString(),
      auto_disabled_at: null,
      auto_disabled_reason: null,
    }

    mockUseSourceHealth.mockReturnValue({
      sources: [cooling],
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<SourceHealthTable />)

    // Cooldown badge text format: "Cooldown 14m"
    expect(screen.getByText(/Cooldown\s*1[34]m/)).toBeInTheDocument()
  })

  it('shows Reactivate button when source is auto-disabled and POSTs on click', async () => {
    const auto: SourceHealthEntry = {
      ...mockSources[0],
      id: 'src-auto',
      slug: 'auto-source',
      name: 'Auto Source',
      auto_disabled_at: new Date(Date.now() - 60_000).toISOString(),
      auto_disabled_reason: 'Auto-disabled: 12 consecutive failures',
    }
    const mutate = vi.fn()

    mockUseSourceHealth.mockReturnValue({
      sources: [auto],
      isLoading: false,
      mutate,
    })

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: { id: 'src-auto' } }), {
          status: 200,
        })
      )

    render(<SourceHealthTable />)

    const button = screen.getByRole('button', { name: /reactivate/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/sources/src-auto/reactivate',
        expect.objectContaining({ method: 'POST' })
      )
    })

    expect(mutate).toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  it('hides the Reactivate button for healthy sources', () => {
    mockUseSourceHealth.mockReturnValue({
      sources: [mockSources[0]],
      isLoading: false,
      mutate: vi.fn(),
    })

    render(<SourceHealthTable />)

    expect(
      screen.queryByRole('button', { name: /reactivate/i })
    ).not.toBeInTheDocument()
  })
})
