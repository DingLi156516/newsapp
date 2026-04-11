import { describe, it, expect } from 'vitest'
import {
  isSourceEligible,
  computeCooldownMs,
  shouldAutoDisable,
} from '@/lib/ingestion/source-policy'
import type { DbSource } from '@/lib/supabase/types'

function makeSource(overrides: Partial<DbSource> = {}): DbSource {
  return {
    id: 'src-1',
    slug: 'reuters',
    name: 'Reuters',
    bias: 'center',
    factuality: 'high',
    ownership: 'corporate',
    url: null,
    rss_url: 'https://reuters.com/feed',
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
    cooldown_until: null,
    auto_disabled_at: null,
    auto_disabled_reason: null,
    ...overrides,
  }
}

describe('isSourceEligible', () => {
  const now = new Date('2026-04-11T12:00:00Z')

  it('returns false when source is inactive', () => {
    const source = makeSource({ is_active: false })
    expect(isSourceEligible(source, now)).toBe(false)
  })

  it('returns false when source is auto-disabled', () => {
    const source = makeSource({ auto_disabled_at: '2026-04-10T00:00:00Z' })
    expect(isSourceEligible(source, now)).toBe(false)
  })

  it('returns false when cooldown is in the future', () => {
    const source = makeSource({ cooldown_until: '2026-04-11T13:00:00Z' })
    expect(isSourceEligible(source, now)).toBe(false)
  })

  it('returns true when cooldown is in the past', () => {
    const source = makeSource({ cooldown_until: '2026-04-11T11:00:00Z' })
    expect(isSourceEligible(source, now)).toBe(true)
  })

  it('returns true when cooldown is null and source is healthy', () => {
    const source = makeSource()
    expect(isSourceEligible(source, now)).toBe(true)
  })

  it('uses current time when no `now` is provided', () => {
    const source = makeSource()
    expect(isSourceEligible(source)).toBe(true)
  })

  it('treats cooldown exactly equal to now as eligible', () => {
    const source = makeSource({ cooldown_until: '2026-04-11T12:00:00Z' })
    // Strictly greater-than: a cooldown that just expired is eligible
    expect(isSourceEligible(source, now)).toBe(true)
  })
})

describe('computeCooldownMs', () => {
  it('returns 2 minutes for 1 failure', () => {
    expect(computeCooldownMs(1)).toBe(2 * 60 * 1000)
  })

  it('returns 4 minutes for 2 failures', () => {
    expect(computeCooldownMs(2)).toBe(4 * 60 * 1000)
  })

  it('returns 256 minutes capped to 240 for 8 failures', () => {
    // 2^8 = 256, capped to 240
    expect(computeCooldownMs(8)).toBe(240 * 60 * 1000)
  })

  it('caps at 240 minutes for 9 failures (exponent capped at 8)', () => {
    // 2^min(9, 8) = 256, capped to 240
    expect(computeCooldownMs(9)).toBe(240 * 60 * 1000)
  })

  it('caps at 240 minutes for 50 failures', () => {
    expect(computeCooldownMs(50)).toBe(240 * 60 * 1000)
  })

  it('returns 128 minutes for 7 failures (last unsaturated value)', () => {
    expect(computeCooldownMs(7)).toBe(128 * 60 * 1000)
  })
})

describe('shouldAutoDisable', () => {
  it('returns false when failures are below threshold', () => {
    expect(shouldAutoDisable(9, 5)).toBe(false)
  })

  it('returns true when failures meet threshold and lifetime success is low', () => {
    expect(shouldAutoDisable(10, 5)).toBe(true)
  })

  it('returns false when failures meet threshold but lifetime success is high', () => {
    expect(shouldAutoDisable(10, 25)).toBe(false)
  })

  it('returns true when both conditions hold strongly', () => {
    expect(shouldAutoDisable(50, 0)).toBe(true)
  })

  it('returns false at the lifetime success boundary (= 20)', () => {
    expect(shouldAutoDisable(10, 20)).toBe(false)
  })

  it('returns true just below the lifetime success boundary (= 19)', () => {
    expect(shouldAutoDisable(10, 19)).toBe(true)
  })
})
