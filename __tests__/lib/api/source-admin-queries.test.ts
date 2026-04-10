import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import {
  queryAdminSources,
  createSource,
  updateSource,
  bulkCreateSources,
} from '@/lib/api/source-admin-queries'

vi.mock('@/lib/source-slugs', () => ({
  normalizeSourceSlug: vi.fn((name: string) => name.toLowerCase().replace(/\s+/g, '-')),
}))

function createMockClient() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.neq = vi.fn().mockReturnValue(chain)
  chain.or = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.range = vi.fn().mockResolvedValue({ data: [], count: 0, error: null })
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null })

  const client = {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as SupabaseClient<Database>

  return { client, chain }
}

const mockSource = {
  id: 'src-1',
  slug: 'test-source',
  name: 'Test Source',
  bias: 'center',
  factuality: 'high',
  ownership: 'corporate',
  url: 'https://example.com',
  rss_url: 'https://example.com/feed',
  region: 'us',
  is_active: true,
  last_fetch_at: null,
  last_fetch_status: null,
  last_fetch_error: null,
  consecutive_failures: 0,
  total_articles_ingested: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  bias_mbfc: null,
  bias_allsides: null,
  bias_adfm: null,
  factuality_mbfc: null,
  factuality_allsides: null,
  bias_override: false,
  bias_sources_synced_at: null,
  source_type: 'rss',
  ingestion_config: {},
}

