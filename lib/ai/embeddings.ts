/**
 * lib/ai/embeddings.ts — Embedding pipeline for articles.
 *
 * Fetches un-embedded articles from the database, generates embeddings
 * via Gemini, and stores them back. Processes in configurable batch sizes.
 *
 * Claiming uses the atomic `claim_articles_for_embedding` RPC (migration 037)
 * which performs a DB-side compare-and-set with owner token, so overlapping
 * pipeline runs cannot claim the same rows.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { generateEmbeddingBatch } from '@/lib/ai/gemini-client'
import {
  claimEmbeddingBatch,
  generateClaimOwner,
  releaseEmbeddingClaims,
  type ClaimOwner,
} from '@/lib/pipeline/claim-utils'
import { computeRetryOutcome } from '@/lib/pipeline/retry-policy'
import { pushToDeadLetter } from '@/lib/pipeline/dead-letter'
import {
  noopStageEmitter,
  safeEmit,
  type StageEventEmitter,
} from '@/lib/pipeline/stage-events'

const EMBED_BATCH_SIZE = Number(process.env.EMBED_BATCH_SIZE ?? 100)

interface UnembeddedArticle {
  id: string
  title: string
  description: string | null
  title_fingerprint: string | null
  embedding_retry_count?: number
}

export interface EmbeddingResult {
  readonly totalProcessed: number
  readonly claimedArticles: number
  readonly cacheHits: number
  readonly errors: readonly string[]
  readonly dbTimeMs?: number
  readonly modelTimeMs?: number
}

interface CachedEmbedding {
  readonly embedding: number[]
  readonly embeddingText: string
}

async function lookupCachedEmbeddings(
  client: SupabaseClient<Database>,
  fingerprints: readonly string[]
): Promise<{ cache: Map<string, CachedEmbedding[]>; errors: string[] }> {
  const cache = new Map<string, CachedEmbedding[]>()
  const errors: string[] = []
  if (fingerprints.length === 0) return { cache, errors }

  const unique = [...new Set(fingerprints)]

  // Query one representative row per fingerprint. We need text matching so
  // fetch title+description alongside the embedding. The result set is bounded
  // by the IN filter (at most ~200 unique fingerprints per embed pass).
  // PostgREST default limit (1000) is sufficient; no explicit limit needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('articles') as any)
    .select('title_fingerprint, title, description, embedding')
    .in('title_fingerprint', unique)
    .eq('is_embedded', true)
    .not('embedding', 'is', null)

  if (error) {
    errors.push(`Embedding cache lookup failed: ${error.message}`)
    return { cache, errors }
  }

  if (!data) return { cache, errors }

  const seen = new Set<string>()
  for (const row of data as { title_fingerprint: string; title: string; description: string | null; embedding: number[] }[]) {
    const embeddingText = row.description
      ? `${row.title} — ${row.description}`
      : row.title
    const dedupeKey = `${row.title_fingerprint}::${embeddingText}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    const entries = cache.get(row.title_fingerprint) ?? []
    cache.set(row.title_fingerprint, [...entries, { embedding: row.embedding, embeddingText }])
  }

  return { cache, errors }
}

function buildEmbeddingText(article: UnembeddedArticle): string {
  const parts = [article.title]
  if (article.description) {
    parts.push(article.description)
  }
  return parts.join(' — ')
}

async function fetchClaimedArticles(
  client: SupabaseClient<Database>,
  claimedIds: readonly string[]
): Promise<UnembeddedArticle[]> {
  if (claimedIds.length === 0) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (client.from('articles') as any)
    .select('id, title, description, title_fingerprint, embedding_retry_count')

  const withFilter = typeof query.in === 'function'
    ? query.in('id', claimedIds)
    : query

  const { data, error } = await withFilter

  if (error) {
    throw new Error(`Failed to fetch claimed articles: ${error.message}`)
  }

  return (data as UnembeddedArticle[] | null) ?? []
}

/**
 * Handle per-item embedding failure with exponential backoff and DLQ
 * escalation when the retry budget is exhausted.
 *
 * Each article gets:
 *   - embedding_retry_count += 1
 *   - embedding_next_attempt_at = now + backoff (shields it from claim RPC)
 *   - embedding_last_error = the error message
 *   - claim cleared so another owner can retry after the backoff expires
 *
 * On exhaustion we push a DLQ entry AND set next_attempt_at to a far-future
 * date so the claim RPC permanently excludes the row until an operator
 * replays the DLQ entry.
 */
