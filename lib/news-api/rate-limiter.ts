/**
 * lib/news-api/rate-limiter.ts — Atomic rate limiter backed by Postgres.
 *
 * Provides per-provider quota tracking:
 * - NewsAPI: 100 requests/day (free tier), via shared DB quota (atomic RPC)
 * - GDELT: 1 request/second (politeness), via in-process cooldown
 *
 * The NewsAPI daily quota uses a Postgres RPC (`acquire_news_api_quota`)
 * introduced in migration 036 so that overlapping cron and admin runs across
 * multiple Node processes cannot exceed the quota. The GDELT politeness
 * interval is a per-process best-effort cooldown because GDELT has no
 * hard quota — it only asks callers to stay at roughly 1 req/sec.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { NewsApiProvider } from '@/lib/news-api/types'

interface ProviderQuota {
  readonly maxPerDay: number
  readonly minIntervalMs: number
}

const QUOTAS: Record<NewsApiProvider, ProviderQuota> = {
  newsapi: { maxPerDay: 100, minIntervalMs: 0 },
  gdelt: { maxPerDay: Number.MAX_SAFE_INTEGER, minIntervalMs: 1_000 },
}

// Per-process cooldown tracking for politeness intervals (GDELT)
const lastRequestAt = new Map<NewsApiProvider, number>()

export function resetRateLimiterState(): void {
  lastRequestAt.clear()
}

export interface AcquireResult {
  readonly acquired: boolean
  readonly reason?: string
  readonly waitMs?: number
}

/**
 * Atomically checks politeness interval, then attempts to acquire a quota slot
 * via a single DB RPC. Combines check+reserve into one atomic operation so
 * parallel callers cannot both pass the check and double-spend the quota.
 */
export async function tryAcquireQuota(
  client: SupabaseClient<Database>,
  provider: NewsApiProvider
): Promise<AcquireResult> {
  const quota = QUOTAS[provider]

  // Politeness interval check (in-process — not safe across processes but
  // GDELT has no hard quota, so this is just a best-effort cooldown)
  if (quota.minIntervalMs > 0) {
    const last = lastRequestAt.get(provider) ?? 0
    const elapsed = Date.now() - last
    if (elapsed < quota.minIntervalMs) {
      return {
        acquired: false,
        reason: `${provider} rate limit (min ${quota.minIntervalMs}ms between requests)`,
        waitMs: quota.minIntervalMs - elapsed,
      }
    }
  }

  // Daily quota: only applies to providers with a finite cap
  if (quota.maxPerDay < Number.MAX_SAFE_INTEGER) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any).rpc('acquire_news_api_quota', {
      p_provider: provider,
      p_max_per_day: quota.maxPerDay,
    })

    if (error) {
      return {
        acquired: false,
        reason: `${provider} quota check failed: ${error.message}`,
      }
    }

    if (data !== true) {
      return {
        acquired: false,
        reason: `${provider} daily quota exhausted (${quota.maxPerDay} requests/day)`,
      }
    }
  }

  // Record the politeness timestamp only after a successful acquire
  lastRequestAt.set(provider, Date.now())

  return { acquired: true }
}

export interface QuotaStatus {
  readonly used: number
  readonly remaining: number
  readonly resetDate: string | null
}

/**
 * Reads current quota status (non-atomic — informational only).
 */
export async function getQuotaStatus(
  client: SupabaseClient<Database>,
  provider: NewsApiProvider
): Promise<QuotaStatus> {
  const quota = QUOTAS[provider]

  if (quota.maxPerDay >= Number.MAX_SAFE_INTEGER) {
    return { used: 0, remaining: Number.MAX_SAFE_INTEGER, resetDate: null }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc('get_news_api_quota', {
    p_provider: provider,
  })

  if (error || !data || data.length === 0) {
    return { used: 0, remaining: quota.maxPerDay, resetDate: null }
  }

  const row = data[0] as { used: number; reset_date: string | null }
  const used = row.used ?? 0
  return {
    used,
    remaining: Math.max(0, quota.maxPerDay - used),
    resetDate: row.reset_date,
  }
}
