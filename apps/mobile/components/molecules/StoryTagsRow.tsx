/**
 * StoryTagsRow — Horizontal scrolling row of entity tag pills.
 * Sorted by relevance descending, capped at max (default 8).
 * Promoted tags (story_count >= threshold) become tappable for feed navigation.
 */

import { ScrollView } from 'react-native'
import { TagPill } from '@/components/atoms/TagPill'
import type { StoryTag } from '@/lib/shared/types'

interface Props {
  readonly tags: readonly StoryTag[]
  readonly promotedSlugs?: ReadonlySet<string>
  readonly onTagPress?: (tag: StoryTag) => void
  readonly max?: number
}

const DEFAULT_MAX = 8

export function StoryTagsRow({ tags, promotedSlugs, onTagPress, max = DEFAULT_MAX }: Props) {
  if (tags.length === 0) return null

  const sorted = [...tags].sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
  const visible = sorted.slice(0, max)

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {visible.map((tag) => {
        const isPromoted = promotedSlugs?.has(`${tag.slug}:${tag.type}`) ?? false
        return (
          <TagPill
            key={`${tag.slug}:${tag.type}`}
            label={tag.label}
            type={tag.type}
            isPromoted={isPromoted}
            onPress={isPromoted && onTagPress ? () => onTagPress(tag) : undefined}
          />
        )
      })}
    </ScrollView>
  )
}
