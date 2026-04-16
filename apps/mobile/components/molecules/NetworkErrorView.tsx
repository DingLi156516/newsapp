/**
 * NetworkErrorView — Shown when a network request fails. Provides retry button.
 */

import { View, Text, Pressable } from 'react-native'
import { WifiOff } from 'lucide-react-native'
import { GlassView } from '@/components/ui/GlassView'
import { useTheme } from '@/lib/shared/theme'

interface Props {
  readonly onRetry: () => void
}

export function NetworkErrorView({ onRetry }: Props) {
  const theme = useTheme()
  return (
    <View style={{ padding: 48, alignItems: 'center', gap: 16 }}>
      <WifiOff size={40} color={theme.text.muted} />
      <Text style={{ fontFamily: 'Inter', fontSize: 15, color: theme.text.secondary }}>
        Check your connection
      </Text>
      <Pressable onPress={onRetry}>
        <GlassView variant="sm" style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9999 }}>
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: theme.text.primary }}>
            Try again
          </Text>
        </GlassView>
      </Pressable>
    </View>
  )
}
