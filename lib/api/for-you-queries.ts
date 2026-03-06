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
import type { ForYouSignals, ScoredStory } from '@/lib/api/for-you-scoring'
import { queryPreferences } from '@/lib/api/preferences-queries'
import { queryReadStoryIds } from '@/lib/api/reading-history-queries'
import { computeBiasProfile } from '@/lib/api/bias-calculator'
import type { StoryWithSpectrum } from '@/lib/api/bias-calculator'
import { rankStoriesForUser } from '@/lib/api/for-you-scoring'
import { transformStoryList } from '@/lib/api/transformers'

const CANDIDATE_LIMIT = 200

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
  first_published: string
  last_updated: string
}

export async function queryForYouStories(
  client: SupabaseClient<Database>,
  userId: string,
  params: ForYouQuery
): Promise<{ data: readonly ScoredStory[]; count: number }> {
  // Fetch user signals in parallel
  const [preferences, readStoryIds, candidateResult] = await Promise.all([
    queryPreferences(client, userId),
    queryReadStoryIds(client, userId),
    fetchCandidateStories(client),
  ])

  const candidates = candidateResult.stories
  const readIdSet = new Set(readStoryIds)

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
      'id, headline, topic, region, source_count, is_blindspot, image_url, factuality, ownership, spectrum_segments, ai_summary, first_published, last_updated'
    )
    .neq('headline', 'Pending headline generation')
    .eq('review_status', 'approved')

  query = query
    .order('last_updated', { ascending: false })
    .limit(CANDIDATE_LIMIT)

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch candidate stories: ${error.message}`)
  }

  return { stories: data ?? [] }
}