async function handleEmbeddingFailure(
  client: SupabaseClient<Database>,
  failedArticles: readonly UnembeddedArticle[],
  errorMessage: string,
  emitter: StageEventEmitter
): Promise<void> {
  if (failedArticles.length === 0) return

  const FAR_FUTURE = '2099-01-01T00:00:00Z'

  for (const article of failedArticles) {
    const previous = article.embedding_retry_count ?? 0
    const outcome = computeRetryOutcome('embed', previous)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from('articles') as any)
      .update({
        embedding_retry_count: outcome.nextRetryCount,
        embedding_next_attempt_at: outcome.exhausted
          ? FAR_FUTURE
          : outcome.nextAttemptAt.toISOString(),
        embedding_last_error: errorMessage,
        embedding_claimed_at: null,
        embedding_claim_owner: null,
      })
      .eq('id', article.id)

    if (outcome.exhausted) {
      await pushToDeadLetter(client, {
        itemKind: 'article_embed',
        itemId: article.id,
        retryCount: outcome.nextRetryCount,
        lastError: errorMessage,
      })
      await safeEmit(emitter, {
        stage: 'embed',
        level: 'error',
        eventType: 'dlq_pushed',
        itemId: article.id,
        payload: {
          articleId: article.id,
          retryCount: outcome.nextRetryCount,
          error: errorMessage,
        },
      })
    }
  }
}

async function bulkWriteEmbeddings(
  client: SupabaseClient<Database>,
  batch: readonly UnembeddedArticle[],
  embeddings: readonly { readonly embedding: readonly number[] }[],
  emitter: StageEventEmitter
): Promise<{ processed: number; errors: string[] }> {
  const rows = batch.map((article, index) => ({
    id: article.id,
    embedding: embeddings[index]?.embedding as number[],
    is_embedded: true,
    embedding_claimed_at: null,
    embedding_claim_owner: null,
  }))

  const errors: string[] = []

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = client.from('articles') as any
    if (typeof table.upsert === 'function') {
      const { error } = await table.upsert(rows, { onConflict: 'id' })
      if (!error) {
        return { processed: rows.length, errors }
      }
      errors.push(`Batch embedding write failed: ${error.message}`)
      await safeEmit(emitter, {
        stage: 'embed',
        level: 'error',
        eventType: 'embedding_write_failed',
        payload: { error: error.message, batchSize: rows.length },
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`Batch embedding write failed: ${message}`)
    await safeEmit(emitter, {
      stage: 'embed',
      level: 'error',
      eventType: 'embedding_write_failed',
      payload: { error: message, batchSize: rows.length },
    })
  }

  let processed = 0

  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from('articles') as any)
      .update({
        embedding: row.embedding,
        is_embedded: row.is_embedded,
        embedding_claimed_at: row.embedding_claimed_at,
        embedding_claim_owner: row.embedding_claim_owner,
      })
      .eq('id', row.id)

    if (error) {
      errors.push(`Update failed for ${row.id}: ${error.message}`)
    } else {
      processed += 1
    }
  }

  return { processed, errors }
}

