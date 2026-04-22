/**
 * lib/api/for-you-queries.ts — Query orchestration for the "For You" personalized feed.
 *
 * Fetches user preferences, reading history, and bias profile, then scores
 * and paginates candidate stories.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { Topic } from '@/lib/types'
import type { ForYouQuery } from '@/lib/api/validation'
import type { ForYouSignals, ReadSimilarSignal, ScoredStory } from '@/lib/api/for-you-scoring'
import { queryPreferences } from '@/lib/api/preferences-queries'
import { queryReadStoryIds } from '@/lib/api/reading-history-queries'
import { queryReadThroughStoryIds } from '@/lib/api/engagement-queries'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { computeBiasProfile } from '@/lib/api/bias-calculator'
import type { StoryWithSpectrum } from '@/lib/api/bias-calculator'
import { rankStoriesForUser } from '@/lib/api/for-you-scoring'
import { transformStoryList } from '@/lib/api/transformers'
import type { Region } from '@/lib/types'

const CANDIDATE_LIMIT = 200
const READ_SIMILAR_WINDOW_DAYS = 14

interface StoryRow {
  id: string
  headline: string
  topic: string
  region: string
  source_count: number
  is_blindspot: boolean
  image_url: string | null
  factuality: string
  ownership: string
  spectrum_segments: unknown
  ai_summary: unknown
  published_at: string
  first_published: string
  last_updated: string
  story_velocity: unknown
  impact_score: number | null
  source_diversity: number | null
  controversy_score: number | null
  sentiment: unknown
  key_quotes: unknown
  key_claims: unknown
}

export async function queryForYouStories(
  client: SupabaseClient<Database>,
  userId: string,
  params: ForYouQuery
): Promise<{ data: readonly ScoredStory[]; count: number }> {
  // Fetch user signals in parallel. The read-through lookup goes through
  // the service-role client because story_views has SELECT-admin-only RLS;
  // calling it via the user's auth client would always return 0 rows and
  // silently disable the read-similar bonus.
  const engagementClient = getSupabaseServiceClient()
  const [preferences, readStoryIds, readThroughIds, candidateResult] = await Promise.all([
    queryPreferences(client, userId),
    queryReadStoryIds(client, userId),
    queryReadThroughStoryIds(engagementClient, userId, READ_SIMILAR_WINDOW_DAYS),
    fetchCandidateStories(client),
  ])

  const candidates = candidateResult.stories
  const readIdSet = new Set(readStoryIds)
  const readSimilarSignals = buildReadSimilarSignals(candidates, new Set(readThroughIds))

  // Compute bias profile for blindspot detection.
  // Note: uses the candidate pool (last 200 stories) as the "overall" baseline,
  // not the full corpus. User's older read stories outside this window are excluded.
  // Acceptable for MVP — a production improvement would use a precomputed overall distribution.
  const blindspotCategories: ForYouSignals['blindspotCategories'] =
    readStoryIds.length > 0
      ? computeBlindspots(candidates, readIdSet)
      : []

  const signals: ForYouSignals = {
    followedTopics: (preferences.followed_topics ?? []) as Topic[],
    blindspotCategories,
    readStoryIds: readIdSet,
    readSimilarSignals,
    now: new Date(),
  }

  // Transform DB rows to frontend shape for scoring
  const transformedCandidates = candidates.map((story) => {
    const article = transformStoryList(story)
    return {
      ...article,
      spectrumSegments: article.spectrumSegments.map((s) => ({
        bias: s.bias,
        percentage: s.percentage,
      })),
    }
  })

  // Score and rank
  const ranked = rankStoriesForUser(transformedCandidates, signals)

  // Paginate
  const { page, limit } = params
  const start = (page - 1) * limit
  const paged = ranked.slice(start, start + limit)

  return {
    data: paged,
    count: ranked.length,
  }
}

/**
 * Map the user's recent read-through story ids to (topic, region) tuples
 * by intersecting with the candidate pool. Stories outside the candidate
 * window (older than ~200 stories) silently drop out — acceptable because
 * the read-similar bonus is a recency-weighted nudge, not a hard signal.
 */
function buildReadSimilarSignals(
  candidates: readonly StoryRow[],
  readThroughIdSet: ReadonlySet<string>
): readonly ReadSimilarSignal[] {
  if (readThroughIdSet.size === 0) return []
  const seen = new Set<string>()
  const out: ReadSimilarSignal[] = []
  for (const candidate of candidates) {
    if (!readThroughIdSet.has(candidate.id)) continue
    const key = `${candidate.topic}::${candidate.region}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ topic: candidate.topic as Topic, region: candidate.region as Region })
  }
  return out
}

function computeBlindspots(
  candidates: readonly StoryRow[],
  readIdSet: ReadonlySet<string>
): ForYouSignals['blindspotCategories'] {
  const userSpectrumStories = candidates
    .filter((s) => readIdSet.has(s.id))
    .map((s) => ({ spectrum_segments: s.spectrum_segments as StoryWithSpectrum['spectrum_segments'] }))

  const allSpectrumStories = candidates
    .map((s) => ({ spectrum_segments: s.spectrum_segments as StoryWithSpectrum['spectrum_segments'] }))

  const profile = computeBiasProfile(userSpectrumStories, allSpectrumStories)
  return profile.blindspots
}

async function fetchCandidateStories(
  client: SupabaseClient<Database>,
): Promise<{ stories: StoryRow[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from('stories') as any)
    .select(
      'id, headline, topic, region, source_count, is_blindspot, image_url, factuality, ownership, spectrum_segments, ai_summary, published_at, first_published, last_updated, story_velocity, impact_score, source_diversity, controversy_score, sentiment, key_quotes, key_claims'
    )
    .eq('publication_status', 'published')

  query = query
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(CANDIDATE_LIMIT)

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch candidate stories: ${error.message}`)
  }

  return { stories: data ?? [] }
}
