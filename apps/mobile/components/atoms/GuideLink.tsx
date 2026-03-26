import { Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { HelpCircle } from 'lucide-react-native'
import { TOUCH_TARGET } from '@/lib/shared/design'

export function GuideLink() {
  const router = useRouter()

  return (
    <Pressable
      onPress={() => router.push('/guide')}
      hitSlop={TOUCH_TARGET.hitSlop}
      accessibilityLabel="Learn more"
      accessibilityRole="button"
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <HelpCircle size={12} color="rgba(255, 255, 255, 0.3)" />
    </Pressable>
  )
}
