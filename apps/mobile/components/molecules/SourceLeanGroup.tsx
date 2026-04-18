/**
 * SourceLeanGroup — Collapsible group of sources bucketed by political lean
 * (Left / Center / Right). Used inside SourceList on story detail.
 *
 * Header row shows a colored dot, label, percentage + count, and chevron.
 * Tapping a source row pushes to the source profile (not external URL).
 */

import { useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { Building2, ChevronDown, ChevronUp, Plus, User } from 'lucide-react-native'
import type { NewsSource } from '@/lib/shared/types'
import { BIAS_GROUP_COLOR } from '@/lib/shared/types'
import { BiasTag } from '@/components/atoms/BiasTag'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { SourceLogo } from '@/components/atoms/SourceLogo'
import { hapticLight } from '@/lib/haptics'
import { useTheme } from '@/lib/shared/theme'

const VISIBLE_SOURCE_CAP = 5

export type GroupLabel = 'Left' | 'Center' | 'Right'

interface Props {
  readonly label: GroupLabel
  readonly count: number
  readonly percentage: number
  readonly sources: readonly NewsSource[]
  readonly defaultExpanded?: boolean
}

const GROUP_COLOR_KEY: Record<GroupLabel, keyof typeof BIAS_GROUP_COLOR> = {
  Left: 'left',
  Center: 'center',
  Right: 'right',
}

export function SourceLeanGroup({
  label,
  count,
  percentage,
  sources,
  defaultExpanded = false,
}: Props) {
  const theme = useTheme()
  const router = useRouter()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showAll, setShowAll] = useState(false)

  const color = BIAS_GROUP_COLOR[GROUP_COLOR_KEY[label]]

  const visibleSources = useMemo(() => {
    if (!expanded) return []
    return showAll ? sources : sources.slice(0, VISIBLE_SOURCE_CAP)
  }, [expanded, showAll, sources])
  const overflow = Math.max(0, sources.length - VISIBLE_SOURCE_CAP)

  const ownerGroups = useMemo(() => {
    const groups = new Map<string, { name: string; isIndividual: boolean; count: number }>()
    for (const source of sources) {
      if (!source.owner) continue
      const existing = groups.get(source.owner.id)
      if (existing) {
        groups.set(source.owner.id, { ...existing, count: existing.count + 1 })
      } else {
        groups.set(source.owner.id, {
          name: source.owner.name,
          isIndividual: source.owner.isIndividual,
          count: 1,
        })
      }
    }
    return [...groups.values()].filter((g) => g.count >= 2)
  }, [sources])

  if (count === 0) return null

  return (
    <View testID={`source-lean-group-${label.toLowerCase()}`} style={{ marginBottom: 8 }}>
      <Pressable
        testID={`source-lean-group-${label.toLowerCase()}-header`}
        onPress={() => {
          hapticLight()
          setExpanded((prev) => {
            if (prev) setShowAll(false)
            return !prev
          })
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${label} sources, ${count}, ${percentage} percent`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.text.primary }}>
            {label}
          </Text>
          <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.tertiary }}>
            {percentage}% · {count} {count === 1 ? 'source' : 'sources'}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={16} color={theme.text.tertiary} />
        ) : (
          <ChevronDown size={16} color={theme.text.tertiary} />
        )}
      </Pressable>

      {expanded && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
          {visibleSources.map((source) => (
            <Pressable
              key={source.id}
              testID={`source-row-${source.id}`}
              onPress={() => {
                if (source.slug) {
                  hapticLight()
                  router.push(`/source/${source.slug}`)
                }
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 10,
                paddingHorizontal: 4,
                opacity: pressed ? 0.7 : 1,
                borderTopWidth: 0.5,
                borderTopColor: theme.surface.border,
              })}
            >
              <SourceLogo domain={source.url} name={source.name} bias={source.bias} size={28} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: theme.text.primary }}>
                    {source.name}
                  </Text>
                  <BiasTag bias={source.bias} compact />
                </View>
                {source.url && (
                  <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.muted }}>
                    {source.url}
                  </Text>
                )}
                <FactualityBar level={source.factuality} size="compact" />
              </View>
            </Pressable>
          ))}

          {overflow > 0 && !showAll && (
            <Pressable
              testID={`source-lean-group-${label.toLowerCase()}-overflow`}
              onPress={() => { hapticLight(); setShowAll(true) }}
              accessibilityRole="button"
              accessibilityLabel={`Show ${overflow} more ${label} ${overflow === 1 ? 'source' : 'sources'}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 10,
                paddingHorizontal: 4,
                opacity: pressed ? 0.7 : 1,
                borderTopWidth: 0.5,
                borderTopColor: theme.surface.border,
              })}
            >
              <Plus size={12} color={theme.text.tertiary} />
              <Text
                style={{
                  fontFamily: 'Inter',
                  fontSize: 12,
                  color: theme.text.tertiary,
                }}
              >
                {`Show ${overflow} more`}
              </Text>
            </Pressable>
          )}

          {ownerGroups.length > 0 && (
            <View
              testID={`source-lean-group-${label.toLowerCase()}-owners`}
              style={{ paddingVertical: 8, paddingHorizontal: 4, gap: 4 }}
            >
              {ownerGroups.map((group) => (
                <View
                  key={group.name}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  {group.isIndividual ? (
                    <User size={12} color={theme.text.tertiary} />
                  ) : (
                    <Building2 size={12} color={theme.text.tertiary} />
                  )}
                  <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.tertiary }}>
                    {group.count} from {group.name}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      )}
    </View>
  )
}
