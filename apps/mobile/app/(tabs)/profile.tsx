/**
 * Profile / Dashboard screen — Bias calibration dashboard.
 * Matches web app/dashboard/page.tsx layout and sections.
 * Quick actions (History, Saved, Guide) available to all users.
 * Bias profile, suggestions, and sign out only for authenticated users.
 */

import { View, Text, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Settings, Clock, LogOut, LogIn, BarChart3, Bookmark, BookOpen } from 'lucide-react-native'
import type { LucideProps } from 'lucide-react-native'
import { useAuth } from '@/lib/hooks/use-auth'
import { useBiasProfile } from '@/lib/hooks/use-bias-profile'
import { useSuggestions } from '@/lib/hooks/use-suggestions'
import { useBookmarks } from '@/lib/hooks/use-bookmarks'
import { useReadingHistory } from '@/lib/hooks/use-reading-history'
import { TelemetryConsentToggle } from '@/components/molecules/TelemetryConsentToggle'
import { HotNowCard } from '@/components/organisms/HotNowCard'
import { BiasComparisonBar } from '@/components/molecules/BiasComparisonBar'
import { BiasDistributionList } from '@/components/molecules/BiasDistributionList'
import { NexusCard } from '@/components/organisms/NexusCard'
import { Skeleton } from '@/components/atoms/Skeleton'
import { BiasDonutChart } from '@/components/molecules/BiasDonutChart'
import { BIAS_LABELS } from '@/lib/shared/types'
import { useTheme } from '@/lib/shared/theme'
import { Heading, Text as UiText } from '@/lib/ui/primitives'
import { Button } from '@/lib/ui/primitives/Button'
import { IconButton } from '@/lib/ui/primitives/IconButton'
import { Surface } from '@/lib/ui/primitives/Surface'
import { ScreenHeader } from '@/lib/ui/composed/ScreenHeader'
import { Section } from '@/lib/ui/composed/Section'
import { StatCard } from '@/lib/ui/composed/StatCard'
import { CollapsibleSection } from '@/lib/ui/composed/CollapsibleSection'
import { SPACING } from '@/lib/ui/tokens'

interface QuickActionProps {
  readonly icon: React.ComponentType<LucideProps>
  readonly label: string
  readonly iconColor: string
  readonly onPress: () => void
}

function QuickAction({ icon: Icon, label, iconColor, onPress }: QuickActionProps) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Surface
        variant="glassSm"
        style={{
          padding: SPACING.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACING.xs + 2,
        }}
      >
        <Icon size={16} color={iconColor} />
        <UiText variant="headingSm">{label}</UiText>
      </Surface>
    </Pressable>
  )
}