describe('queryAdminSources', () => {
  let client: SupabaseClient<Database>
  let chain: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockClient()
    client = mock.client
    chain = mock.chain
  })

  it('queries sources with default parameters', async () => {
    chain.range.mockResolvedValue({ data: [mockSource], count: 1, error: null })

    const result = await queryAdminSources(client, { page: 1, limit: 50, is_active: 'all', source_type: 'all' })

    expect(client.from).toHaveBeenCalledWith('sources')
    expect(chain.select).toHaveBeenCalled()
    expect(chain.order).toHaveBeenCalledWith('name', { ascending: true })
    expect(chain.range).toHaveBeenCalledWith(0, 49)
    expect(result).toEqual({ data: [mockSource], count: 1 })
  })

  it('applies search filter', async () => {
    chain.range.mockResolvedValue({ data: [], count: 0, error: null })

    await queryAdminSources(client, { search: 'cnn', page: 1, limit: 50, is_active: 'all', source_type: 'all' })

    expect(chain.or).toHaveBeenCalledWith('name.ilike.%cnn%,slug.ilike.%cnn%')
  })

  it('escapes special characters in search to prevent PostgREST injection', async () => {
    chain.range.mockResolvedValue({ data: [], count: 0, error: null })

    await queryAdminSources(client, { search: 'a%b,c.d', page: 1, limit: 50, is_active: 'all', source_type: 'all' })

    expect(chain.or).toHaveBeenCalledWith('name.ilike.%a\\%b\\,c\\.d%,slug.ilike.%a\\%b\\,c\\.d%')
  })

  it('applies bias filter', async () => {
    chain.range.mockResolvedValue({ data: [], count: 0, error: null })

    await queryAdminSources(client, { bias: 'left', page: 1, limit: 50, is_active: 'all', source_type: 'all' })

    expect(chain.eq).toHaveBeenCalledWith('bias', 'left')
  })

  it('applies region filter', async () => {
    chain.range.mockResolvedValue({ data: [], count: 0, error: null })

    await queryAdminSources(client, { region: 'uk', page: 1, limit: 50, is_active: 'all', source_type: 'all' })

    expect(chain.eq).toHaveBeenCalledWith('region', 'uk')
  })

  it('applies is_active filter for true', async () => {
    chain.range.mockResolvedValue({ data: [], count: 0, error: null })

    await queryAdminSources(client, { is_active: 'true', page: 1, limit: 50, source_type: 'all' })

    expect(chain.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('applies is_active filter for false', async () => {
    chain.range.mockResolvedValue({ data: [], count: 0, error: null })

    await queryAdminSources(client, { is_active: 'false', page: 1, limit: 50, source_type: 'all' })

    expect(chain.eq).toHaveBeenCalledWith('is_active', false)
  })

  it('calculates correct offset for pagination', async () => {
    chain.range.mockResolvedValue({ data: [], count: 0, error: null })

    await queryAdminSources(client, { page: 3, limit: 20, is_active: 'all', source_type: 'all' })

    expect(chain.range).toHaveBeenCalledWith(40, 59)
  })

  it('throws on query error', async () => {
    chain.range.mockResolvedValue({ data: null, count: null, error: { message: 'DB error' } })

    await expect(queryAdminSources(client, { page: 1, limit: 50, is_active: 'all', source_type: 'all' })).rejects.toThrow(
      'Failed to query admin sources: DB error'
    )
  })
})

describe('createSource', () => {
  let client: SupabaseClient<Database>
  let chain: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockClient()
    client = mock.client
    chain = mock.chain
  })

  it('creates a source with auto-generated slug from name', async () => {
    chain.single.mockResolvedValue({ data: mockSource, error: null })

    const result = await createSource(client, {
      name: 'Test Source',
      bias: 'center',
      factuality: 'high',
      ownership: 'corporate',
      region: 'us',
      source_type: 'rss',
      ingestion_config: {},
    })

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Source',
        slug: 'test-source',
        bias: 'center',
        factuality: 'high',
        ownership: 'corporate',
        region: 'us',
        is_active: true,
      })
    )
    expect(chain.select).toHaveBeenCalled()
    expect(chain.single).toHaveBeenCalled()
    expect(result).toEqual(mockSource)
  })

  it('uses provided slug when given', async () => {
    chain.single.mockResolvedValue({ data: mockSource, error: null })

    await createSource(client, {
      name: 'Test Source',
      slug: 'custom-slug',
      bias: 'center',
      factuality: 'high',
      ownership: 'corporate',
      region: 'us',
      source_type: 'rss',
      ingestion_config: {},
    })

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'custom-slug' })
    )
  })

  it('throws friendly error on duplicate slug (code 23505)', async () => {
    chain.single.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })

    await expect(
      createSource(client, {
        name: 'Test Source',
        bias: 'center',
        factuality: 'high',
        ownership: 'corporate',
        region: 'us',
        source_type: 'rss',
        ingestion_config: {},
      })
    ).rejects.toThrow('A source with slug "test-source" already exists')
  })

  it('throws generic error on other DB errors', async () => {
    chain.single.mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    })

    await expect(
      createSource(client, {
        name: 'Test Source',
        bias: 'center',
        factuality: 'high',
        ownership: 'corporate',
        region: 'us',
        source_type: 'rss',
        ingestion_config: {},
      })
    ).rejects.toThrow('Failed to create source: relation does not exist')
  })
})

describe('updateSource', () => {
  let client: SupabaseClient<Database>
  let chain: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockClient()
    client = mock.client
    chain = mock.chain
  })

  it('applies partial update with provided fields', async () => {
    const updated = { ...mockSource, name: 'Updated Name', bias: 'left' }
    chain.single.mockResolvedValue({ data: updated, error: null })

    const result = await updateSource(client, 'src-1', { name: 'Updated Name', bias: 'left' })

    expect(chain.update).toHaveBeenCalledWith({ name: 'Updated Name', bias: 'left', bias_override: true })
    expect(chain.eq).toHaveBeenCalledWith('id', 'src-1')
    expect(chain.select).toHaveBeenCalled()
    expect(chain.single).toHaveBeenCalled()
    expect(result).toEqual(updated)
  })

  it('respects explicit bias_override: false even when bias changes', async () => {
    const updated = { ...mockSource, bias: 'left', bias_override: false }
    chain.single.mockResolvedValue({ data: updated, error: null })

    const result = await updateSource(client, 'src-1', { bias: 'left', bias_override: false })

    expect(chain.update).toHaveBeenCalledWith({ bias: 'left', bias_override: false })
    expect(result).toEqual(updated)
  })

  it('throws when no fields to update', async () => {
    await expect(updateSource(client, 'src-1', {})).rejects.toThrow('No fields to update')
  })

  it('throws when source not found', async () => {
    chain.single.mockResolvedValue({ data: null, error: null })

    await expect(updateSource(client, 'nonexistent', { name: 'New' })).rejects.toThrow(
      'Source not found'
    )
  })

  it('throws friendly error on duplicate slug (code 23505)', async () => {
    chain.single.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })

    await expect(updateSource(client, 'src-1', { slug: 'taken-slug' })).rejects.toThrow(
      'A source with that slug already exists'
    )
  })
})

