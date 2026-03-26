/**
 * Settings screen — Topic preferences, feed perspective, factuality, and digest toggle.
 * Auto-saves changes via the preferences API.
 */

import { View, Text, ScrollView, Pressable, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { useRequireAuth } from '@/lib/hooks/use-require-auth'
import { usePreferences } from '@/lib/hooks/use-preferences'
import type { PerspectiveFilter, FactualityLevel, Topic } from '@/lib/shared/types'
import { TOPIC_LABELS, PERSPECTIVE_LABELS } from '@/lib/shared/types'
import { GlassView } from '@/components/ui/GlassView'

const ALL_TOPICS: Topic[] = [
  'politics', 'world', 'technology', 'business',
  'science', 'health', 'culture', 'sports', 'environment',
]

const ALL_PERSPECTIVES: PerspectiveFilter[] = ['all', 'left', 'center', 'right']

const FACTUALITY_OPTIONS: { value: FactualityLevel; label: string }[] = [
  { value: 'mixed', label: 'No Minimum' },
  { value: 'high', label: 'High or Above' },
  { value: 'very-high', label: 'Very High Only' },
]

interface PillProps {
  readonly label: string
  readonly isActive: boolean
  readonly testID: string
  readonly onPress: () => void
}

function SettingPill({ label, isActive, testID, onPress }: PillProps) {
  return (
    <Pressable testID={testID} onPress={onPress}>
      <View style={{
        backgroundColor: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        borderWidth: 0.5,
        borderColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
        borderRadius: 9999,
        paddingHorizontal: 14,
        paddingVertical: 6,
      }}>
        <Text style={{
          fontFamily: 'Inter',
          fontSize: 13,
          color: isActive ? 'white' : 'rgba(255, 255, 255, 0.5)',
        }}>
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const { isLoading: authLoading } = useRequireAuth()
  const { preferences, updatePreferences } = usePreferences()

  if (authLoading) return null

  const toggleTopic = (topic: Topic) => {
    const current = preferences.followed_topics
    const updated = current.includes(topic)
      ? current.filter((t) => t !== topic)
      : [...current, topic]
    updatePreferences({ followed_topics: updated })
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <ChevronLeft size={20} color="rgba(255, 255, 255, 0.7)" />
          </Pressable>
          <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 24, color: 'white' }}>
            Settings
          </Text>
        </View>

        {/* Followed Topics */}
        <GlassView style={{ padding: 16, gap: 12 }}>
          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 16, color: 'white' }}>
            Followed Topics
          </Text>
          <Text style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
            Select topics you're interested in for your For You feed.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALL_TOPICS.map((topic) => (
              <SettingPill
                key={topic}
                testID={`setting-topic-${topic}`}
                label={TOPIC_LABELS[topic]}
                isActive={preferences.followed_topics.includes(topic)}
                onPress={() => toggleTopic(topic)}
              />
            ))}
          </View>
        </GlassView>

        {/* Default Perspective */}
        <GlassView style={{ padding: 16, gap: 12 }}>
          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 16, color: 'white' }}>
            Default Perspective
          </Text>
          <Text style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
            Filter your feed to focus on sources from a specific perspective.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALL_PERSPECTIVES.map((p) => (
              <SettingPill
                key={p}
                testID={`setting-perspective-${p}`}
                label={PERSPECTIVE_LABELS[p]}
                isActive={preferences.default_perspective === p}
                onPress={() => updatePreferences({ default_perspective: p })}
              />
            ))}
          </View>
        </GlassView>

        {/* Minimum Factuality */}
        <GlassView style={{ padding: 16, gap: 12 }}>
          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 16, color: 'white' }}>
            Minimum Factuality
          </Text>
          <Text style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
            Only show stories from sources meeting this factuality threshold.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {FACTUALITY_OPTIONS.map((opt) => (
              <SettingPill
                key={opt.value}
                testID={`setting-factuality-${opt.value}`}
                label={opt.label}
                isActive={preferences.factuality_minimum === opt.value}
                onPress={() => updatePreferences({ factuality_minimum: opt.value })}
              />
            ))}
          </View>
        </GlassView>

        {/* Email Digest */}
        <GlassView style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 16, color: 'white' }}>
              Blindspot Digest
            </Text>
            <Text style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
              Weekly email with stories you might be missing
            </Text>
          </View>
          <Switch
            value={preferences.blindspot_digest_enabled}
            onValueChange={(value) => updatePreferences({ blindspot_digest_enabled: value })}
            trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: 'rgba(255, 255, 255, 0.3)' }}
            thumbColor="white"
          />
        </GlassView>
      </ScrollView>
    </SafeAreaView>
  )
}
