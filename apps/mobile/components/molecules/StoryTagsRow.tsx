/**
 * StoryTagsRow — Horizontal scrolling row of entity tag pills.
 */

import { ScrollView } from 'react-native'
import { TagPill } from '@/components/atoms/TagPill'
import type { StoryTag } from '@/lib/shared/types'

interface Props {
  readonly tags: readonly StoryTag[]
}

export function StoryTagsRow({ tags }: Props) {
  if (tags.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {tags.map((tag) => (
        <TagPill key={tag.slug} label={tag.label} type={tag.type} />
      ))}
    </ScrollView>
  )
}