export default function ProfileScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { user, signOut } = useAuth()
  const { profile, isLoading: profileLoading } = useBiasProfile()
  const { suggestions, isLoading: suggestionsLoading } = useSuggestions()
  const { toggle, isBookmarked } = useBookmarks()
  const { readCount } = useReadingHistory()

  const warn = theme.semantic.warning

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, gap: SPACING.lg }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Dashboard"
          subtitle={user?.email ?? 'Guest'}
          trailing={[
            <IconButton
              key="settings"
              icon={Settings}
              onPress={() => router.push('/settings')}
              accessibilityLabel="Open settings"
              tone="secondary"
              size="sm"
            />,
          ]}
        />

        <View style={{ flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg }}>
          <QuickAction
            icon={Clock}
            label="History"
            iconColor={theme.text.tertiary}
            onPress={() => router.push('/history')}
          />
          <QuickAction
            icon={Bookmark}
            label="Saved"
            iconColor={theme.text.primary}
            onPress={() => router.push('/saved')}
          />
          <QuickAction
            icon={BookOpen}
            label="Guide"
            iconColor={theme.semantic.info.color}
            onPress={() => router.push('/guide')}
          />
        </View>

        {user ? (
          <View style={{ gap: SPACING.lg, paddingHorizontal: SPACING.lg }}>
            <Surface testID="bias-banner" style={{ padding: SPACING.xl, gap: SPACING.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm + 2 }}>
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
                <Heading variant="title">Bias Calibration</Heading>
              </View>
              <UiText variant="bodySm" tone="secondary">
                Your reading habits shape your worldview. This dashboard shows which perspectives you consume most — and which you&apos;re missing.
              </UiText>
            </Surface>

            {profile && (
              <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                <StatCard value={profile.totalStoriesRead} label="Stories Read" />
                <StatCard value={readCount} label="This Session" />
                <StatCard
                  value={profile.blindspots.length}
                  label="Blindspots"
                  glow={profile.blindspots.length > 0 ? warn.color : undefined}
                  accent={profile.blindspots.length > 0 ? warn.color : undefined}
                />
              </View>
            )}

            {profileLoading ? (
              <View style={{ gap: SPACING.md }}>
                <Skeleton style={{ height: 20, width: 160 }} />
                <Skeleton style={{ height: 200, borderRadius: 24 }} />
              </View>
            ) : profile ? (
              <>
                {(profile.userDistribution ?? []).length > 0 && (
                  <Section label="Your Reading Spectrum">
                    <Surface style={{ padding: SPACING.xl, alignItems: 'center' }}>
                      <BiasDonutChart distribution={profile.userDistribution ?? []} />
                    </Surface>
                  </Section>
                )}

                <Section label="Spectrum Comparison">
                  <BiasComparisonBar
                    userDistribution={profile.userDistribution ?? []}
                    overallDistribution={profile.overallDistribution ?? []}
                  />
                </Section>

                <CollapsibleSection title="Detailed Breakdown" defaultExpanded>
                  <View style={{ padding: SPACING.lg, gap: SPACING.lg }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <UiText variant="headingSm">Bias Distribution</UiText>
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
                    <BiasDistributionList
                      userDistribution={profile.userDistribution ?? []}
                      overallDistribution={profile.overallDistribution ?? []}
                      blindspots={profile.blindspots}
                    />
                  </View>
                </CollapsibleSection>

                {profile.blindspots.length > 0 && (
                  <View testID="blindspot-section">
                    <Section label="Your Blindspots">
                      <Surface style={{ padding: SPACING.lg, gap: SPACING.sm + 2 }}>
                        <UiText variant="bodySm" tone="secondary">
                          You read significantly less from these perspectives compared to the overall distribution:
                        </UiText>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
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
                      </Surface>
                    </Section>
                  </View>
                )}
              </>
            ) : (
              <Surface style={{ padding: SPACING.xxl + 8, alignItems: 'center', justifyContent: 'center' }}>
                <UiText variant="body" tone="tertiary" style={{ textAlign: 'center' }}>
                  Start reading stories to build your bias profile!
                </UiText>
              </Surface>
            )}

            <CollapsibleSection
              title="Suggested For You"
              subtitle="Stories from perspectives you read less often."
            >
              {suggestionsLoading ? (
                <View style={{ padding: SPACING.lg, gap: SPACING.sm }}>
                  <Skeleton style={{ height: 80, borderRadius: 12 }} />
                  <Skeleton style={{ height: 80, borderRadius: 12 }} />
                </View>
              ) : suggestions.length > 0 ? (
                <View style={{ padding: SPACING.lg, gap: SPACING.sm }}>
                  {suggestions.slice(0, 3).map((article) => (
                    <NexusCard
                      key={article.id}
                      article={article}
                      onClick={() => router.push(`/story/${article.id}`)}
                      onSave={toggle}
                      isSaved={isBookmarked(article.id)}
                      compact
                    />
                  ))}
                </View>
              ) : (
                <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
                  <UiText variant="bodySm" tone="tertiary">
                    No suggestions yet — keep reading to get personalized picks.
                  </UiText>
                </View>
              )}
            </CollapsibleSection>

            <View style={{ marginHorizontal: -SPACING.lg }}>
              <HotNowCard />
            </View>

            <TelemetryConsentToggle />

            <Button
              testID="sign-out-button"
              onPress={signOut}
              variant="destructive"
              icon={LogOut}
              fullWidth
            >
              Sign Out
            </Button>
          </View>
        ) : (
          <View style={{ paddingHorizontal: SPACING.lg }}>
            <Surface testID="sign-in-cta" style={{ padding: SPACING.xxl, gap: SPACING.md, alignItems: 'center' }}>
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
              <Heading variant="title" style={{ textAlign: 'center' }}>
                Unlock Bias Calibration
              </Heading>
              <UiText variant="bodySm" tone="tertiary" style={{ textAlign: 'center' }}>
                Sign in to see your bias profile, reading stats, and personalized suggestions.
              </UiText>
              <Button
                testID="sign-in-button"
                onPress={() => router.push('/(auth)/login')}
                variant="primary"
                icon={LogIn}
              >
                Sign In
              </Button>
            </Surface>
            <View style={{ marginTop: SPACING.lg }}>
              <TelemetryConsentToggle />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
