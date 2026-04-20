/**
 * lib/ai/thin-topic-classifier.ts — Multi-signal deterministic topic &
 * region classifier for the thin-cluster assembly path.
 *
 * The thin path runs buildDeterministicStoryAssembly without any Gemini
 * call. Without this classifier, `fallbackTopic` defaults to 'politics'
 * for every long-tail story that misses its keyword list (~15-25% of
 * clusters). We preserve the zero-Gemini property by walking a signal
 * ladder in order and returning the first confident hit:
 *
 *   1. RSS `<category>` tag on the source articles
 *   2. Per-source topic prior (recent published topic distribution)
 *   3. Existing keyword fallback over titles
 *   4. Default to 'politics'
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { Topic, Region } from '@/lib/types'
import { fallbackTopic } from '@/lib/ai/topic-classifier'
import { fallbackRegion } from '@/lib/ai/region-classifier'

export interface ClassifierArticle {
  readonly title: string
  readonly rssCategories: readonly string[] | null
  readonly sourceId: string
}

export interface TopicPrior {
  readonly topic: Topic
  readonly confidence: number
  readonly total: number
}

/**
 * Batch-scoped cache for per-source topic priors. Created once per
 * assembly batch and threaded through so thin stories sharing a source
 * only pay for one DB read. Stores Promises so concurrent lookups for
 * the same source dedupe via await rather than each firing a query.
 */
export type TopicPriorCache = Map<string, Promise<TopicPrior | null>>

export function createTopicPriorCache(): TopicPriorCache {
  return new Map()
}

const MIN_PRIOR_CONFIDENCE = 0.4
const MIN_PRIOR_SAMPLE = 10
const PRIOR_LOOKBACK_DAYS = 30

const RSS_CATEGORY_TO_TOPIC: ReadonlyArray<readonly [Topic, readonly string[]]> = [
  ['technology', ['technology', 'tech', 'ai', 'artificial intelligence', 'software', 'cybersecurity', 'gadgets']],
  ['business', ['business', 'markets', 'market', 'economy', 'economics', 'finance', 'money']],
  ['science', ['science', 'space', 'physics', 'biology', 'chemistry']],
  ['health', ['health', 'medicine', 'medical', 'wellness']],
  ['culture', ['culture', 'entertainment', 'arts', 'film', 'music', 'lifestyle', 'books']],
  ['sports', ['sports', 'sport']],
  ['environment', ['environment', 'climate', 'weather', 'energy']],
  ['world', ['world', 'international', 'global']],
  ['politics', ['politics', 'political', 'policy', 'government']],
]

const RSS_CATEGORY_TO_REGION: ReadonlyArray<readonly [Region, readonly string[]]> = [
  ['uk', ['uk', 'britain', 'england', 'scotland', 'wales']],
  ['canada', ['canada']],
  ['europe', ['europe']],
  ['international', ['international', 'world']],
]

export function normalizeRssCategory(raw: string): Topic | null {
  const key = raw.trim().toLowerCase()
  if (!key) return null

  for (const [topic, values] of RSS_CATEGORY_TO_TOPIC) {
    if (values.includes(key)) return topic
  }

  return null
}

export function normalizeRssRegion(raw: string): Region | null {
  const key = raw.trim().toLowerCase()
  if (!key) return null

  for (const [region, values] of RSS_CATEGORY_TO_REGION) {
    if (values.includes(key)) return region
  }

  return null
}

function pickDominant<T extends string>(counts: ReadonlyMap<T, number>): T | null {
  let best: T | null = null
  let bestCount = 0
  let tied = false

  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value
      bestCount = count
      tied = false
    } else if (count === bestCount) {
      tied = true
    }
  }

  return tied ? null : best
}

// Collect the distinct set of normalized values for one article's tags.
// Counting each tag separately would let verbose feeds (e.g. TechCrunch
// tagging a post as both "Technology" and "AI") outweigh single-tag
// articles on unrelated topics. One article = one vote per topic.
function distinctTopicsForArticle(article: ClassifierArticle): Set<Topic> {
  const topics = new Set<Topic>()
  if (!article.rssCategories) return topics
  for (const raw of article.rssCategories) {
    const topic = normalizeRssCategory(raw)
    if (topic) topics.add(topic)
  }
  return topics
}

function distinctRegionsForArticle(article: ClassifierArticle): Set<Region> {
  const regions = new Set<Region>()
  if (!article.rssCategories) return regions
  for (const raw of article.rssCategories) {
    const region = normalizeRssRegion(raw)
    if (region) regions.add(region)
  }
  return regions
}

export function classifyFromRssCategories(
  articles: readonly ClassifierArticle[]
): Topic | null {
  const counts = new Map<Topic, number>()

  for (const art of articles) {
    for (const topic of distinctTopicsForArticle(art)) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1)
    }
  }

  return pickDominant(counts)
}

export function classifyFromRssRegions(
  articles: readonly ClassifierArticle[]
): Region | null {
  const counts = new Map<Region, number>()

  for (const art of articles) {
    for (const region of distinctRegionsForArticle(art)) {
      counts.set(region, (counts.get(region) ?? 0) + 1)
    }
  }

  return pickDominant(counts)
}

export function classifyFromPriors(
  priors: ReadonlyMap<string, TopicPrior | null>
): Topic | null {
  const byTopic = new Map<Topic, number>()

  for (const prior of priors.values()) {
    if (!prior) continue
    if (prior.confidence < MIN_PRIOR_CONFIDENCE) continue
    if (prior.total < MIN_PRIOR_SAMPLE) continue
    byTopic.set(prior.topic, (byTopic.get(prior.topic) ?? 0) + prior.confidence)
  }

  let best: Topic | null = null
  let bestScore = 0
  let tied = false

  for (const [topic, score] of byTopic) {
    if (score > bestScore) {
      best = topic
      bestScore = score
      tied = false
    } else if (score === bestScore) {
      tied = true
    }
  }

  // Ties across sources (e.g. one source 0.8 tech, one source 0.8
  // politics) are inconclusive — otherwise the winner depends on Map
  // iteration order. Let the keyword signal decide instead.
  return tied ? null : best
}

