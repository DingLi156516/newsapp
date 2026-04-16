/**
 * Profile / Dashboard screen — Bias calibration dashboard.
 * Matches web app/dashboard/page.tsx layout and sections.
 * Quick actions (History, Saved) available to all users.
 * Bias profile, suggestions, and sign out only for authenticated users.
 */

import { View, Text, ScrollView, Pressable } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Settings, Clock, LogOut, LogIn, BarChart3, Bookmark, BookOpen } from 'lucide-react-native'
import { useAuth } from '@/lib/hooks/use-auth'
import { useBiasProfile } from '@/lib/hooks/use-bias-profile'
import { useSuggestions } from '@/lib/hooks/use-suggestions'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'
import { useReadingHistory } from '@/lib/hooks/use-reading-history'
import { GlassView } from '@/components/ui/GlassView'
import { BiasComparisonBar } from '@/components/molecules/BiasComparisonBar'
import { NexusCard } from '@/components/organisms/NexusCard'
import { BIAS_LABELS, BIAS_OPACITY } from '@/lib/shared/types'
import { Skeleton } from '@/components/atoms/Skeleton'
import { BiasDonutChart } from '@/components/molecules/BiasDonutChart'
import { AnimatedCounter } from '@/components/atoms/AnimatedCounter'
import { useTheme } from '@/lib/shared/theme'

