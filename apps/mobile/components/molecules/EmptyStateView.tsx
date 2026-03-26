/**
 * EmptyStateView — Shown when a list has no results.
 * Supports title, body text, icon variants, and optional action button.
 */

import { View, Text, Pressable } from 'react-native'
import { SearchX, Inbox, BookOpen, Zap, Bookmark } from 'lucide-react-native'

interface Props {
  readonly message: string
  readonly title?: string
  readonly icon?: 'search' | 'inbox' | 'book' | 'lightning' | 'bookmark'
  readonly actionLabel?: string
  readonly onAction?: () => void
}

const ICON_MAP = { search: SearchX, inbox: Inbox, book: BookOpen, lightning: Zap, bookmark: Bookmark } as const

export function EmptyStateView({ message, title, icon = 'search', actionLabel, onAction }: Props) {
  const Icon = ICON_MAP[icon]

  return (
    <View style={{ padding: 48, alignItems: 'center', gap: 12 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        <Icon size={32} color="rgba(255, 255, 255, 0.25)" />
      </View>
      {title && (
        <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 18, color: '#fff', textAlign: 'center' }}>
          {title}
        </Text>
      )}
      <Text style={{ fontFamily: 'Inter', fontSize: 13, color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', lineHeight: 20, maxWidth: 240 }}>
        {message}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          testID="empty-state-action"
          style={{ marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' }}
        >
          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#fff' }}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  )
}
