/**
 * scripts/backfill-single-source.ts — Re-assemble existing single-source stories.
 *
 * Fixes AI-rewritten headlines, fabricated perspectives, and misleading metrics
 * for single-source stories that were processed by the old pipeline.
 *
 * Usage:
 *   npx tsx scripts/backfill-single-source.ts --dry-run
 *   npx tsx scripts/backfill-single-source.ts --batch-size 5
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { assembleSingleStory } from '@/lib/ai/story-assembler'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const batchSizeIdx = args.indexOf('--batch-size')
const batchSize = batchSizeIdx !== -1 ? parseInt(args[batchSizeIdx + 1], 10) || 5 : 5
const DELAY_MS = 500

const client = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface StoryRow {
  id: string
  headline: string
  is_blindspot: boolean | null
  controversy_score: number | null
  ai_summary: Record<string, unknown> | null
  first_published: string | null
}

interface ArticleRow {
  title: string
}

async function getSingleSourceStories(offset: number, limit: number): Promise<StoryRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('stories') as any)
    .select('id, headline, is_blindspot, controversy_score, ai_summary, first_published')
    .eq('source_count', 1)
    .eq('assembly_status', 'completed')
    .order('first_published', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Failed to fetch stories: ${error.message}`)
  }

  return (data as StoryRow[] | null) ?? []
}

async function getArticlesForStory(storyId: string): Promise<ArticleRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('articles') as any)
    .select('title')
    .eq('story_id', storyId)
    .order('published_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(1)

  if (error) {
    throw new Error(`Failed to fetch articles for ${storyId}: ${error.message}`)
  }

  return (data as ArticleRow[] | null) ?? []
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function logDryRunDiff(story: StoryRow, articleTitle: string): void {
  const headlineChanged = story.headline !== articleTitle
  const summary = story.ai_summary as Record<string, string> | null
  const hasLeftFraming = !!summary?.leftFraming
  const hasRightFraming = !!summary?.rightFraming

  console.log(`  [dry-run] ${story.id}`)
  console.log(`    headline: ${headlineChanged ? 'WOULD CHANGE' : 'already correct'}`)
  if (headlineChanged) {
    console.log(`      current:  "${story.headline}"`)
    console.log(`      original: "${articleTitle}"`)
  }
  console.log(`    leftFraming:  ${hasLeftFraming ? 'WOULD CLEAR (non-empty)' : 'already empty'}`)
  console.log(`    rightFraming: ${hasRightFraming ? 'WOULD CLEAR (non-empty)' : 'already empty'}`)
  console.log(`    is_blindspot: ${story.is_blindspot} ${story.is_blindspot ? '→ false' : '(ok)'}`)
  console.log(`    controversy:  ${story.controversy_score} ${(story.controversy_score ?? 0) > 0 ? '→ 0' : '(ok)'}`)
}

async function main() {
  console.log(`Backfill single-source stories — batch size: ${batchSize}, dry run: ${dryRun}`)

  let offset = 0
  let totalProcessed = 0
  let totalSucceeded = 0
  let totalFailed = 0

  while (true) {
    const stories = await getSingleSourceStories(offset, batchSize)
    if (stories.length === 0) break

    for (const story of stories) {
      totalProcessed++
      try {
        if (dryRun) {
          const articles = await getArticlesForStory(story.id)
          if (articles.length === 0) {
            console.log(`  [skip] ${story.id} — no articles found`)
            continue
          }
          logDryRunDiff(story, articles[0].title)
          totalSucceeded++
        } else {
          const result = await assembleSingleStory(client, story.id, story.first_published ?? undefined)
          console.log(`  [reassembled] ${story.id} → ${result.publicationStatus}`)
          totalSucceeded++
        }
      } catch (err) {
        totalFailed++
        console.error(`  [error] ${story.id}:`, err instanceof Error ? err.message : String(err))
      }
    }

    offset += batchSize
    console.log(`Progress: ${totalProcessed} processed, ${totalSucceeded} succeeded, ${totalFailed} failed`)

    await sleep(DELAY_MS)
  }

  console.log(`\nDone. Processed: ${totalProcessed}, Succeeded: ${totalSucceeded}, Failed: ${totalFailed}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