export default function ProfileScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { user, signOut } = useAuth()
  const { profile, isLoading: profileLoading } = useBiasProfile()
  const { suggestions, isLoading: suggestionsLoading } = useSuggestions()
  const { toggle, isBookmarked } = useBookmarks()
  const { readCount } = useReadingHistory()

  const blindspotSet = new Set(profile?.blindspots ?? [])

  const sectionLabel = { fontFamily: 'Inter-Medium', fontSize: 10, color: theme.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: 1.5 }
  const error = theme.semantic.error
  const warn = theme.semantic.warning

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 2 }}>
            <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 24, color: theme.text.primary }}>
              Dashboard
            </Text>
            <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.tertiary }}>
              {user?.email ?? 'Guest'}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
            <Settings size={20} color={theme.text.secondary} />
          </Pressable>
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => router.push('/history')} style={{ flex: 1 }}>
            <GlassView variant="sm" style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <Clock size={16} color={theme.text.secondary} />
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: theme.text.primary }}>History</Text>
            </GlassView>
          </Pressable>
          <Pressable onPress={() => router.push('/saved')} style={{ flex: 1 }}>
            <GlassView variant="sm" style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <Bookmark size={16} color={theme.text.secondary} />
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: theme.text.primary }}>Saved</Text>
            </GlassView>
          </Pressable>
          <Pressable onPress={() => router.push('/guide')} style={{ flex: 1 }}>
            <GlassView variant="sm" style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <BookOpen size={16} color={theme.text.secondary} />
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: theme.text.primary }}>Guide</Text>
            </GlassView>
          </Pressable>
        </View>

        {/* Authenticated-only sections */}
        {user ? (
          <>
            {/* Banner — matches web dashboard banner */}
            <GlassView testID="bias-banner" style={{ padding: 20, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: theme.surface.glassPill,
                  borderWidth: 0.5,
                  borderColor: theme.surface.borderPill,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <BarChart3 size={16} color={theme.text.primary} />
                </View>
                <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 20, color: theme.text.primary }}>
                  Bias Calibration
                </Text>
              </View>
              <Text style={{ fontFamily: 'Inter', fontSize: 13, color: theme.text.secondary, lineHeight: 20 }}>
                Your reading habits shape your worldview. This dashboard shows which perspectives you consume most — and which you're missing.
              </Text>
            </GlassView>

            {/* Stat cards with animated counters */}
            {profile && (
              <Animated.View entering={FadeInDown.delay(100).springify()} style={{ flexDirection: 'row', gap: 8 }}>
                <GlassView variant="sm" style={{ flex: 1, padding: 16, alignItems: 'center', gap: 4 }}>
                  <AnimatedCounter value={profile.totalStoriesRead} style={{ fontSize: 22 }} />
                  <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.tertiary }}>Stories Read</Text>
                </GlassView>
                <GlassView variant="sm" style={{ flex: 1, padding: 16, alignItems: 'center', gap: 4 }}>
                  <AnimatedCounter value={readCount} style={{ fontSize: 22 }} />
                  <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.tertiary }}>This Session</Text>
                </GlassView>
                <GlassView variant="sm" style={{ flex: 1, padding: 16, alignItems: 'center', gap: 4 }} glow={profile.blindspots.length > 0 ? warn.color : undefined}>
                  <AnimatedCounter value={profile.blindspots.length} style={{ fontSize: 22, color: profile.blindspots.length > 0 ? warn.color : theme.text.primary }} />
                  <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.tertiary }}>Blindspots</Text>
                </GlassView>
              </Animated.View>
            )}

            {/* Bias Profile */}
            {profileLoading ? (
              <View style={{ gap: 12 }}>
                <Skeleton style={{ height: 20, width: 160 }} />
                <Skeleton style={{ height: 200, borderRadius: 24 }} />
              </View>
            ) : profile ? (
              <>
                {/* Donut Chart Overview */}
                {(profile.userDistribution ?? []).length > 0 && (
                  <Animated.View entering={FadeInDown.delay(200).springify()} style={{ gap: 8 }}>
                    <Text style={sectionLabel}>Your Reading Spectrum</Text>
                    <GlassView style={{ padding: 20, alignItems: 'center' }}>
                      <BiasDonutChart distribution={profile.userDistribution ?? []} />
                    </GlassView>
                  </Animated.View>
                )}

                {/* Spectrum Comparison */}
                <View style={{ gap: 8 }}>
                  <Text style={sectionLabel}>Spectrum Comparison</Text>
                  <BiasComparisonBar
                    userDistribution={profile.userDistribution ?? []}
                    overallDistribution={profile.overallDistribution ?? []}
                  />
                </View>

                {/* Detailed Breakdown */}
                <View style={{ gap: 8 }}>
                  <Text style={sectionLabel}>Detailed Breakdown</Text>
                  <GlassView style={{ padding: 16, gap: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: theme.text.primary }}>
                        Bias Distribution
                      </Text>
                      {profile.dominantBias && (
                        <View style={{
                          backgroundColor: theme.surface.glassPill,
                          borderRadius: 9999,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderWidth: 0.5,
                          borderColor: theme.surface.borderPill,
                        }}>
                          <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.secondary }}>
                            Dominant: {BIAS_LABELS[profile.dominantBias]}
                          </Text>
                        </View>
                      )}
                    </View>

                    {(profile.userDistribution ?? []).map((item) => {
                      const overall = (profile.overallDistribution ?? []).find((o) => o.bias === item.bias)
                      const isBlindspot = blindspotSet.has(item.bias)

                      return (
                        <View key={item.bias} style={{ gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{
                              fontFamily: 'Inter',
                              fontSize: 12,
                              color: isBlindspot ? warn.color : theme.text.secondary,
                            }}>
                              {BIAS_LABELS[item.bias]}
                              {isBlindspot ? ' (blindspot)' : ''}
                            </Text>
                            <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.tertiary }}>
                              {item.percentage}% / {overall?.percentage ?? 0}%
                            </Text>
                          </View>
                          <View style={{ height: 8, borderRadius: 4, backgroundColor: `rgba(${theme.inkRgb}, 0.05)`, position: 'relative', overflow: 'hidden' }}>
                            {/* Overall (background) */}
                            <View style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              height: 8,
                              borderRadius: 4,
                              width: `${overall?.percentage ?? 0}%`,
                              backgroundColor: `rgba(${theme.inkRgb}, 0.1)`,
                            }} />
                            {/* User (foreground) */}
                            <View style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              height: 8,
                              borderRadius: 4,
                              width: `${item.percentage}%`,
                              backgroundColor: `rgba(${theme.inkRgb}, ${BIAS_OPACITY[item.bias]})`,
                            }} />
                          </View>
                        </View>
                      )
                    })}

                    {/* Legend */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: `rgba(${theme.inkRgb}, 0.3)` }} />
                        <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.tertiary }}>Your reading</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: `rgba(${theme.inkRgb}, 0.1)` }} />
                        <Text style={{ fontFamily: 'Inter', fontSize: 10, color: theme.text.tertiary }}>All stories</Text>
                      </View>
                    </View>
                  </GlassView>
                </View>

                {/* Blindspots */}
                {profile.blindspots.length > 0 && (
                  <View testID="blindspot-section" style={{ gap: 8 }}>
                    <Text style={sectionLabel}>Your Blindspots</Text>
                    <GlassView style={{ padding: 16, gap: 10 }}>
                      <Text style={{ fontFamily: 'Inter', fontSize: 13, color: theme.text.secondary, lineHeight: 20 }}>
                        You read significantly less from these perspectives compared to the overall distribution:
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {profile.blindspots.map((bias) => (
                          <View key={bias} style={{
                            backgroundColor: warn.bg,
                            borderRadius: 9999,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderWidth: 0.5,
                            borderColor: warn.border,
                          }}>
                            <Text style={{ fontFamily: 'Inter', fontSize: 12, color: warn.color }}>
                              {BIAS_LABELS[bias]}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </GlassView>
                  </View>
                )}
              </>
            ) : (
              <GlassView style={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'Inter', fontSize: 14, color: theme.text.tertiary, textAlign: 'center' }}>
                  Start reading stories to build your bias profile!
                </Text>
              </GlassView>
            )}

            {/* Suggestions */}
            <View style={{ gap: 8 }}>
              <Text style={sectionLabel}>Suggested For You</Text>
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.tertiary }}>
                Stories from perspectives you read less often.
              </Text>
              {suggestionsLoading ? (
                <View style={{ gap: 8 }}>
                  <Skeleton style={{ height: 80, borderRadius: 12 }} />
                  <Skeleton style={{ height: 80, borderRadius: 12 }} />
                </View>
              ) : suggestions.length > 0 ? (
                suggestions.slice(0, 3).map((article) => (
                  <NexusCard
                    key={article.id}
                    article={article}
                    onClick={() => router.push(`/story/${article.id}`)}
                    onSave={toggle}
                    isSaved={isBookmarked(article.id)}
                    compact
                  />
                ))
              ) : (
                <GlassView style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Inter', fontSize: 13, color: theme.text.tertiary }}>
                    No suggestions yet — keep reading to get personalized picks.
                  </Text>
                </GlassView>
              )}
            </View>

            {/* Sign out */}
            <Pressable
              testID="sign-out-button"
              onPress={signOut}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 14,
                borderRadius: 12,
                borderWidth: 0.5,
                borderColor: error.border,
                backgroundColor: pressed ? error.bg : 'transparent',
              })}
            >
              <LogOut size={16} color={error.color} />
              <Text style={{ fontFamily: 'Inter', fontSize: 14, color: error.color }}>Sign Out</Text>
            </Pressable>
          </>
        ) : (
          /* Sign-in CTA card for unauthenticated users */
          <GlassView testID="sign-in-cta" style={{ padding: 24, gap: 16, alignItems: 'center' }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.surface.glassPill,
              borderWidth: 0.5,
              borderColor: theme.surface.borderPill,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <BarChart3 size={20} color={theme.text.primary} />
            </View>
            <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 18, color: theme.text.primary, textAlign: 'center' }}>
              Unlock Bias Calibration
            </Text>
            <Text style={{ fontFamily: 'Inter', fontSize: 13, color: theme.text.tertiary, textAlign: 'center', lineHeight: 20 }}>
              Sign in to see your bias profile, reading stats, and personalized suggestions.
            </Text>
            <Pressable
              testID="sign-in-button"
              onPress={() => router.push('/(auth)/login')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: pressed ? theme.text.secondary : theme.text.primary,
                borderRadius: 12,
                paddingHorizontal: 24,
                paddingVertical: 12,
              })}
            >
              <LogIn size={18} color={theme.surface.background} />
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 15, color: theme.surface.background }}>Sign In</Text>
            </Pressable>
          </GlassView>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
