/**
 * Settings screen — Topic preferences, feed perspective, factuality, and digest toggle.
 * Auto-saves changes via the preferences API.
 */

import { View, Text, ScrollView, Pressable, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft, LogIn } from 'lucide-react-native'
import { useAuth } from '@/lib/hooks/use-auth'
import { usePreferences } from '@/lib/hooks/use-preferences'
import type { PerspectiveFilter, FactualityLevel, Topic } from '@/lib/shared/types'
import { TOPIC_LABELS, PERSPECTIVE_LABELS } from '@/lib/shared/types'
import { GlassView } from '@/components/ui/GlassView'
import { useTheme, useSetTheme, type ThemeName } from '@/lib/shared/theme'

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

const APPEARANCE_OPTIONS: { value: ThemeName; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'paper', label: 'Paper' },
]

interface PillProps {
  readonly label: string
  readonly isActive: boolean
  readonly testID: string
  readonly onPress: () => void
}

function SettingPill({ label, isActive, testID, onPress }: PillProps) {
  const theme = useTheme()
  return (
    <Pressable testID={testID} onPress={onPress}>
      <View style={{
        backgroundColor: isActive ? `rgba(${theme.inkRgb}, 0.1)` : 'transparent',
        borderWidth: 0.5,
        borderColor: isActive ? theme.surface.borderPill : theme.surface.border,
        borderRadius: 9999,
        paddingHorizontal: 14,
        paddingVertical: 6,
      }}>
        <Text style={{
          fontFamily: 'Inter',
          fontSize: 13,
          color: isActive ? theme.text.primary : theme.text.tertiary,
        }}>
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const theme = useTheme()
  const setTheme = useSetTheme()
  const { user } = useAuth()
  const { preferences, updatePreferences } = usePreferences()

  const toggleTopic = (topic: Topic) => {
    const current = preferences.followed_topics
    const updated = current.includes(topic)
      ? current.filter((t) => t !== topic)
      : [...current, topic]
    updatePreferences({ followed_topics: updated })
  }

  const sectionTitle = { fontFamily: 'Inter-SemiBold', fontSize: 16, color: theme.text.primary } as const
  const sectionHelp = { fontFamily: 'Inter', fontSize: 12, color: theme.text.tertiary } as const

  return (
    <SafeAreaView testID="settings-screen" style={{ flex: 1, backgroundColor: theme.surface.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <ChevronLeft size={20} color={theme.text.secondary} />
          </Pressable>
          <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 24, color: theme.text.primary }}>
            Settings
          </Text>
        </View>

        {/* Appearance */}
        <GlassView style={{ padding: 16, gap: 12 }}>
          <Text style={sectionTitle}>Appearance</Text>
          <Text style={sectionHelp}>
            Choose between the dark interface and a paper-style alternative with a sepia ground.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {APPEARANCE_OPTIONS.map((opt) => (
              <SettingPill
                key={opt.value}
                testID={`setting-theme-${opt.value}`}
                label={opt.label}
                isActive={theme.name === opt.value}
                onPress={() => setTheme(opt.value)}
              />
            ))}
          </View>
        </GlassView>

        {user ? (
          <>
            {/* Followed Topics */}
            <GlassView style={{ padding: 16, gap: 12 }}>
              <Text style={sectionTitle}>Followed Topics</Text>
              <Text style={sectionHelp}>
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
              <Text style={sectionTitle}>Default Perspective</Text>
              <Text style={sectionHelp}>
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
              <Text style={sectionTitle}>Minimum Factuality</Text>
              <Text style={sectionHelp}>
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
                <Text style={sectionTitle}>Blindspot Digest</Text>
                <Text style={sectionHelp}>
                  Weekly email with stories you might be missing
                </Text>
              </View>
              <Switch
                value={preferences.blindspot_digest_enabled}
                onValueChange={(value) => updatePreferences({ blindspot_digest_enabled: value })}
                trackColor={{ false: `rgba(${theme.inkRgb}, 0.1)`, true: `rgba(${theme.inkRgb}, 0.3)` }}
                thumbColor={theme.text.primary}
              />
            </GlassView>
          </>
        ) : (
          <GlassView testID="settings-sign-in-cta" style={{ padding: 20, gap: 12 }}>
            <Text style={sectionTitle}>Sign in to sync preferences</Text>
            <Text style={sectionHelp}>
              Create a free account to follow topics, set a default perspective, and receive the weekly blindspot digest.
            </Text>
            <Pressable
              testID="settings-sign-in-button"
              onPress={() => router.push('/(auth)/login')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: pressed ? theme.text.secondary : theme.text.primary,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginTop: 4,
              })}
            >
              <LogIn size={16} color={theme.surface.background} />
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.surface.background }}>
                Sign in or create account
              </Text>
            </Pressable>
          </GlassView>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
