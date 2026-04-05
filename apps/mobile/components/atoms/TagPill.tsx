/**
 * TagPill — Colored entity tag chip for story tags.
 * Color-coded by tag type (person, organization, location, event, topic).
 * Promoted tags get a brighter border as a navigation affordance.
 */

import { Pressable, View, Text } from 'react-native'
import type { TagType } from '@/lib/shared/types'
import { TAG_TYPE_COLORS } from '@/lib/shared/types'

interface Props {
  readonly label: string
  readonly type: TagType
  readonly isPromoted?: boolean
  readonly onPress?: () => void
}

export function TagPill({ label, type, isPromoted, onPress }: Props) {
  const color = TAG_TYPE_COLORS[type]

  const style = {
    borderWidth: 0.5,
    borderColor: isPromoted ? `${color}80` : `${color}40`,
    backgroundColor: `${color}15`,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  }

  const content = (
    <>
      <Text style={{ fontFamily: 'Inter', fontSize: 11, color, letterSpacing: 0.3 }}>
        {label}
      </Text>
      {isPromoted && (
        <Text style={{ fontSize: 9, color: `${color}90` }}>{'↗'}</Text>
      )}
    </>
  )

  if (!onPress) {
    return (
      <View accessibilityLabel={`Tag: ${label}`} style={style}>
        {content}
      </View>
    )
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={isPromoted ? `Tag: ${label}, tap to filter` : `Tag: ${label}`}
      accessibilityRole="button"
      style={style}
    >
      {content}
    </Pressable>
  )
}