export async function embedUnembeddedArticles(
  client: SupabaseClient<Database>,
  maxArticles = 500,
  owner: ClaimOwner = generateClaimOwner(),
  emitter: StageEventEmitter = noopStageEmitter
): Promise<EmbeddingResult> {
  let dbTimeMs = 0
  let modelTimeMs = 0
  const errors: string[] = []
  let totalProcessed = 0
  let cacheHits = 0

  const claimStartedAt = Date.now()
  const claimedIds = await claimEmbeddingBatch(client, owner, maxArticles)
  dbTimeMs += Date.now() - claimStartedAt

  if (claimedIds.length === 0) {
    return { totalProcessed: 0, claimedArticles: 0, cacheHits: 0, errors: [], dbTimeMs, modelTimeMs: 0 }
  }

  let articles: UnembeddedArticle[]
  const fetchStartedAt = Date.now()
  try {
    articles = await fetchClaimedArticles(client, claimedIds)
  } catch (err) {
    // Fetch failed — release the claims so another run can retry.
    await releaseEmbeddingClaims(client, claimedIds, owner)
    throw err
  }
  dbTimeMs += Date.now() - fetchStartedAt

  if (articles.length === 0) {
    return { totalProcessed: 0, claimedArticles: claimedIds.length, cacheHits: 0, errors, dbTimeMs, modelTimeMs: 0 }
  }

  const cacheFingerprints = articles
    .map((a) => a.title_fingerprint)
    .filter((fp): fp is string => fp !== null)
  const cacheLookupStart = Date.now()
  const cacheResult = await lookupCachedEmbeddings(client, cacheFingerprints)
  dbTimeMs += Date.now() - cacheLookupStart
  errors.push(...cacheResult.errors)
  const embeddingCache = cacheResult.cache

  for (let i = 0; i < articles.length; i += EMBED_BATCH_SIZE) {
    const batch = articles.slice(i, i + EMBED_BATCH_SIZE)

    const cachedArticles: UnembeddedArticle[] = []
    const cachedEmbeddings: { embedding: number[] }[] = []
    const uncachedArticles: UnembeddedArticle[] = []

    for (const article of batch) {
      const articleText = buildEmbeddingText(article)
      const candidates = article.title_fingerprint
        ? embeddingCache.get(article.title_fingerprint)
        : undefined
      const matched = candidates?.find((c) => c.embeddingText === articleText)
      if (matched) {
        cachedArticles.push(article)
        cachedEmbeddings.push({ embedding: matched.embedding })
      } else {
        uncachedArticles.push(article)
      }
    }

    if (cachedArticles.length > 0) {
      const writeStartedAt = Date.now()
      const writeResult = await bulkWriteEmbeddings(client, cachedArticles, cachedEmbeddings, emitter)
      dbTimeMs += Date.now() - writeStartedAt
      totalProcessed += writeResult.processed
      cacheHits += writeResult.processed
      errors.push(...writeResult.errors)
    }

    if (uncachedArticles.length > 0) {
      const texts = uncachedArticles.map(buildEmbeddingText)
      try {
        const modelStartedAt = Date.now()
        const embeddings = await generateEmbeddingBatch(texts)
        modelTimeMs += Date.now() - modelStartedAt

        const writeStartedAt = Date.now()
        const writeResult = await bulkWriteEmbeddings(client, uncachedArticles, embeddings, emitter)
        dbTimeMs += Date.now() - writeStartedAt
        totalProcessed += writeResult.processed
        errors.push(...writeResult.errors)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push(`Batch embedding failed: ${message}`)
        // Exponential backoff + DLQ escalation per retry budget. The
        // handler also clears the claim so another owner can retry after
        // the backoff window expires.
        const failureStartedAt = Date.now()
        await handleEmbeddingFailure(client, uncachedArticles, message, emitter)
        dbTimeMs += Date.now() - failureStartedAt
      }
    }
  }

  return {
    totalProcessed,
    claimedArticles: claimedIds.length,
    cacheHits,
    errors,
    dbTimeMs,
    modelTimeMs,
  }
}
