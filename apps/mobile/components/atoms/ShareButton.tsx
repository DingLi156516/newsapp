import { useCallback } from 'react'
import { Pressable, Share, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated'
import { Share2 } from 'lucide-react-native'
import { hapticLight } from '@/lib/haptics'
import { SITE_URL, TOUCH_TARGET } from '@/lib/shared/design'
import { useTheme } from '@/lib/shared/theme'
import { authFetch } from '@/lib/hooks/fetcher'
import { useSessionId } from '@/lib/hooks/use-session-id'
import { useTelemetryConsent } from '@/lib/hooks/use-telemetry-consent'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ShareButtonProps {
  readonly url: string
  readonly title: string
  readonly size?: number
  readonly storyId?: string
}

export function ShareButton({ url, title, size = 20, storyId }: ShareButtonProps) {
  const theme = useTheme()
  // Capture for worklet (cannot access React context inside useAnimatedStyle)
  const ringColor = theme.text.tertiary

  const scale = useSharedValue(1)
  const ringScale = useSharedValue(0.5)
  const ringOpacity = useSharedValue(0)

  const { sessionId, ready: sessionReady } = useSessionId()
  const { consent, ready: consentReady } = useTelemetryConsent()

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const ringStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    width: size * 2,
    height: size * 2,
    borderRadius: size,
    borderWidth: 2,
    borderColor: ringColor,
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }))

  const handleShare = useCallback(async () => {
    scale.value = withSequence(
      withTiming(0.75, { duration: 80 }),
      withSpring(1.15, { damping: 8 }),
      withSpring(1, { damping: 15 })
    )
    ringScale.value = 0.5
    ringOpacity.value = 0.4
    ringScale.value = withTiming(2.0, { duration: 400 })
    ringOpacity.value = withTiming(0, { duration: 400 })
    hapticLight()

    const fullUrl = url.startsWith('/') ? `${SITE_URL}${url}` : url

    let shared = false
    try {
      const result = await Share.share({
        message: `${title}\n${fullUrl}`,
        url: fullUrl,
      })
      // iOS distinguishes shared vs dismissed; Android resolves only on
      // share completion. Either way, only `sharedAction` counts as a
      // completed share — counting dismissals would systematically
      // overcount, especially on iOS where the picker dismiss is
      // a normal resolve path.
      shared = result.action === 'sharedAction'
    } catch {
      // User cancelled or share failed — no telemetry.
    }

    // Defer until both async hooks have finished hydrating. Without
    // `consentReady`, an opted-out user who taps Share immediately on
    // the first story open would still emit telemetry — `consent`
    // initializes to `true` and only flips to `false` once the
    // AsyncStorage read resolves.
    if (
      shared &&
      storyId &&
      UUID_REGEX.test(storyId) &&
      sessionReady &&
      consentReady &&
      sessionId &&
      consent
    ) {
      void authFetch('/api/events/story', {
        method: 'POST',
        headers: { 'x-session-id': sessionId },
        body: JSON.stringify({
          storyId,
          action: 'share',
          client: 'mobile',
        }),
      }).catch(() => {
        // Best-effort — never block on a telemetry failure.
      })
    }
  }, [url, title, scale, ringScale, ringOpacity, storyId, sessionId, sessionReady, consent, consentReady])

  return (
    <Pressable
      onPress={handleShare}
      hitSlop={TOUCH_TARGET.hitSlop}
      testID="share-button"
      accessibilityLabel="Share story"
      accessibilityRole="button"
      style={styles.container}
    >
      <Animated.View style={ringStyle} />
      <Animated.View style={animatedStyle}>
        <Share2 size={size} color={theme.text.tertiary} />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    minWidth: TOUCH_TARGET.min,
    minHeight: TOUCH_TARGET.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
