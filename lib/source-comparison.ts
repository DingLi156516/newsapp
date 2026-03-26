import type {
  SourceComparison,
  SourceComparisonTopicCount,
  SourceProfile,
  SourceProfileStory,
  Topic,
} from '@/lib/types'
import { buildSampleSourceProfile } from '@/lib/source-profiles'

function sortStoriesNewestFirst(stories: readonly SourceProfileStory[]): SourceProfileStory[] {
  return [...stories].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
}

function buildTopicCounts(stories: readonly SourceProfileStory[]): Map<Topic, number> {
  const counts = new Map<Topic, number>()

  for (const story of stories) {
    counts.set(story.topic, (counts.get(story.topic) ?? 0) + 1)
  }

  return counts
}

function sortTopicCounts(items: SourceComparisonTopicCount[]): SourceComparisonTopicCount[] {
  return [...items].sort((a, b) => {
    const aWeight = Math.abs(a.leftCount - a.rightCount) + a.leftCount + a.rightCount
    const bWeight = Math.abs(b.leftCount - b.rightCount) + b.leftCount + b.rightCount
    return (
      bWeight - aWeight ||
      b.leftCount - a.leftCount ||
      b.rightCount - a.rightCount ||
      a.topic.localeCompare(b.topic)
    )
  })
}

function mergeSharedStory(
  leftStory: SourceProfileStory,
  rightStory: SourceProfileStory
): SourceProfileStory {
  const leftTime = Date.parse(leftStory.timestamp)
  const rightTime = Date.parse(rightStory.timestamp)
  const newestStory = rightTime > leftTime ? rightStory : leftStory

  return {
    ...newestStory,
    articleUrl: leftStory.articleUrl ?? rightStory.articleUrl,
    isBlindspot: leftStory.isBlindspot || rightStory.isBlindspot,
  }
}

export function buildSourceComparison(
  leftProfile: SourceProfile,
  rightProfile: SourceProfile
): SourceComparison {
  const leftStoriesById = new Map(leftProfile.recentStories.map((story) => [story.id, story]))
  const rightStoriesById = new Map(rightProfile.recentStories.map((story) => [story.id, story]))

  const sharedStories: SourceProfileStory[] = []
  const leftExclusiveStories: SourceProfileStory[] = []
  const rightExclusiveStories: SourceProfileStory[] = []

  for (const [storyId, leftStory] of leftStoriesById.entries()) {
    const rightStory = rightStoriesById.get(storyId)
    if (rightStory) {
      sharedStories.push(mergeSharedStory(leftStory, rightStory))
    } else {
      leftExclusiveStories.push(leftStory)
    }
  }

  for (const [storyId, rightStory] of rightStoriesById.entries()) {
    if (!leftStoriesById.has(storyId)) {
      rightExclusiveStories.push(rightStory)
    }
  }

  const leftTopicCounts = buildTopicCounts(leftProfile.recentStories)
  const rightTopicCounts = buildTopicCounts(rightProfile.recentStories)
  const allTopics = new Set<Topic>([
    ...leftTopicCounts.keys(),
    ...rightTopicCounts.keys(),
  ])

  const overlappingTopics: SourceComparisonTopicCount[] = []
  const topicImbalances: SourceComparisonTopicCount[] = []

  for (const topic of allTopics) {
    const item = {
      topic,
      leftCount: leftTopicCounts.get(topic) ?? 0,
      rightCount: rightTopicCounts.get(topic) ?? 0,
    }

    if (item.leftCount > 0 && item.rightCount > 0) {
      overlappingTopics.push(item)
    } else {
      topicImbalances.push(item)
    }
  }

  return {
    leftSource: leftProfile.source,
    rightSource: rightProfile.source,
    sharedStories: sortStoriesNewestFirst(sharedStories),
    leftExclusiveStories: sortStoriesNewestFirst(leftExclusiveStories),
    rightExclusiveStories: sortStoriesNewestFirst(rightExclusiveStories),
    stats: {
      sharedStoryCount: sharedStories.length,
      leftExclusiveCount: leftExclusiveStories.length,
      rightExclusiveCount: rightExclusiveStories.length,
      leftBlindspotCount: leftProfile.blindspotCount,
      rightBlindspotCount: rightProfile.blindspotCount,
      overlappingTopics: sortTopicCounts(overlappingTopics),
      topicImbalances: sortTopicCounts(topicImbalances),
    },
  }
}

export function buildSampleSourceComparison(
  leftSlug: string,
  rightSlug: string
): SourceComparison | null {
  const leftProfile = buildSampleSourceProfile(leftSlug)
  const rightProfile = buildSampleSourceProfile(rightSlug)

  if (!leftProfile || !rightProfile) return null

  return buildSourceComparison(leftProfile, rightProfile)
}
