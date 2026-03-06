import { describe, it, expect, vi } from 'vitest'
import { queryPreferences, updatePreferences } from '@/lib/api/preferences-queries'

function createMockClient(overrides: Record<string, unknown> = {}) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    ...overrides,
  }

  return {
    from: vi.fn(() => chainable),
    _chain: chainable,
  }
}

describe('queryPreferences', () => {
  it('returns existing preferences', async () => {
    const mockPrefs = {
      id: 'pref-1',
      user_id: 'user-1',
      followed_topics: ['politics'],
      default_region: 'us',
      default_perspective: 'all',
      factuality_minimum: 'mixed',
    }

    const mockClient = createMockClient()
    mockClient._chain.single.mockResolvedValue({ data: mockPrefs, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await queryPreferences(mockClient as any, 'user-1')
    expect(result).toEqual(mockPrefs)
    expect(mockClient.from).toHaveBeenCalledWith('user_preferences')
  })

  it('auto-creates preferences when none exist', async () => {
    const mockPrefs = {
      id: 'new-1',
      user_id: 'user-1',
      followed_topics: [],
      default_region: 'us',
      default_perspective: 'all',
      factuality_minimum: 'mixed',
    }

    const mockClient = createMockClient()

    // First call (select) returns PGRST116 (not found)
    let singleCallCount = 0
    mockClient._chain.single.mockImplementation(() => {
      singleCallCount++
      if (singleCallCount === 1) {
        return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
      }
      return Promise.resolve({ data: mockPrefs, error: null })
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await queryPreferences(mockClient as any, 'user-1')
    expect(result).toEqual(mockPrefs)
  })

  it('throws on unexpected error', async () => {
    const mockClient = createMockClient()
    mockClient._chain.single.mockResolvedValue({
      data: null,
      error: { code: 'OTHER', message: 'Connection failed' },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(queryPreferences(mockClient as any, 'user-1')).rejects.toThrow(
      'Failed to query preferences: Connection failed'
    )
  })
})

describe('updatePreferences', () => {
  it('updates and returns preferences', async () => {
    const mockPrefs = {
      id: 'pref-1',
      user_id: 'user-1',
      followed_topics: ['politics', 'technology'],
      default_region: 'uk',
    }

    const mockClient = createMockClient()
    mockClient._chain.single.mockResolvedValue({ data: mockPrefs, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await updatePreferences(mockClient as any, 'user-1', {
      default_region: 'uk',
      followed_topics: ['politics', 'technology'],
    })
    expect(result).toEqual(mockPrefs)
  })

  it('throws on update error', async () => {
    const mockClient = createMockClient()
    mockClient._chain.single.mockResolvedValue({
      data: null,
      error: { message: 'Update failed' },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(
      updatePreferences(mockClient as any, 'user-1', { default_region: 'uk' })
    ).rejects.toThrow('Failed to update preferences: Update failed')
  })
})
