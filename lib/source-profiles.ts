import type {
  NewsArticle,
  NewsSource,
  SourceProfile,
  SourceProfileSource,
  SourceProfileStory,
  SourceTopicBreakdownItem,
} from '@/lib/types'
import { sampleArticles, sampleSources } from '@/lib/sample-data'

function sortStoriesNewestFirst(stories: SourceProfileStory[]): SourceProfileStory[] {
  return [...stories].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
}

export function buildTopicBreakdown(
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

export function buildSourceProfile(
  source: SourceProfileSource,
  recentStories: readonly SourceProfileStory[]
): SourceProfile {
  const sortedStories = sortStoriesNewestFirst([...recentStories])

  return {
    source,
    recentStories: sortedStories,
    topicBreakdown: buildTopicBreakdown(sortedStories),
    blindspotCount: sortedStories.filter((story) => story.isBlindspot).length,
  }
}

function toRecentStory(article: NewsArticle, source: NewsSource): SourceProfileStory {
  return {
    id: article.id,
    headline: article.headline,
    topic: article.topic,
    region: article.region,
    timestamp: article.timestamp,
    isBlindspot: article.isBlindspot,
    articleUrl: source.articleUrl,
  }
}

export function buildSampleSourceProfile(slug: string): SourceProfile | null {
  const source = sampleSources.find((item) => item.slug === slug)
  if (!source?.slug) return null

  const recentStories = sampleArticles
    .filter((article) => article.sources.some((item) => item.id === source.id))
    .map((article) => {
      const storySource = article.sources.find((item) => item.id === source.id) ?? source
      return toRecentStory(article, storySource)
    })

  return buildSourceProfile(
    {
      ...source,
      slug: source.slug,
      isActive: true,
    },
    recentStories
  )
}
