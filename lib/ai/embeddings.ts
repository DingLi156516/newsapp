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
}

function buildEmbeddingText(article: UnembeddedArticle): string {
  const parts = [article.title]
  if (article.description) {
    parts.push(article.description)
  }
  return parts.join(' — ')
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
    return { totalProcessed: 0, claimedArticles: 0, errors: [] }
  }

  const articles = fetchedArticles
    .filter((article) => isClaimAvailable(article.embedding_claimed_at, ARTICLE_STAGE_CLAIM_TTL_MS))
    .slice(0, maxArticles)

  if (articles.length === 0) {
    return { totalProcessed: 0, claimedArticles: 0, errors: [] }
  }

  const errors: string[] = []
  let totalProcessed = 0
  const claimedAt = new Date().toISOString()

  for (const article of articles) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from('articles') as any)
      .update({ embedding_claimed_at: claimedAt })
      .eq('id', article.id)
  }

  for (let i = 0; i < articles.length; i += EMBED_BATCH_SIZE) {
    const batch = articles.slice(i, i + EMBED_BATCH_SIZE)
    const texts = batch.map(buildEmbeddingText)

    try {
      const embeddings = await generateEmbeddingBatch(texts)

      for (let j = 0; j < batch.length; j++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (client.from('articles') as any)
          .update({
            embedding: embeddings[j].embedding as number[],
            is_embedded: true,
            embedding_claimed_at: null,
          })
          .eq('id', batch[j].id)

        if (updateError) {
          errors.push(`Update failed for ${batch[j].id}: ${updateError.message}`)
          // Best-effort clear of the claim so failed items can be retried promptly.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (client.from('articles') as any)
            .update({ embedding_claimed_at: null })
            .eq('id', batch[j].id)
        } else {
          totalProcessed++
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Batch embedding failed: ${message}`)
      for (const article of batch) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client.from('articles') as any)
          .update({ embedding_claimed_at: null })
          .eq('id', article.id)
      }
    }
  }

  return { totalProcessed, claimedArticles: articles.length, errors }
}
