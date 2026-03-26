/**
 * Onboarding — 3-screen horizontal pager explaining Axiom's concepts.
 * Shown once on first launch. Skip button on every screen.
 */

import { useCallback, useRef, useState } from 'react'
import { View, Text, FlatList, Pressable, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { useOnboarding } from '@/lib/hooks/use-onboarding'
import { hapticLight } from '@/lib/haptics'
import { SEMANTIC } from '@/lib/shared/design'

interface OnboardingPage {
  readonly id: string
  readonly title: string
  readonly body: string
  readonly accentColor: string
}

const PAGES: readonly OnboardingPage[] = [
  {
    id: 'spectrum',
    title: 'See Every Perspective',
    body: 'Every story shows its bias spectrum — how left, center, and right media are covering it. No single narrative. The full picture.',
    accentColor: '#60a5fa',
  },
  {
    id: 'sources',
    title: '55 Sources, One Story',
    body: 'We cluster articles from 55 news outlets into unified stories. See how many sources cover each event and compare their framing side by side.',
    accentColor: '#9ca3af',
  },
  {
    id: 'blindspots',
    title: 'Find Your Blindspots',
    body: 'Axiom tracks your reading patterns and highlights blindspots — perspectives you might be missing. Build a more complete worldview.',
    accentColor: SEMANTIC.warning.color,
  },
] as const

function SpectrumIllustration() {
  return (
    <View style={{ gap: 12, width: '100%', paddingHorizontal: 8 }}>
      <View style={{ flexDirection: 'row', height: 32, borderRadius: 8, overflow: 'hidden' }}>
        <View style={{ flex: 15, backgroundColor: '#3b82f6' }} />
        <View style={{ flex: 20, backgroundColor: '#60a5fa' }} />
        <View style={{ flex: 25, backgroundColor: '#9ca3af' }} />
        <View style={{ flex: 22, backgroundColor: '#f87171' }} />
        <View style={{ flex: 18, backgroundColor: '#ef4444' }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: 'Inter', fontSize: 11, color: '#60a5fa' }}>{'◀ Left'}</Text>
        <Text style={{ fontFamily: 'Inter', fontSize: 11, color: '#9ca3af' }}>Center</Text>
        <Text style={{ fontFamily: 'Inter', fontSize: 11, color: '#f87171' }}>{'Right ▶'}</Text>
      </View>
    </View>
  )
}

function SourcesIllustration() {
  const sources = [
    { name: 'Associated Press', color: '#9ca3af', label: 'Center' },
    { name: 'NPR', color: '#60a5fa', label: 'Lean Left' },
    { name: 'Fox News', color: '#f87171', label: 'Right' },
    { name: 'The Daily Wire', color: '#ef4444', label: 'Far Right' },
  ]
  return (
    <View style={{ gap: 8, width: '100%' }}>
      {sources.map((s) => (
        <View key={s.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
          <Text style={{ flex: 1, fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{s.name}</Text>
          <Text style={{ fontFamily: 'Inter', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: `${s.color}22`, color: s.color }}>{s.label}</Text>
        </View>
      ))}
    </View>
  )
}

function BlindspotIllustration() {
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderStyle: 'dashed', borderColor: 'rgba(245,158,11,0.4)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 24, color: SEMANTIC.warning.color }}>?</Text>
        </View>
        <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderStyle: 'dashed', borderColor: 'rgba(245,158,11,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 24, color: 'rgba(245,158,11,0.5)' }}>?</Text>
        </View>
      </View>
      <Text style={{ fontFamily: 'Inter', fontSize: 11, color: 'rgba(245,158,11,0.7)', textAlign: 'center', lineHeight: 16 }}>
        Stories your reading habits{'\n'}might cause you to miss
      </Text>
    </View>
  )
}

const ILLUSTRATIONS = [SpectrumIllustration, SourcesIllustration, BlindspotIllustration] as const

export default function OnboardingScreen() {
  const router = useRouter()
  const { completeOnboarding } = useOnboarding()
  const { width } = useWindowDimensions()
  const [currentIndex, setCurrentIndex] = useState(0)
  const flatListRef = useRef<FlatList>(null)

  const finish = useCallback(async () => {
    await completeOnboarding()
    router.replace('/(tabs)')
  }, [completeOnboarding, router])

  const goToSignup = useCallback(async () => {
    await completeOnboarding()
    router.replace('/(auth)/signup')
  }, [completeOnboarding, router])

  const next = useCallback(() => {
    hapticLight()
    if (currentIndex < PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true })
    }
  }, [currentIndex])

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index)
    }
  }, [])

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current

  const isLastPage = currentIndex === PAGES.length - 1

  const renderPage = useCallback(({ item, index }: { item: OnboardingPage; index: number }) => {
    const Illustration = ILLUSTRATIONS[index]
    return (
      <View style={{ width, paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' }}>
        <View style={{ width: 200, height: 200, borderRadius: 100, backgroundColor: `${item.accentColor}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
          <Illustration />
        </View>

        <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 22, color: '#fff', textAlign: 'center', marginBottom: 12, lineHeight: 28 }}>
          {item.title}
        </Text>
        <Text style={{ fontFamily: 'Inter', fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 }}>
          {item.body}
        </Text>
      </View>
    )
  }, [width])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      {/* Skip button */}
      <View style={{ alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 8 }}>
        <Pressable onPress={finish} hitSlop={12} testID="skip-button">
          <Text style={{ fontFamily: 'Inter', fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Skip</Text>
        </Pressable>
      </View>

      {/* Pages */}
      <FlatList
        ref={flatListRef}
        data={PAGES as unknown as OnboardingPage[]}
        renderItem={renderPage}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Dots + buttons */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 20 }}>
        {/* Page dots */}
        <View testID="page-dots" style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === currentIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </View>

        {isLastPage ? (
          <View style={{ gap: 10 }}>
            <Pressable onPress={finish} testID="get-started-button" style={{ backgroundColor: '#fff', padding: 16, borderRadius: 14, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 16, color: '#0A0A0A' }}>Get Started</Text>
            </Pressable>
            <Pressable onPress={goToSignup} testID="create-account-button" style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: 16, borderRadius: 14, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 16, color: '#fff' }}>Create Account</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={next} testID="next-button" style={{ backgroundColor: '#fff', padding: 16, borderRadius: 14, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 16, color: '#0A0A0A' }}>Next</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  )
}
