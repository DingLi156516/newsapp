/**
 * lib/ai/embeddings.ts — Embedding pipeline for articles.
 *
 * Fetches un-embedded articles from the database, generates embeddings
 * via Gemini, and stores them back. Processes in configurable batch sizes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { generateEmbeddingBatch } from '@/lib/ai/gemini-client'

const EMBED_BATCH_SIZE = 20

interface UnembeddedArticle {
  id: string
  title: string
  description: string | null
}

export interface EmbeddingResult {
  readonly totalProcessed: number
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
  maxArticles = 100
): Promise<EmbeddingResult> {
  const { data: articles, error: fetchError } = await client
    .from('articles')
    .select('id, title, description')
    .eq('is_embedded', false)
    .order('created_at', { ascending: true })
    .limit(maxArticles)
    .returns<UnembeddedArticle[]>()

  if (fetchError) {
    throw new Error(`Failed to fetch un-embedded articles: ${fetchError.message}`)
  }

  if (!articles || articles.length === 0) {
    return { totalProcessed: 0, errors: [] }
  }

  const errors: string[] = []
  let totalProcessed = 0

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
          })
          .eq('id', batch[j].id)

        if (updateError) {
          errors.push(`Update failed for ${batch[j].id}: ${updateError.message}`)
        } else {
          totalProcessed++
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Batch embedding failed: ${message}`)
    }
  }

  return { totalProcessed, errors }
}
