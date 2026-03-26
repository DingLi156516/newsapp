/**
 * scripts/backfill-tags.ts — Backfill entity tags for existing stories.
 *
 * Queries all published stories with zero rows in story_tags,
 * extracts entities via Gemini, and upserts tags.
 *
 * Usage:
 *   npx tsx scripts/backfill-tags.ts
 *   npx tsx scripts/backfill-tags.ts --dry-run
 *   npx tsx scripts/backfill-tags.ts --batch-size 10
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { extractEntities } from '@/lib/ai/entity-extractor'
import { upsertStoryTags } from '@/lib/ai/tag-upsert'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const batchSizeIdx = args.indexOf('--batch-size')
const batchSize = batchSizeIdx !== -1 ? parseInt(args[batchSizeIdx + 1], 10) || 25 : 25
const DELAY_MS = 500

const client = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface StoryRow {
  id: string
  headline: string
}

interface ArticleRow {
  title: string
  description: string | null
}

async function getUntaggedStories(offset: number, limit: number): Promise<StoryRow[]> {
  // Get published stories that have no entries in story_tags
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stories, error } = await (client.from('stories') as any)
    .select('id, headline')
    .eq('publication_status', 'published')
    .order('first_published', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Failed to fetch stories: ${error.message}`)
  }

  if (!stories || stories.length === 0) return []

  // Filter to stories with zero tags
  const untagged: StoryRow[] = []
  for (const story of stories as StoryRow[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error: countError } = await (client.from('story_tags') as any)
      .select('story_id', { count: 'exact', head: true })
      .eq('story_id', story.id)

    if (countError) {
      throw new Error(`Failed to check tags for story ${story.id}: ${countError.message}`)
    }
    if (count === 0) {
      untagged.push(story)
    }
  }

  return untagged
}

async function getArticlesForStory(storyId: string): Promise<ArticleRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('articles') as any)
    .select('title, description')
    .eq('story_id', storyId)
    .order('published_at', { ascending: false })
    .order('id', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch articles for ${storyId}: ${error.message}`)
  }

  return (data as ArticleRow[] | null) ?? []
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log(`Backfill tags — batch size: ${batchSize}, dry run: ${dryRun}`)

  const emptyIdsPath = path.join(process.cwd(), '.backfill-empty-ids')
  const knownEmptyIds: Set<string> = new Set(
    fs.existsSync(emptyIdsPath)
      ? JSON.parse(fs.readFileSync(emptyIdsPath, 'utf-8')) as string[]
      : []
  )
  console.log(`Loaded ${knownEmptyIds.size} known-empty story IDs from skip file`)

  let offset = 0
  let totalProcessed = 0
  let totalTagged = 0
  let totalErrors = 0
  let totalSkippedEmpty = 0

  // Process in batches until no more untagged stories
  while (true) {
    const rawStories = await getUntaggedStories(offset, batchSize)
    const stories = rawStories.filter((s) => !knownEmptyIds.has(s.id))
    if (rawStories.length === 0) {
      // Try next page — there may be tagged stories in between
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pageCheck, error: pageError } = await (client.from('stories') as any)
        .select('id')
        .eq('publication_status', 'published')
        .order('first_published', { ascending: false })
        .range(offset, offset + batchSize - 1)
        .limit(1)

      if (pageError) {
        throw new Error(`Failed to probe stories page at offset ${offset}: ${pageError.message}`)
      }
      if (!pageCheck || pageCheck.length === 0) break
      offset += batchSize
      continue
    }

    for (const story of stories) {
      totalProcessed++
      try {
        const articles = await getArticlesForStory(story.id)
        if (articles.length === 0) continue

        const titles = articles.map((a) => a.title)
        const descriptions = articles.map((a) => a.description)

        const entities = await extractEntities(titles, descriptions)

        if (entities === null) {
          console.log(`  [skip] ${story.id} — extraction failed`)
          continue
        }

        if (entities.length === 0) {
          totalSkippedEmpty++
          knownEmptyIds.add(story.id)
          console.log(`  [empty] ${story.id} — no entities extracted`)
          continue
        }

        if (dryRun) {
          console.log(`  [dry-run] ${story.id} "${story.headline}" → ${entities.length} entities:`)
          for (const e of entities) {
            console.log(`    ${e.type}: ${e.label} (${e.relevance})`)
          }
          totalTagged++
        } else {
          await upsertStoryTags(client, story.id, entities)

          // Verify tags were actually written
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { count: tagCount, error: verifyError } = await (client.from('story_tags') as any)
            .select('story_id', { count: 'exact', head: true })
            .eq('story_id', story.id)

          if (verifyError || !tagCount || tagCount === 0) {
            totalErrors++
            console.error(`  [write-failed] ${story.id} — upsert resolved but no story_tags written`)
            continue
          }

          console.log(`  [tagged] ${story.id} → ${tagCount} tags`)
          totalTagged++
        }
      } catch (err) {
        totalErrors++
        console.error(`  [error] ${story.id}:`, err instanceof Error ? err.message : String(err))
      }
    }

    offset += batchSize
    console.log(`Processed ${totalProcessed} stories so far (${totalTagged} tagged, ${totalErrors} errors)`)

    // Rate limit delay between batches
    await sleep(DELAY_MS)
  }

  // Persist known-empty IDs for future runs
  fs.writeFileSync(emptyIdsPath, JSON.stringify([...knownEmptyIds], null, 2))
  console.log(`\nDone. Processed: ${totalProcessed}, Tagged: ${totalTagged}, Empty: ${totalSkippedEmpty}, Errors: ${totalErrors}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
