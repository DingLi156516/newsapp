/**
 * SourceList — Buckets sources by political lean into three collapsible
 * groups (Left / Center / Right) using the 7-tier bias taxonomy. The first
 * non-empty group is expanded by default. Single-source stories render only
 * the group containing that source.
 */

import { useMemo } from 'react'
import { View } from 'react-native'
import type { BiasCategory, NewsSource } from '@/lib/shared/types'
import { FACTUALITY_RANK } from '@/lib/shared/types'
import { SourceLeanGroup, type GroupLabel } from '@/components/molecules/SourceLeanGroup'

interface SourceListProps {
  readonly sources: readonly NewsSource[]
}

const LEFT_BIASES: readonly BiasCategory[] = ['far-left', 'left', 'lean-left']
const RIGHT_BIASES: readonly BiasCategory[] = ['lean-right', 'right', 'far-right']

function bucketOf(bias: BiasCategory): GroupLabel {
  if (LEFT_BIASES.includes(bias)) return 'Left'
  if (RIGHT_BIASES.includes(bias)) return 'Right'
  return 'Center'
}

function sortSources(a: NewsSource, b: NewsSource): number {
  const factA = FACTUALITY_RANK[a.factuality] ?? 0
  const factB = FACTUALITY_RANK[b.factuality] ?? 0
  if (factA !== factB) return factB - factA
  return a.name.localeCompare(b.name)
}

export function SourceList({ sources }: SourceListProps) {
  const buckets = useMemo(() => {
    const groups: Record<GroupLabel, NewsSource[]> = { Left: [], Center: [], Right: [] }
    for (const source of sources) {
      groups[bucketOf(source.bias)].push(source)
    }
    return {
      Left: [...groups.Left].sort(sortSources),
      Center: [...groups.Center].sort(sortSources),
      Right: [...groups.Right].sort(sortSources),
    }
  }, [sources])

  const total = sources.length
  const firstNonEmpty: GroupLabel | null = useMemo(() => {
    const order: GroupLabel[] = ['Left', 'Center', 'Right']
    return order.find((label) => buckets[label].length > 0) ?? null
  }, [buckets])

  const groupOrder: GroupLabel[] = ['Left', 'Center', 'Right']

  return (
    <View>
      {groupOrder.map((label) => {
        const groupSources = buckets[label]
        if (groupSources.length === 0) return null
        const percentage = total > 0 ? Math.round((groupSources.length / total) * 100) : 0
        return (
          <SourceLeanGroup
            key={label}
            label={label}
            count={groupSources.length}
            percentage={percentage}
            sources={groupSources}
            defaultExpanded={label === firstNonEmpty}
          />
        )
      })}
    </View>
  )
}
