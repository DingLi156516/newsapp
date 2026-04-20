/**
 * scripts/audit-deterministic-assembly.ts — Read-only comparison of stored
 * story assembly fields against the deterministic assembly output.
 *
 * Usage:
 *   npx tsx scripts/audit-deterministic-assembly.ts --limit 100
 *   npx tsx scripts/audit-deterministic-assembly.ts --limit 100 --multi-only
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { buildDeterministicStoryAssembly } from '@/lib/ai/deterministic-assembly'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const args = process.argv.slice(2)
const limitIdx = args.indexOf('--limit')
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) || 100 : 100
const multiOnly = args.includes('--multi-only')

const client = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface StoryRow {
  id: string
  headline: string
  topic: string
  region: string
  source_count: number | null
  ai_summary: {
    commonGround?: string
    leftFraming?: string
    rightFraming?: string
  } | null
  key_claims: unknown[] | null
  assembled_at: string | null
}

interface ArticleRow {
  title: string
  description: string | null
  source_id: string
}

interface SourceRow {
  id: string
  bias: string
}

interface AuditExample {
  readonly storyId: string
  readonly sourceCount: number | null
  readonly changed: readonly string[]
  readonly storedHeadline: string
  readonly deterministicHeadline: string
}

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

async function fetchStories(): Promise<StoryRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from('stories') as any)
    .select('id, headline, topic, region, source_count, ai_summary, key_claims, assembled_at')
    .eq('assembly_status', 'completed')
    .order('assembled_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(limit)

  if (multiOnly) {
    query = query.gt('source_count', 1)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to fetch stories: ${error.message}`)
  }
  return (data as StoryRow[] | null) ?? []
}

async function fetchArticles(storyId: string): Promise<ArticleRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('articles') as any)
    .select('title, description, source_id')
    .eq('story_id', storyId)
    .order('published_at', { ascending: false })
    .order('id', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch articles for ${storyId}: ${error.message}`)
  }
  return (data as ArticleRow[] | null) ?? []
}

async function fetchSources(sourceIds: readonly string[]): Promise<SourceRow[]> {
  if (sourceIds.length === 0) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('sources') as any)
    .select('id, bias')
    .in('id', sourceIds)

  if (error) {
    throw new Error(`Failed to fetch sources: ${error.message}`)
  }
  return (data as SourceRow[] | null) ?? []
}

function changedFields(
  story: StoryRow,
  deterministic: ReturnType<typeof buildDeterministicStoryAssembly>
): string[] {
  const changed: string[] = []
  if (normalized(story.headline) !== normalized(deterministic.headline)) changed.push('headline')
  if (story.topic !== deterministic.topic) changed.push('topic')
  if (story.region !== deterministic.region) changed.push('region')
  if (normalized(story.ai_summary?.commonGround) !== normalized(deterministic.aiSummary.commonGround)) {
    changed.push('commonGround')
  }
  if (normalized(story.ai_summary?.leftFraming) !== normalized(deterministic.aiSummary.leftFraming)) {
    changed.push('leftFraming')
  }
  if (normalized(story.ai_summary?.rightFraming) !== normalized(deterministic.aiSummary.rightFraming)) {
    changed.push('rightFraming')
  }
  if ((story.key_claims?.length ?? 0) !== (deterministic.keyClaims?.length ?? 0)) {
    changed.push('keyClaimsCount')
  }
  return changed
}

async function main(): Promise<void> {
  const stories = await fetchStories()
  const examples: AuditExample[] = []
  const fieldCounts = new Map<string, number>()

  let audited = 0
  let skipped = 0

  for (const story of stories) {
    const articles = await fetchArticles(story.id)
    if (articles.length === 0) {
      skipped += 1
      continue
    }

    const sourceIds = [...new Set(articles.map((article) => article.source_id))]
    const sources = await fetchSources(sourceIds)
    const sourceBias = new Map(sources.map((source) => [source.id, source.bias]))
    const deterministic = buildDeterministicStoryAssembly(
      articles.map((article) => ({
        title: article.title,
        description: article.description,
        bias: sourceBias.get(article.source_id) ?? 'center',
      })),
      { isSingleSource: sourceIds.length === 1 }
    )
    const changed = changedFields(story, deterministic)

    for (const field of changed) {
      fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1)
    }

    if (changed.length > 0 && examples.length < 10) {
      examples.push({
        storyId: story.id,
        sourceCount: story.source_count,
        changed,
        storedHeadline: story.headline,
        deterministicHeadline: deterministic.headline,
      })
    }

    audited += 1
  }

  console.log(JSON.stringify({
    mode: multiOnly ? 'multi-only' : 'all',
    requestedLimit: limit,
    audited,
    skipped,
    fieldChanges: Object.fromEntries(fieldCounts),
    examples,
  }, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
