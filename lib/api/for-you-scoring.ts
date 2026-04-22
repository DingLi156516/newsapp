/**
 * lib/api/for-you-scoring.ts — Pure scoring engine for the "For You" personalized feed.
 *
 * Scores stories based on user signals (followed topics, blindspot categories,
 * reading history, recency). Pure functions — no side effects, no DB calls.
 */

import type { BiasCategory, Region, Topic } from '@/lib/types'

/**
 * Topic+region tuples derived from stories the user has *finished* reading
 * (≥80% scroll, see migration 053). Phase 3 introduces a "read-similar"
 * bonus that rewards candidates matching one of these tuples — a cheap
 * first pass while we defer pgvector centroid scoring to a follow-up.
 */
export interface ReadSimilarSignal {
  readonly topic: Topic
  readonly region: Region
}

export interface ForYouSignals {
  readonly followedTopics: readonly Topic[]
  readonly blindspotCategories: readonly BiasCategory[]
  readonly readStoryIds: ReadonlySet<string>
  readonly readSimilarSignals?: readonly ReadSimilarSignal[]
  readonly now: Date
}

export interface ScoredStory {
  readonly id: string
  readonly headline: string
  readonly topic: string
  readonly region?: string
  readonly timestamp: string
  readonly spectrumSegments: readonly { bias: string; percentage: number }[]
  readonly score: number
  readonly [key: string]: unknown
}

interface StoryCandidate {
  readonly id: string
  readonly headline: string
  readonly topic: string
  readonly region?: string
  readonly timestamp: string
  readonly spectrumSegments: readonly { bias: string; percentage: number }[]
  readonly [key: string]: unknown
}

const TOPIC_MATCH_POINTS = 40
const BLINDSPOT_HIGH_POINTS = 30
const BLINDSPOT_MEDIUM_POINTS = 15
const BLINDSPOT_HIGH_THRESHOLD = 30
const BLINDSPOT_MEDIUM_THRESHOLD = 15
const RECENCY_MAX_POINTS = 20
const RECENCY_DECAY_HOURS = 48
const UNREAD_BONUS_POINTS = 10
const READ_SIMILAR_POINTS = 15

/**
 * Computes the blindspot score for a story based on user's underrepresented categories.
 * +30 if ≥30% of spectrum from blindspot categories, +15 if ≥15%.
 */
function computeBlindspotScore(
  spectrumSegments: readonly { bias: string; percentage: number }[],
  blindspotCategories: readonly BiasCategory[]
): number {
  if (blindspotCategories.length === 0 || spectrumSegments.length === 0) return 0

  const blindspotSet = new Set<string>(blindspotCategories)
  const blindspotPct = spectrumSegments
    .filter((s) => blindspotSet.has(s.bias))
    .reduce((sum, s) => sum + s.percentage, 0)

  if (blindspotPct >= BLINDSPOT_HIGH_THRESHOLD) return BLINDSPOT_HIGH_POINTS
  if (blindspotPct >= BLINDSPOT_MEDIUM_THRESHOLD) return BLINDSPOT_MEDIUM_POINTS
  return 0
}

/**
 * +READ_SIMILAR_POINTS when a candidate matches the (topic, region) of any
 * story the user has read through in the last 14 days. Cheap proxy for
 * embedding-cosine similarity until the read-through volume justifies the
 * pgvector query cost. Region must match exactly; topic must match
 * exactly. A story missing either field cannot earn the bonus.
 *
 * Important: skip when the candidate is itself one of the read stories.
 * Without this guard a finished-read story trivially matches the
 * read-similar signal it generated, scoring 0 (unread) + 15 (similar)
 * = 15 — higher than an unread-not-similar story at 10 — which inverts
 * the "elevate fresh similar content" intent.
 */
function computeReadSimilarScore(
  story: StoryCandidate,
  readStoryIds: ReadonlySet<string>,
  signals: readonly ReadSimilarSignal[] | undefined
): number {
  if (!signals || signals.length === 0) return 0
  if (!story.region) return 0
  if (readStoryIds.has(story.id)) return 0
  for (const signal of signals) {
    if (signal.topic === story.topic && signal.region === story.region) {
      return READ_SIMILAR_POINTS
    }
  }
  return 0
}

/**
 * Computes the recency score: linear decay from 20→0 over 48 hours.
 */
function computeRecencyScore(timestamp: string, now: Date): number {
  const storyTime = new Date(timestamp).getTime()
  const hoursAgo = (now.getTime() - storyTime) / (1000 * 60 * 60)

  if (hoursAgo <= 0) return RECENCY_MAX_POINTS
  if (hoursAgo >= RECENCY_DECAY_HOURS) return 0

  return Math.round(RECENCY_MAX_POINTS * (1 - hoursAgo / RECENCY_DECAY_HOURS))
}

/**
 * Scores a single story based on user signals.
 * Max score: 115 (40 topic + 30 blindspot + 20 recency + 10 unread + 15 read-similar).
 */
export function scoreStory(story: StoryCandidate, signals: ForYouSignals): number {
  const topicScore = signals.followedTopics.includes(story.topic as Topic)
    ? TOPIC_MATCH_POINTS
    : 0
  const blindspotScore = computeBlindspotScore(story.spectrumSegments, signals.blindspotCategories)
  const recencyScore = computeRecencyScore(story.timestamp, signals.now)
  const unreadScore = signals.readStoryIds.has(story.id) ? 0 : UNREAD_BONUS_POINTS
  const readSimilarScore = computeReadSimilarScore(story, signals.readStoryIds, signals.readSimilarSignals)

  return topicScore + blindspotScore + recencyScore + unreadScore + readSimilarScore
}

/**
 * Ranks stories for a user by scoring and sorting descending.
 * Returns all stories with their computed scores.
 */
export function rankStoriesForUser(
  stories: readonly StoryCandidate[],
  signals: ForYouSignals
): readonly ScoredStory[] {
  return stories
    .map((story) => ({
      ...story,
      score: scoreStory(story, signals),
    }))
    .sort((a, b) => b.score - a.score)
}
