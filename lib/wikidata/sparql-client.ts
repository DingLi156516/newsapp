/**
 * lib/wikidata/sparql-client.ts — Small typed wrapper around Wikidata's public
 * SPARQL endpoint (https://query.wikidata.org/sparql).
 *
 * Kept out of lib/api/ because it's a data-engineering concern (backfill
 * scripts) rather than a request-time dependency. Build-time only.
 *
 * Features:
 *   - Rate-limited request queue (default 1 req/sec, Wikidata courtesy)
 *   - Per-request timeout via AbortController
 *   - Simple retry-with-backoff on 429/503
 *   - User-Agent header (Wikidata requires a contact URL/email)
 */

const DEFAULT_ENDPOINT = 'https://query.wikidata.org/sparql'
const DEFAULT_USER_AGENT = 'AxiomNewsOwnershipBackfill/1.0 (https://github.com/anthropic/axiom-news; contact: ops@axiom.news)'

export interface SparqlBinding {
  readonly type: string
  readonly value: string
  readonly 'xml:lang'?: string
  readonly datatype?: string
}

export interface SparqlResponse {
  readonly head: { readonly vars: readonly string[] }
  readonly results: { readonly bindings: readonly Record<string, SparqlBinding>[] }
}

export interface SparqlClientOptions {
  readonly endpoint?: string
  readonly userAgent?: string
  /** Minimum ms between successive outbound requests. Default 1000. */
  readonly minIntervalMs?: number
  /** Per-request timeout in ms. Default 20000. */
  readonly timeoutMs?: number
  /** Max retries on 429/503. Default 3. */
  readonly maxRetries?: number
  /** Injected fetch for testing. */
  readonly fetchImpl?: typeof fetch
  /** Injected sleep for deterministic testing. */
  readonly sleepImpl?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export class SparqlClient {
  private readonly endpoint: string
  private readonly userAgent: string
  private readonly minIntervalMs: number
  private readonly timeoutMs: number
  private readonly maxRetries: number
  private readonly fetchImpl: typeof fetch
  private readonly sleepImpl: (ms: number) => Promise<void>
  private lastRequestAt = 0
  private queue: Promise<unknown> = Promise.resolve()

  constructor(opts: SparqlClientOptions = {}) {
    this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT
    this.userAgent = opts.userAgent ?? DEFAULT_USER_AGENT
    this.minIntervalMs = opts.minIntervalMs ?? 1000
    this.timeoutMs = opts.timeoutMs ?? 20000
    this.maxRetries = opts.maxRetries ?? 3
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch
    this.sleepImpl = opts.sleepImpl ?? defaultSleep
  }

  /**
   * Submit a SPARQL query and parse the JSON response. Requests are queued so
   * concurrent callers still respect minIntervalMs.
   */
  query(sparql: string): Promise<SparqlResponse> {
    const run = async (): Promise<SparqlResponse> => {
      await this.throttle()
      return this.sendWithRetry(sparql, 0)
    }
    const next = this.queue.then(run, run)
    this.queue = next.catch(() => undefined)
    return next
  }

  private async throttle(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestAt
    if (this.lastRequestAt > 0 && elapsed < this.minIntervalMs) {
      await this.sleepImpl(this.minIntervalMs - elapsed)
    }
    this.lastRequestAt = Date.now()
  }

  private async sendWithRetry(sparql: string, attempt: number): Promise<SparqlResponse> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const body = new URLSearchParams({ query: sparql, format: 'json' })
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent,
        },
        body,
        signal: controller.signal,
      })

      if (response.status === 429 || response.status === 503) {
        if (attempt >= this.maxRetries) {
          throw new Error(`Wikidata SPARQL throttled (${response.status}) after ${attempt} retries`)
        }
        const backoff = 2 ** attempt * this.minIntervalMs
        await this.sleepImpl(backoff)
        return this.sendWithRetry(sparql, attempt + 1)
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`Wikidata SPARQL failed: ${response.status} ${response.statusText} — ${text.slice(0, 200)}`)
      }

      const payload = (await response.json()) as SparqlResponse
      if (!payload?.results?.bindings) {
        throw new Error('Wikidata SPARQL returned malformed response (missing results.bindings)')
      }
      return payload
    } finally {
      clearTimeout(timer)
    }
  }
}

/** Extract a Wikidata QID (e.g. Q123) from a URI like http://www.wikidata.org/entity/Q123. */
export function qidFromUri(uri: string | undefined): string | null {
  if (!uri) return null
  const match = uri.match(/Q\d+$/)
  return match ? match[0] : null
}
