import {
  tryAcquireQuota,
  getQuotaStatus,
  resetRateLimiterState,
} from '@/lib/news-api/rate-limiter'

function createMockClient(rpcReturns: { data?: unknown; error?: { message: string } | null }) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: rpcReturns.data ?? null,
      error: rpcReturns.error ?? null,
    }),
  } as never
}

describe('rate-limiter', () => {
  beforeEach(() => {
    resetRateLimiterState()
  })

  describe('tryAcquireQuota', () => {
    it('calls acquire_news_api_quota RPC for newsapi', async () => {
      const client = createMockClient({ data: true })

      const result = await tryAcquireQuota(client, 'newsapi')

      expect(result.acquired).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((client as any).rpc).toHaveBeenCalledWith('acquire_news_api_quota', {
        p_provider: 'newsapi',
        p_max_per_day: 100,
      })
    })

    it('returns not-acquired when RPC says quota exhausted', async () => {
      const client = createMockClient({ data: false })

      const result = await tryAcquireQuota(client, 'newsapi')

      expect(result.acquired).toBe(false)
      expect(result.reason).toContain('daily quota exhausted')
    })

    it('returns not-acquired on RPC error', async () => {
      const client = createMockClient({ error: { message: 'db error' } })

      const result = await tryAcquireQuota(client, 'newsapi')

      expect(result.acquired).toBe(false)
      expect(result.reason).toContain('quota check failed')
    })

    it('skips DB quota check for gdelt (no hard cap)', async () => {
      const client = createMockClient({})

      const result = await tryAcquireQuota(client, 'gdelt')

      expect(result.acquired).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((client as any).rpc).not.toHaveBeenCalled()
    })

    it('enforces gdelt politeness interval between consecutive calls', async () => {
      const client = createMockClient({})

      const first = await tryAcquireQuota(client, 'gdelt')
      expect(first.acquired).toBe(true)

      const second = await tryAcquireQuota(client, 'gdelt')
      expect(second.acquired).toBe(false)
      expect(second.reason).toContain('rate limit')
      expect(second.waitMs).toBeGreaterThan(0)
    })
  })

  describe('getQuotaStatus', () => {
    it('returns status from get_news_api_quota RPC', async () => {
      const client = createMockClient({
        data: [{ used: 42, reset_date: '2026-04-09', last_request_at: null }],
      })

      const status = await getQuotaStatus(client, 'newsapi')

      expect(status.used).toBe(42)
      expect(status.remaining).toBe(58)
      expect(status.resetDate).toBe('2026-04-09')
    })

    it('returns zero used when no quota row exists', async () => {
      const client = createMockClient({ data: [] })

      const status = await getQuotaStatus(client, 'newsapi')

      expect(status.used).toBe(0)
      expect(status.remaining).toBe(100)
    })

    it('returns unbounded remaining for gdelt', async () => {
      const client = createMockClient({})

      const status = await getQuotaStatus(client, 'gdelt')

      expect(status.remaining).toBe(Number.MAX_SAFE_INTEGER)
    })
  })
})
