import type {
  MediaOwner,
  NewsSource,
  OwnerProfile,
  SourceProfileStory,
  SourceTopicBreakdownItem,
  SpectrumSegment,
  BiasCategory,
} from '@/lib/types'
import { ALL_BIASES } from '@/lib/types'

function sortStoriesNewestFirst(stories: SourceProfileStory[]): SourceProfileStory[] {
  return [...stories].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
}

function buildTopicBreakdown(
  stories: readonly SourceProfileStory[]
): SourceTopicBreakdownItem[] {
  const counts = new Map<SourceTopicBreakdownItem['topic'], number>()

  for (const story of stories) {
    counts.set(story.topic, (counts.get(story.topic) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
}

/**
 * Frequency-count bias distribution over an owner's sources. Returns one
 * segment per bias category present, percentage rounded to the nearest
 * integer — mirrors the spectrum-segment convention used elsewhere.
 */
function computeBiasDistribution(sources: readonly NewsSource[]): SpectrumSegment[] {
  if (sources.length === 0) return []

  const counts = new Map<BiasCategory, number>()
  for (const source of sources) {
    counts.set(source.bias, (counts.get(source.bias) ?? 0) + 1)
  }

  const total = sources.length
  return ALL_BIASES
    .filter((bias) => counts.has(bias))
    .map<SpectrumSegment>((bias) => ({
      bias,
      percentage: Math.round(((counts.get(bias) ?? 0) / total) * 100),
    }))
}

export function buildOwnerProfile(
  owner: MediaOwner,
  sources: readonly NewsSource[],
  recentStories: readonly SourceProfileStory[]
): OwnerProfile {
  const sortedStories = sortStoriesNewestFirst([...recentStories])

  return {
    owner,
    sources: [...sources],
    recentStories: sortedStories,
    topicBreakdown: buildTopicBreakdown(sortedStories),
    storyCount: sortedStories.length,
    blindspotCount: sortedStories.filter((story) => story.isBlindspot).length,
    biasDistribution: computeBiasDistribution(sources),
  }
}
