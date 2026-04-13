import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/hooks/use-admin-sources', () => ({
  useCreateSource: vi.fn(),
  useDiscoverRss: vi.fn(),
}))

vi.mock('@/lib/source-slugs', () => ({
  normalizeSourceSlug: vi.fn((v: string) =>
    v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  ),
}))

import { useCreateSource, useDiscoverRss } from '@/lib/hooks/use-admin-sources'
import { normalizeSourceSlug } from '@/lib/source-slugs'
import { AdminSourceCreate } from '@/components/organisms/AdminSourceCreate'
import type { DbSource } from '@/lib/supabase/types'

const mockCreate = vi.fn()
const mockDiscover = vi.fn()
const mockUseCreateSource = vi.mocked(useCreateSource)
const mockUseDiscoverRss = vi.mocked(useDiscoverRss)
const mockNormalizeSourceSlug = vi.mocked(normalizeSourceSlug)

function makeSource(overrides: Partial<DbSource> = {}): DbSource {
  return {
    id: 'src-1',
    slug: 'the-washington-post',
    name: 'The Washington Post',
    bias: 'center',
    factuality: 'high',
    ownership: 'corporate',
    url: 'https://washingtonpost.com',
    rss_url: 'https://washingtonpost.com/feed',
    region: 'us',
    is_active: true,
    last_fetch_at: null,
    last_fetch_status: 'success',
    last_fetch_error: null,
    consecutive_failures: 0,
    total_articles_ingested: 0,
    created_at: '2026-04-01T00:00:00Z',
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

describe('AdminSourceCreate', () => {
  const onCreated = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ success: true, data: makeSource() })
    mockUseCreateSource.mockReturnValue({
      create: mockCreate,
      isCreating: false,
      error: null,
    })
    mockDiscover.mockResolvedValue({ success: true, data: [] })
    mockUseDiscoverRss.mockReturnValue({
      discover: mockDiscover,
      isDiscovering: false,
      error: null,
    })
  })

  function renderComponent() {
    return render(
      <AdminSourceCreate onCreated={onCreated} onCancel={onCancel} />
    )
  }

  it('renders form with key fields visible', () => {
    renderComponent()

    expect(screen.getByText('Add New Source')).toBeInTheDocument()
    expect(screen.getByText('Name *')).toBeInTheDocument()
    expect(screen.getByText('Slug')).toBeInTheDocument()
    expect(screen.getByText('Source Type')).toBeInTheDocument()
    expect(screen.getByText('Website URL')).toBeInTheDocument()
    expect(screen.getByText('RSS URL')).toBeInTheDocument()
    expect(screen.getByText('Bias *')).toBeInTheDocument()
    expect(screen.getByText('Factuality *')).toBeInTheDocument()
    expect(screen.getByText('Ownership *')).toBeInTheDocument()
    expect(screen.getByText('Region')).toBeInTheDocument()
    expect(screen.getByText('Create Source')).toBeInTheDocument()
  })

  it('auto-generates slug when name changes', () => {
    renderComponent()

    const nameInput = screen.getByPlaceholderText('e.g., The Washington Post')
    fireEvent.change(nameInput, { target: { value: 'The Daily Beast' } })

    expect(mockNormalizeSourceSlug).toHaveBeenCalledWith('The Daily Beast')

    const slugInput = screen.getByPlaceholderText('auto-generated from name')
    expect(slugInput).toHaveValue('the-daily-beast')
  })

  it('stops auto-generation after manual slug edit', () => {
    renderComponent()

    const nameInput = screen.getByPlaceholderText('e.g., The Washington Post')
    const slugInput = screen.getByPlaceholderText('auto-generated from name')

    // Type name first — auto-generation fires
    fireEvent.change(nameInput, { target: { value: 'NYT' } })
    expect(mockNormalizeSourceSlug).toHaveBeenCalledWith('NYT')

    mockNormalizeSourceSlug.mockClear()

    // Manually edit slug
    fireEvent.change(slugInput, { target: { value: 'custom-slug' } })
    expect(slugInput).toHaveValue('custom-slug')

    // Subsequent name change should NOT call normalizeSourceSlug for auto-slug
    fireEvent.change(nameInput, { target: { value: 'New York Times' } })
    // normalizeSourceSlug is still called inside updateField, but slug should remain custom
    expect(slugInput).toHaveValue('custom-slug')
  })

  it('calls onCancel when Cancel button is clicked', () => {
    renderComponent()

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows error when submitting with empty name', async () => {
    renderComponent()

    const form = screen.getByText('Create Source').closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
    })

    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('calls create() and onCreated() on successful submit', async () => {
    const createdSource = makeSource({ name: 'My Source', slug: 'my-source' })
    mockCreate.mockResolvedValue({ success: true, data: createdSource })

    renderComponent()

    const nameInput = screen.getByPlaceholderText('e.g., The Washington Post')
    fireEvent.change(nameInput, { target: { value: 'My Source' } })

    const form = screen.getByText('Create Source').closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledOnce()
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Source',
        bias: 'center',
        factuality: 'high',
        ownership: 'corporate',
        region: 'us',
        source_type: 'rss',
      })
    )

    expect(onCreated).toHaveBeenCalledWith(createdSource)
  })

  it('triggers discover() when Find RSS button is clicked', async () => {
    mockDiscover.mockResolvedValue({
      success: true,
      data: [
        { url: 'https://example.com/rss', source: 'html-link', title: 'Main Feed' },
      ],
    })

    renderComponent()

    const urlInput = screen.getByPlaceholderText('https://example.com')
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

    fireEvent.click(screen.getByText('Find RSS'))

    await waitFor(() => {
      expect(mockDiscover).toHaveBeenCalledWith({ url: 'https://example.com' })
    })
  })

  it('shows discovered feeds and selects one to set RSS URL', async () => {
    mockDiscover.mockResolvedValue({
      success: true,
      data: [
        { url: 'https://example.com/rss', source: 'html-link', title: 'Main Feed' },
        { url: 'https://example.com/atom', source: 'common-path', title: 'Atom Feed' },
      ],
    })

    renderComponent()

    const urlInput = screen.getByPlaceholderText('https://example.com')
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

    fireEvent.click(screen.getByText('Find RSS'))

    await waitFor(() => {
      expect(screen.getByText('Discovered Feeds')).toBeInTheDocument()
    })

    expect(screen.getByText('Main Feed')).toBeInTheDocument()
    expect(screen.getByText('Atom Feed')).toBeInTheDocument()

    // Click first feed
    fireEvent.click(screen.getByText('Main Feed'))

    // RSS URL should be set and feeds panel should close
    const rssInput = screen.getByPlaceholderText('https://example.com/feed')
    expect(rssInput).toHaveValue('https://example.com/rss')

    // Discovered feeds list should disappear after selection
    expect(screen.queryByText('Discovered Feeds')).not.toBeInTheDocument()
  })

  it('shows error when discovery fails', async () => {
    mockDiscover.mockRejectedValue(new Error('Network error'))

    renderComponent()

    const urlInput = screen.getByPlaceholderText('https://example.com')
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

    fireEvent.click(screen.getByText('Find RSS'))

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })
})
