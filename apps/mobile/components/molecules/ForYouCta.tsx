import { View, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { GlassView } from '@/components/ui/GlassView'
import { Sparkles, X } from 'lucide-react-native'

interface ForYouCtaProps {
  readonly onDismiss: () => void
}

export function ForYouCta({ onDismiss }: ForYouCtaProps) {
  const router = useRouter()

  return (
    <GlassView style={{ padding: 24 }}>
      <Pressable
        onPress={onDismiss}
        style={{ position: 'absolute', top: 12, right: 12 }}
        hitSlop={8}
      >
        <X size={16} color="rgba(255, 255, 255, 0.4)" />
      </Pressable>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Sparkles size={28} color="rgba(255, 255, 255, 0.6)" />
        <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 16, color: 'white', textAlign: 'center' }}>
          Get personalized news
        </Text>
        <Text style={{ fontFamily: 'Inter', fontSize: 13, color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center' }}>
          Sign in to see stories tailored to your interests and reading habits.
        </Text>
        <Pressable
          onPress={() => router.push('/(auth)/login')}
          style={({ pressed }) => ({
            backgroundColor: pressed ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.1)',
            borderRadius: 9999,
            paddingHorizontal: 24,
            paddingVertical: 10,
            marginTop: 4,
          })}
        >
          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: 'white' }}>
            Sign In
          </Text>
        </Pressable>
      </View>
    </GlassView>
  )
}
