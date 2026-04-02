/**
 * lib/ai/embeddings.ts — Embedding pipeline for articles.
 *
 * Fetches un-embedded articles from the database, generates embeddings
 * via Gemini, and stores them back. Processes in configurable batch sizes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { generateEmbeddingBatch } from '@/lib/ai/gemini-client'
import { ARTICLE_STAGE_CLAIM_TTL_MS, isClaimAvailable } from '@/lib/pipeline/claim-utils'

const EMBED_BATCH_SIZE = 20
const CLAIM_SCAN_MULTIPLIER = 3

interface UnembeddedArticle {
  id: string
  title: string
  description: string | null
  embedding_claimed_at: string | null
}

export interface EmbeddingResult {
  readonly totalProcessed: number
  readonly claimedArticles: number
  readonly errors: readonly string[]
  readonly dbTimeMs?: number
  readonly modelTimeMs?: number
}

function buildEmbeddingText(article: UnembeddedArticle): string {
  const parts = [article.title]
  if (article.description) {
    parts.push(article.description)
  }
  return parts.join(' — ')
}

async function bulkClaimArticles(
  client: SupabaseClient<Database>,
  articleIds: readonly string[],
  claimedAt: string
): Promise<void> {
  if (articleIds.length === 0) {
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (client.from('articles') as any).update({ embedding_claimed_at: claimedAt })
  if (typeof query.in === 'function') {
    const { error } = await query.in('id', articleIds)
    if (error) {
      throw new Error(`Failed to claim embedding batch: ${error.message}`)
    }
    return
  }

  for (const articleId of articleIds) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from('articles') as any)
      .update({ embedding_claimed_at: claimedAt })
      .eq('id', articleId)

    if (error) {
      throw new Error(`Failed to claim article ${articleId}: ${error.message}`)
    }
  }
}

async function clearClaims(
  client: SupabaseClient<Database>,
  articleIds: readonly string[]
): Promise<void> {
  if (articleIds.length === 0) {
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (client.from('articles') as any).update({ embedding_claimed_at: null })
  if (typeof query.in === 'function') {
    await query.in('id', articleIds)
    return
  }

  for (const articleId of articleIds) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from('articles') as any).update({ embedding_claimed_at: null }).eq('id', articleId)
  }
}

async function bulkWriteEmbeddings(
  client: SupabaseClient<Database>,
  batch: readonly UnembeddedArticle[],
  embeddings: readonly { readonly embedding: readonly number[] }[]
): Promise<{ processed: number; errors: string[] }> {
  const rows = batch.map((article, index) => ({
    id: article.id,
    embedding: embeddings[index]?.embedding as number[],
    is_embedded: true,
    embedding_claimed_at: null,
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
    }
  } catch (error) {
    errors.push(`Batch embedding write failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  let processed = 0

  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from('articles') as any)
      .update({
        embedding: row.embedding,
        is_embedded: row.is_embedded,
        embedding_claimed_at: row.embedding_claimed_at,
      })
      .eq('id', row.id)

    if (error) {
      errors.push(`Update failed for ${row.id}: ${error.message}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client.from('articles') as any).update({ embedding_claimed_at: null }).eq('id', row.id)
    } else {
      processed += 1
    }
  }

  return { processed, errors }
}

export async function embedUnembeddedArticles(
  client: SupabaseClient<Database>,
  maxArticles = 500
): Promise<EmbeddingResult> {
  const { data: fetchedArticles, error: fetchError } = await client
    .from('articles')
    .select('id, title, description, embedding_claimed_at')
    .eq('is_embedded', false)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(maxArticles * CLAIM_SCAN_MULTIPLIER)
    .returns<UnembeddedArticle[]>()

  if (fetchError) {
    throw new Error(`Failed to fetch un-embedded articles: ${fetchError.message}`)
  }

  if (!fetchedArticles || fetchedArticles.length === 0) {
    return { totalProcessed: 0, claimedArticles: 0, errors: [], dbTimeMs: 0, modelTimeMs: 0 }
  }

  const articles = fetchedArticles
    .filter((article) => isClaimAvailable(article.embedding_claimed_at, ARTICLE_STAGE_CLAIM_TTL_MS))
    .slice(0, maxArticles)

  if (articles.length === 0) {
    return { totalProcessed: 0, claimedArticles: 0, errors: [], dbTimeMs: 0, modelTimeMs: 0 }
  }

  const errors: string[] = []
  let totalProcessed = 0
  let dbTimeMs = 0
  let modelTimeMs = 0
  const claimedAt = new Date().toISOString()
  const articleIds = articles.map((article) => article.id)

  const claimStartedAt = Date.now()
  await bulkClaimArticles(client, articleIds, claimedAt)
  dbTimeMs += Date.now() - claimStartedAt

  for (let i = 0; i < articles.length; i += EMBED_BATCH_SIZE) {
    const batch = articles.slice(i, i + EMBED_BATCH_SIZE)
    const texts = batch.map(buildEmbeddingText)

    try {
      const modelStartedAt = Date.now()
      const embeddings = await generateEmbeddingBatch(texts)
      modelTimeMs += Date.now() - modelStartedAt

      const writeStartedAt = Date.now()
      const writeResult = await bulkWriteEmbeddings(client, batch, embeddings)
      dbTimeMs += Date.now() - writeStartedAt
      totalProcessed += writeResult.processed
      errors.push(...writeResult.errors)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Batch embedding failed: ${message}`)
      const clearStartedAt = Date.now()
      await clearClaims(client, batch.map((article) => article.id))
      dbTimeMs += Date.now() - clearStartedAt
    }
  }

  return { totalProcessed, claimedArticles: articles.length, errors, dbTimeMs, modelTimeMs }
}
