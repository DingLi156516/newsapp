/**
 * Tests for lib/wikidata/sparql-client.ts — verify HTTP envelope, retry
 * behavior, throttling, and QID parsing. Uses injected fetch + sleep so tests
 * don't actually hit Wikidata.
 */

import { describe, it, expect, vi } from 'vitest'
import { SparqlClient, qidFromUri } from '@/lib/wikidata/sparql-client'

function makeResponse(
  body: unknown,
  init: { status?: number; statusText?: string } = {}
): Response {
  const response = new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: { 'Content-Type': 'application/sparql-results+json' },
  })
  return response
}

function emptyBindings() {
  return { head: { vars: [] }, results: { bindings: [] } }
}

describe('SparqlClient', () => {
  it('posts SPARQL with correct headers and body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(emptyBindings()))
    const client = new SparqlClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => undefined,
      minIntervalMs: 0,
    })

    await client.query('SELECT ?x WHERE { ?x wdt:P31 wd:Q5 } LIMIT 1')

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://query.wikidata.org/sparql')
    expect(init.method).toBe('POST')
    expect(init.headers['Accept']).toBe('application/sparql-results+json')
    expect(init.headers['User-Agent']).toContain('AxiomNews')
    expect(init.body.toString()).toContain('query=')
    expect(init.body.toString()).toContain('format=json')
  })

  it('retries on 429 with exponential backoff', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(makeResponse({}, { status: 429, statusText: 'Too Many Requests' }))
      .mockResolvedValueOnce(makeResponse(emptyBindings()))
    const sleeps: number[] = []
    const client = new SparqlClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async (ms) => {
        sleeps.push(ms)
      },
      minIntervalMs: 100,
      maxRetries: 3,
    })

    await client.query('SELECT 1')

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    // First sleep is initial backoff (2^0 * 100 = 100); subsequent throttle skip
    expect(sleeps).toContain(100)
  })

  it('throws when retries are exhausted', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(makeResponse({}, { status: 503, statusText: 'Service Unavailable' }))
    const client = new SparqlClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => undefined,
      minIntervalMs: 0,
      maxRetries: 2,
    })

    await expect(client.query('SELECT 1')).rejects.toThrow(/throttled/i)
  })

  it('throws on non-ok responses other than 429/503 without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('Bad syntax', { status: 400, statusText: 'Bad Request' })
    )
    const client = new SparqlClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => undefined,
      minIntervalMs: 0,
      maxRetries: 3,
    })

    await expect(client.query('SELECT 1')).rejects.toThrow(/400 Bad Request/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('aborts in-flight requests after the per-request timeout', async () => {
    const fetchImpl = vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })
    const client = new SparqlClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => undefined,
      minIntervalMs: 0,
      timeoutMs: 10,
      maxRetries: 0,
    })

    await expect(client.query('SELECT 1')).rejects.toThrow(/aborted/i)
  })

  it('rejects malformed responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ nope: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/sparql-results+json' },
      })
    )
    const client = new SparqlClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => undefined,
      minIntervalMs: 0,
    })

    await expect(client.query('SELECT 1')).rejects.toThrow(/malformed/i)
  })

  it('serializes concurrent queries with the minimum interval between them', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => makeResponse(emptyBindings()))
    const sleeps: number[] = []
    const client = new SparqlClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async (ms) => {
        sleeps.push(ms)
      },
      minIntervalMs: 500,
    })

    await Promise.all([client.query('SELECT 1'), client.query('SELECT 2')])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    // The second call should trigger a throttle sleep (close to 500ms; timing varies)
    expect(sleeps.some((ms) => ms > 0)).toBe(true)
  })
})

describe('qidFromUri', () => {
  it('extracts QID from Wikidata URIs', () => {
    expect(qidFromUri('http://www.wikidata.org/entity/Q3570967')).toBe('Q3570967')
    expect(qidFromUri('https://www.wikidata.org/wiki/Q5')).toBe('Q5')
  })

  it('returns null for missing or malformed inputs', () => {
    expect(qidFromUri(undefined)).toBeNull()
    expect(qidFromUri('')).toBeNull()
    expect(qidFromUri('not-a-qid')).toBeNull()
  })
})
