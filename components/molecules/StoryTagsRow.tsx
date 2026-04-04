/**
 * components/molecules/StoryTagsRow.tsx — Horizontal row of entity tag pills.
 */

import type { StoryTag } from '@/lib/types'
import { TagPill } from '@/components/atoms/TagPill'

interface Props {
  readonly tags: readonly StoryTag[]
  readonly max?: number
}

const DEFAULT_MAX = 8

export function StoryTagsRow({ tags, max = DEFAULT_MAX }: Props) {
  if (tags.length === 0) return null

  const sorted = [...tags].sort((a, b) => b.relevance - a.relevance)
  const visible = sorted.slice(0, max)

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((tag) => (
        <TagPill key={tag.slug} label={tag.label} type={tag.type} />
      ))}
    </div>
  )
}
