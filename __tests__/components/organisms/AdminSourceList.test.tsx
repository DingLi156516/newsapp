import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/hooks/use-admin-sources', () => ({
  useAdminSources: vi.fn(),
}))

vi.mock('@/lib/hooks/use-debounce', () => ({
  useDebounce: vi.fn((value: string) => value),
}))

vi.mock('@/components/molecules/AdminSourceListItem', () => ({
  AdminSourceListItem: ({
    source,
    onClick,
  }: {
    source: { id: string; name: string }
    isSelected: boolean
    onClick: (source: { id: string; name: string }) => void
  }) => (
    <div data-testid={`source-item-${source.id}`} onClick={() => onClick(source)}>
      {source.name}
    </div>
  ),
}))

vi.mock('@/components/atoms/Skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}))

import { useAdminSources } from '@/lib/hooks/use-admin-sources'
import { AdminSourceList } from '@/components/organisms/AdminSourceList'
import type { DbSource } from '@/lib/supabase/types'

const mockUseAdminSources = vi.mocked(useAdminSources)

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
    last_fetch_at: null,
    last_fetch_status: 'success',
    last_fetch_error: null,
    consecutive_failures: 0,
    total_articles_ingested: 100,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    bias_mbfc: null,
    bias_allsides: null,
    bias_adfm: null,
    factuality_mbfc: null,
    factuality_allsides: null,
    bias_override: false,
    bias_sources_synced_at: null,
    source_type: 'rss',
    ingestion_config: {},
    owner_id: null,
    cooldown_until: null,
    auto_disabled_at: null,
    auto_disabled_reason: null,
    ...overrides,
  }
}

describe('AdminSourceList', () => {
  const onSelect = vi.fn()
  const onCreateNew = vi.fn()
  const onImport = vi.fn()

  const defaultSources = [
    makeSource({ id: 'src-1', name: 'Reuters' }),
    makeSource({ id: 'src-2', name: 'AP News', slug: 'ap-news' }),
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAdminSources.mockReturnValue({
      sources: defaultSources,
      total: 2,
      isLoading: false,
      mutate: vi.fn(),
    })
  })

  function renderComponent(selectedId: string | null = null) {
    return render(
      <AdminSourceList
        selectedId={selectedId}
        onSelect={onSelect}
        onCreateNew={onCreateNew}
        onImport={onImport}
      />
    )
  }

  it('renders search input and action buttons', () => {
    renderComponent()

    expect(screen.getByPlaceholderText('Search sources...')).toBeInTheDocument()
    expect(screen.getByText('Add')).toBeInTheDocument()
    expect(screen.getByText('Import')).toBeInTheDocument()
  })

  it('shows source count', () => {
    renderComponent()

    expect(screen.getByText('2 sources')).toBeInTheDocument()
  })

  it('shows singular count for 1 source', () => {
    mockUseAdminSources.mockReturnValue({
      sources: [defaultSources[0]],
      total: 1,
      isLoading: false,
      mutate: vi.fn(),
    })

    renderComponent()

    expect(screen.getByText('1 source')).toBeInTheDocument()
  })

  it('triggers onSelect when clicking a source item', () => {
    renderComponent()

    fireEvent.click(screen.getByTestId('source-item-src-1'))
    expect(onSelect).toHaveBeenCalledWith(defaultSources[0])
  })

  it('calls onCreateNew when Add button is clicked', () => {
    renderComponent()

    fireEvent.click(screen.getByText('Add'))
    expect(onCreateNew).toHaveBeenCalledOnce()
  })

  it('calls onImport when Import button is clicked', () => {
    renderComponent()

    fireEvent.click(screen.getByText('Import'))
    expect(onImport).toHaveBeenCalledOnce()
  })

  it('shows skeletons during loading', () => {
    mockUseAdminSources.mockReturnValue({
      sources: [],
      total: 0,
      isLoading: true,
      mutate: vi.fn(),
    })

    renderComponent()

    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(4)
  })

  it('shows empty state when no sources found', () => {
    mockUseAdminSources.mockReturnValue({
      sources: [],
      total: 0,
      isLoading: false,
      mutate: vi.fn(),
    })

    renderComponent()

    expect(screen.getByText('No sources found')).toBeInTheDocument()
  })

  it('shows pagination when totalPages > 1', () => {
    mockUseAdminSources.mockReturnValue({
      sources: defaultSources,
      total: 100,
      isLoading: false,
      mutate: vi.fn(),
    })

    renderComponent()

    expect(screen.getByText('Previous')).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  })

  it('does not show pagination when totalPages <= 1', () => {
    renderComponent()

    expect(screen.queryByText('Previous')).not.toBeInTheDocument()
    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })

  it('renders filter pills for All, Active, Inactive', () => {
    renderComponent()

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('renders source names in the list', () => {
    renderComponent()

    expect(screen.getByText('Reuters')).toBeInTheDocument()
    expect(screen.getByText('AP News')).toBeInTheDocument()
  })
})
