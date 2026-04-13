/**
 * Tests for app/api/cron/recluster/route.ts (GET).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockMakeStageEmitter = vi.fn(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServiceClient: vi.fn(() => ({ __serviceClient: true })),
}))

vi.mock('@/lib/ai/recluster', () => ({
  reclusterRecentStories: vi.fn(),
}))

vi.mock('@/lib/pipeline/logger', () => ({
  PipelineLogger: vi.fn(() => ({
    makeStageEmitter: mockMakeStageEmitter,
  })),
}))

import { GET } from '@/app/api/cron/recluster/route'
import { reclusterRecentStories } from '@/lib/ai/recluster'

const mockRecluster = vi.mocked(reclusterRecentStories)

const CRON_SECRET = 'test-cron-secret-value'

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (authHeader !== undefined) {
    headers['authorization'] = authHeader
  }
  return new NextRequest('http://localhost/api/cron/recluster', { headers })
}

describe('GET /api/cron/recluster', () => {
  const originalEnv = process.env.CRON_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = CRON_SECRET
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CRON_SECRET = originalEnv
    } else {
      delete process.env.CRON_SECRET
    }
  })

  it('returns 500 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('CRON_SECRET not configured')
  })

  it('returns 401 without authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 401 with wrong secret', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 401 with non-Bearer auth scheme', async () => {
    const res = await GET(makeRequest(`Basic ${CRON_SECRET}`))
    expect(res.status).toBe(401)
  })

  it('returns 200 with recluster stats on success', async () => {
    const reclusterResult = {
      mergedCount: 3,
      ejectedCount: 1,
      scannedStories: 50,
    }
    mockRecluster.mockResolvedValue(reclusterResult as never)

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.correlationId).toEqual(expect.any(String))
    expect(json.data).toEqual(reclusterResult)
  })

  it('passes a stage emitter to reclusterRecentStories', async () => {
    mockRecluster.mockResolvedValue({} as never)

    await GET(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(mockMakeStageEmitter).toHaveBeenCalledWith(
      expect.any(String),
      null
    )
    expect(mockRecluster).toHaveBeenCalledWith(
      expect.objectContaining({ __serviceClient: true }),
      undefined,
      expect.any(Function)
    )
  })

  it('returns 500 when recluster throws', async () => {
    mockRecluster.mockRejectedValue(new Error('pgvector unavailable'))

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('pgvector unavailable')
    expect(json.correlationId).toEqual(expect.any(String))
  })
})