export async function queryTopicPrior(
  client: SupabaseClient<Database>,
  sourceIds: readonly string[],
  now: Date
): Promise<Map<string, TopicPrior | null>> {
  const result = new Map<string, TopicPrior | null>()
  if (sourceIds.length === 0) return result

  const cutoff = new Date(now.getTime() - PRIOR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

  // Read per-article topic via articles → stories join. Aggregating the
  // last N days of topic assignments per source lets us pick the dominant
  // topic for that source's recent coverage. Zero Gemini cost — a single
  // indexed query per assembly batch (source_id on articles, story_id FK).
  //
  // Restrict to stories.assembly_status='completed'. Clustering seeds new
  // stories with a placeholder topic='politics' (lib/ai/clustering.ts:1142,
  // :1356) and assembly_status='pending'. Counting those would pollute the
  // prior toward 'politics' for any source with a pending backlog and
  // starve the RSS/keyword signals below. The in-flight story is naturally
  // excluded since its status is 'processing' while we read.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (client.from('articles') as any)
    .select('source_id, stories!inner(topic, first_published, assembly_status)')
    .in('source_id', [...sourceIds])
    .gt('stories.first_published', cutoff.toISOString())
    .eq('stories.assembly_status', 'completed')

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to fetch topic priors: ${error.message}`)
  }

  type Row = { source_id: string; topic: Topic | null; stories?: { topic: Topic | null } }
  const rows = (data ?? []) as Row[]
  const normalizedRows: Array<{ source_id: string; topic: Topic | null }> = rows.map(
    (r) => ({
      source_id: r.source_id,
      // Support both the direct `topic` shape used by tests and the joined
      // `stories.topic` shape the real query returns.
      topic: r.topic ?? r.stories?.topic ?? null,
    })
  )

  const perSource = new Map<string, Map<Topic, number>>()
  for (const row of normalizedRows) {
    if (!row.topic) continue
    const bucket = perSource.get(row.source_id) ?? new Map<Topic, number>()
    bucket.set(row.topic, (bucket.get(row.topic) ?? 0) + 1)
    perSource.set(row.source_id, bucket)
  }

  for (const sourceId of sourceIds) {
    const bucket = perSource.get(sourceId)
    if (!bucket || bucket.size === 0) {
      result.set(sourceId, null)
      continue
    }

    let topic: Topic | null = null
    let topCount = 0
    let total = 0
    let tied = false
    for (const [t, count] of bucket) {
      total += count
      if (count > topCount) {
        topic = t
        topCount = count
        tied = false
      } else if (count === topCount) {
        tied = true
      }
    }

    // Ties (e.g. 10 tech / 10 politics) are inconclusive. Reporting a
    // 0.5 confidence here would still clear MIN_PRIOR_CONFIDENCE and let
    // classifyFromPriors pick a topic based on DB row order. Fall
    // through to the keyword signal instead.
    if (!topic || total === 0 || tied) {
      result.set(sourceId, null)
      continue
    }

    result.set(sourceId, {
      topic,
      confidence: topCount / total,
      total,
    })
  }

  return result
}

async function resolvePriorsWithCache(
  client: SupabaseClient<Database>,
  sourceIds: readonly string[],
  cache: TopicPriorCache | undefined
): Promise<Map<string, TopicPrior | null>> {
  if (!cache) {
    return queryTopicPrior(client, sourceIds, new Date())
  }

  const missing: string[] = []
  for (const id of sourceIds) {
    if (!cache.has(id)) missing.push(id)
  }

  if (missing.length > 0) {
    // Start the fetch once, then seed every missing id with the shared
    // in-flight promise so concurrent callers dedupe on the same await
    // rather than each firing their own query.
    const fetchPromise = queryTopicPrior(client, missing, new Date())
    for (const id of missing) {
      cache.set(
        id,
        fetchPromise.then((m) => m.get(id) ?? null)
      )
    }
  }

  const result = new Map<string, TopicPrior | null>()
  await Promise.all(
    sourceIds.map(async (id) => {
      const prior = (await cache.get(id)) ?? null
      result.set(id, prior)
    })
  )
  return result
}

export async function classifyThinTopic(
  articles: readonly ClassifierArticle[],
  client: SupabaseClient<Database> | null,
  priorCache?: TopicPriorCache
): Promise<Topic> {
  const fromRss = classifyFromRssCategories(articles)
  if (fromRss) return fromRss

  if (client) {
    const sourceIds = [...new Set(articles.map((a) => a.sourceId))]
    try {
      const priors = await resolvePriorsWithCache(client, sourceIds, priorCache)
      const fromPriors = classifyFromPriors(priors)
      if (fromPriors) return fromPriors
    } catch (err) {
      // Priors are a best-effort signal — a DB hiccup should fall through
      // to keyword fallback, not abort thin-path assembly.
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[thin-topic-classifier] prior query failed: ${message}`)
    }
  }

  // fallbackTopic already returns 'politics' when nothing matches.
  return fallbackTopic(articles.map((a) => a.title))
}

export function classifyThinRegion(
  articles: readonly ClassifierArticle[]
): Region {
  const fromRss = classifyFromRssRegions(articles)
  if (fromRss) return fromRss

  return fallbackRegion(articles.map((a) => a.title))
}
