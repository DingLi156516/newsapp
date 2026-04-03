/**
 * TagPill — Colored entity tag chip for story tags.
 * Color-coded by tag type (person, organization, location, event, topic).
 */

import { Pressable, View, Text } from 'react-native'
import type { TagType } from '@/lib/shared/types'
import { TAG_TYPE_COLORS } from '@/lib/shared/types'

interface Props {
  readonly label: string
  readonly type: TagType
  readonly onPress?: () => void
}

export function TagPill({ label, type, onPress }: Props) {
  const color = TAG_TYPE_COLORS[type]

  const style = {
    borderWidth: 0.5,
    borderColor: `${color}40`,
    backgroundColor: `${color}15`,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  } as const

  const content = (
    <Text style={{ fontFamily: 'Inter', fontSize: 11, color, letterSpacing: 0.3 }}>
      {label}
    </Text>
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
      accessibilityLabel={`Tag: ${label}`}
      accessibilityRole="button"
      style={style}
    >
      {content}
    </Pressable>
  )
}
