import { View, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { GlassView } from '@/components/ui/GlassView'
import { Sparkles, X } from 'lucide-react-native'
import { useTheme } from '@/lib/shared/theme'

interface ForYouCtaProps {
  readonly onDismiss: () => void
}

export function ForYouCta({ onDismiss }: ForYouCtaProps) {
  const router = useRouter()
  const theme = useTheme()

  return (
    <GlassView style={{ padding: 24 }}>
      <Pressable
        onPress={onDismiss}
        style={{ position: 'absolute', top: 12, right: 12 }}
        hitSlop={8}
      >
        <X size={16} color={theme.text.tertiary} />
      </Pressable>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Sparkles size={28} color={theme.text.secondary} />
        <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 16, color: theme.text.primary, textAlign: 'center' }}>
          Get personalized news
        </Text>
        <Text style={{ fontFamily: 'Inter', fontSize: 13, color: theme.text.tertiary, textAlign: 'center' }}>
          Sign in to see stories tailored to your interests and reading habits.
        </Text>
        <Pressable
          onPress={() => router.push('/(auth)/login')}
          style={({ pressed }) => ({
            backgroundColor: pressed
              ? `rgba(${theme.inkRgb}, 0.15)`
              : `rgba(${theme.inkRgb}, 0.1)`,
            borderRadius: 9999,
            paddingHorizontal: 24,
            paddingVertical: 10,
            marginTop: 4,
          })}
        >
          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.text.primary }}>
            Sign In
          </Text>
        </Pressable>
      </View>
    </GlassView>
  )
}
