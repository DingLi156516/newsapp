import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { syncProviderRatings } from '@/lib/api/bias-sync-queries'

vi.mock('@/lib/bias-ratings/providers/mbfc', () => ({
  lookupMbfc: vi.fn(),
}))

vi.mock('@/lib/bias-ratings/providers/allsides', () => ({
  lookupAllSides: vi.fn(),
}))

vi.mock('@/lib/bias-ratings/providers/adfontesmedia', () => ({
  lookupAdFontes: vi.fn(),
}))

vi.mock('@/lib/bias-ratings/aggregator', () => ({
  aggregateRatings: vi.fn(),
}))

import { lookupMbfc } from '@/lib/bias-ratings/providers/mbfc'
import { lookupAllSides } from '@/lib/bias-ratings/providers/allsides'
import { lookupAdFontes } from '@/lib/bias-ratings/providers/adfontesmedia'
import { aggregateRatings } from '@/lib/bias-ratings/aggregator'

const mockLookupMbfc = vi.mocked(lookupMbfc)
const mockLookupAllSides = vi.mocked(lookupAllSides)
const mockLookupAdFontes = vi.mocked(lookupAdFontes)
const mockAggregateRatings = vi.mocked(aggregateRatings)

function createMockClient(sources: Record<string, unknown>[]) {
  const updateChain = {
    eq: vi.fn().mockResolvedValue({ error: null }),
  }

  const chain = {
    select: vi.fn().mockResolvedValue({ data: sources, error: null }),
    update: vi.fn().mockReturnValue(updateChain),
  }

  const client = {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as SupabaseClient<Database>

  return { client, chain, updateChain }
}

const noMatch = { matched: false, rating: null, matchedOn: null }

describe('syncProviderRatings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLookupAdFontes.mockReturnValue(noMatch)
  })

  it('syncs provider ratings for sources with URLs', async () => {
    const sources = [
      { id: 's1', url: 'https://cnn.com', name: 'CNN', slug: 'cnn', bias: 'left', factuality: 'mixed', bias_override: false },
    ]
    const { client } = createMockClient(sources)

    mockLookupMbfc.mockReturnValue({
      matched: true,
      rating: { provider: 'mbfc', bias: 'far-left', factuality: 'mixed' },
      matchedOn: 'cnn.com',
    })
    mockLookupAllSides.mockReturnValue({
      matched: true,
      rating: { provider: 'allsides', bias: 'left', factuality: null },
      matchedOn: 'cnn.com',
    })
    mockAggregateRatings.mockReturnValue({
      bias: 'left',
      factuality: 'mixed',
      providerCount: 2,
      ratings: [],
    })

    const result = await syncProviderRatings(client)
    expect(result.synced).toBe(1)
    expect(result.skipped).toBe(0)
  })

  it('skips sources without URLs', async () => {
    const sources = [
      { id: 's1', url: null, name: 'No URL', slug: 'no-url', bias: 'center', factuality: 'high', bias_override: false },
    ]
    const { client } = createMockClient(sources)

    const result = await syncProviderRatings(client)
    expect(result.skipped).toBe(1)
    expect(result.synced).toBe(0)
  })

  it('respects bias_override flag', async () => {
    const sources = [
      { id: 's1', url: 'https://cnn.com', name: 'CNN', slug: 'cnn', bias: 'center', factuality: 'high', bias_override: true },
    ]
    const { client, chain } = createMockClient(sources)

    mockLookupMbfc.mockReturnValue({
      matched: true,
      rating: { provider: 'mbfc', bias: 'far-left', factuality: 'mixed' },
      matchedOn: 'cnn.com',
    })
    mockLookupAllSides.mockReturnValue(noMatch)

    const result = await syncProviderRatings(client)
    expect(result.overridden).toBe(1)
    expect(mockAggregateRatings).not.toHaveBeenCalled()

    // Should still write provider columns but not effective bias/factuality
    const updateCall = chain.update.mock.calls[0][0]
    expect(updateCall.bias_mbfc).toBe('far-left')
    expect(updateCall).not.toHaveProperty('bias', 'far-left')
  })

  it('updates effective bias/factuality when not overridden', async () => {
    const sources = [
      { id: 's1', url: 'https://reuters.com', name: 'Reuters', slug: 'reuters', bias: 'center', factuality: 'high', bias_override: false },
    ]
    const { client, chain } = createMockClient(sources)

    mockLookupMbfc.mockReturnValue({
      matched: true,
      rating: { provider: 'mbfc', bias: 'center', factuality: 'very-high' },
      matchedOn: 'reuters.com',
    })
    mockLookupAllSides.mockReturnValue({
      matched: true,
      rating: { provider: 'allsides', bias: 'center', factuality: null },
      matchedOn: 'reuters.com',
    })
    mockAggregateRatings.mockReturnValue({
      bias: 'center',
      factuality: 'very-high',
      providerCount: 2,
      ratings: [],
    })

    await syncProviderRatings(client)

    const updateCall = chain.update.mock.calls[0][0]
    expect(updateCall.bias).toBe('center')
    expect(updateCall.factuality).toBe('very-high')
  })

  it('handles update errors gracefully', async () => {
    const sources = [
      { id: 's1', url: 'https://cnn.com', name: 'CNN', slug: 'cnn', bias: 'left', factuality: 'mixed', bias_override: false },
    ]

    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
    }
    const chain = {
      select: vi.fn().mockResolvedValue({ data: sources, error: null }),
      update: vi.fn().mockReturnValue(updateChain),
    }
    const client = {
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient<Database>

    mockLookupMbfc.mockReturnValue(noMatch)
    mockLookupAllSides.mockReturnValue(noMatch)

    const result = await syncProviderRatings(client)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].source).toBe('CNN')
    expect(result.errors[0].reason).toBe('DB error')
  })

  it('throws on fetch error', async () => {
    const chain = {
      select: vi.fn().mockResolvedValue({ data: null, error: { message: 'Connection failed' } }),
    }
    const client = {
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient<Database>

    await expect(syncProviderRatings(client)).rejects.toThrow('Failed to fetch sources')
  })

  it('handles multiple sources with mixed results', async () => {
    const sources = [
      { id: 's1', url: 'https://cnn.com', name: 'CNN', slug: 'cnn', bias: 'left', factuality: 'mixed', bias_override: false },
      { id: 's2', url: null, name: 'No URL', slug: 'no-url', bias: 'center', factuality: 'high', bias_override: false },
      { id: 's3', url: 'https://reuters.com', name: 'Reuters', slug: 'reuters', bias: 'center', factuality: 'very-high', bias_override: true },
    ]
    const { client } = createMockClient(sources)

    mockLookupMbfc.mockReturnValue(noMatch)
    mockLookupAllSides.mockReturnValue(noMatch)

    const result = await syncProviderRatings(client)
    expect(result.synced).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.overridden).toBe(1)
  })

  it('does not update effective bias when no providers match and increments unmatched', async () => {
    const sources = [
      { id: 's1', url: 'https://unknown.com', name: 'Unknown', slug: 'unknown', bias: 'center', factuality: 'high', bias_override: false },
    ]
    const { client, chain } = createMockClient(sources)

    mockLookupMbfc.mockReturnValue(noMatch)
    mockLookupAllSides.mockReturnValue(noMatch)

    const result = await syncProviderRatings(client)

    const updateCall = chain.update.mock.calls[0][0]
    expect(updateCall).not.toHaveProperty('bias')
    expect(updateCall).not.toHaveProperty('factuality')
    expect(updateCall.bias_mbfc).toBeNull()
    expect(updateCall.bias_allsides).toBeNull()
    expect(result.unmatched).toBe(1)
  })
})
