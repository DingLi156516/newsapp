import { Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { HelpCircle } from 'lucide-react-native'
import { TOUCH_TARGET } from '@/lib/shared/design'
import { useTheme } from '@/lib/shared/theme'

export function GuideLink() {
  const router = useRouter()
  const theme = useTheme()

  return (
    <Pressable
      onPress={() => router.push('/guide')}
      hitSlop={TOUCH_TARGET.hitSlop}
      accessibilityLabel="Learn more"
      accessibilityRole="button"
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <HelpCircle size={12} color={theme.text.muted} />
    </Pressable>
  )
}