describe('bulkCreateSources', () => {
  let client: SupabaseClient<Database>
  let chain: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createMockClient()
    client = mock.client
    chain = mock.chain
  })

  it('inserts a batch as an array in a single call', async () => {
    chain.insert.mockResolvedValue({ error: null })

    const rows = [
      { name: 'Source A', bias: 'left', factuality: 'high', ownership: 'corporate' },
      { name: 'Source B', bias: 'right', factuality: 'mixed', ownership: 'independent' },
      { name: 'Source C', bias: 'center', factuality: 'high', ownership: 'non-profit' },
    ]

    const result = await bulkCreateSources(client, rows)

    expect(result.inserted).toBe(3)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
    // Single batch insert call with an array
    expect(chain.insert).toHaveBeenCalledTimes(1)
    expect(chain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Source A' }),
        expect.objectContaining({ name: 'Source B' }),
        expect.objectContaining({ name: 'Source C' }),
      ])
    )
  })

  it('falls back to row-by-row on batch 23505 to identify duplicates', async () => {
    // Batch insert fails with duplicate
    chain.insert
      .mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } })
      // Row-by-row fallback
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } })
      .mockResolvedValueOnce({ error: null })

    const rows = [
      { name: 'Source A', bias: 'left', factuality: 'high', ownership: 'corporate' },
      { name: 'Source B', bias: 'right', factuality: 'mixed', ownership: 'independent' },
      { name: 'Source C', bias: 'center', factuality: 'high', ownership: 'non-profit' },
    ]

    const result = await bulkCreateSources(client, rows)

    expect(result.inserted).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toEqual({ row: 1, reason: 'Duplicate slug: source-b' })
    // 1 batch attempt + 3 row-by-row fallbacks
    expect(chain.insert).toHaveBeenCalledTimes(4)
  })

  it('records all rows in batch as errors on non-duplicate batch failure', async () => {
    chain.insert.mockResolvedValueOnce({ error: { code: '42P01', message: 'connection lost' } })

    const rows = [
      { name: 'Source A', bias: 'left', factuality: 'high', ownership: 'corporate' },
      { name: 'Source B', bias: 'right', factuality: 'mixed', ownership: 'independent' },
    ]

    const result = await bulkCreateSources(client, rows)

    expect(result.inserted).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toEqual({ row: 0, reason: 'connection lost' })
    expect(result.errors[1]).toEqual({ row: 1, reason: 'connection lost' })
  })

  it('splits into multiple batches for >50 rows', async () => {
    chain.insert.mockResolvedValue({ error: null })

    const rows = Array.from({ length: 60 }, (_, i) => ({
      name: `Source ${i}`,
      bias: 'center',
      factuality: 'high',
      ownership: 'corporate',
    }))

    const result = await bulkCreateSources(client, rows)

    expect(result.inserted).toBe(60)
    expect(result.errors).toHaveLength(0)
    // 2 batch insert calls: 50 + 10
    expect(chain.insert).toHaveBeenCalledTimes(2)
    const firstBatch = chain.insert.mock.calls[0][0] as unknown[]
    const secondBatch = chain.insert.mock.calls[1][0] as unknown[]
    expect(firstBatch).toHaveLength(50)
    expect(secondBatch).toHaveLength(10)
  })
})
