/**
 * Guide screen — Visual language reference for all app indicators.
 */

import { View, Text, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft, BookOpen } from 'lucide-react-native'
import {
  ALL_BIASES,
  ALL_FACTUALITIES,
  ALL_OWNERSHIPS,
  BIAS_LABELS,
  BIAS_COLOR,
  FACTUALITY_LABELS,
  OWNERSHIP_LABELS,
} from '@/lib/shared/types'
import { GlassView } from '@/components/ui/GlassView'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'
import { CoverageCount } from '@/components/atoms/CoverageCount'
import { useTheme } from '@/lib/shared/theme'

const OWNERSHIP_DESCRIPTIONS: Record<string, string> = {
  'independent': 'Independently owned, not part of a larger media conglomerate.',
  'corporate': 'Owned by a publicly traded or large private corporation.',
  'non-profit': 'Operated as a non-profit organization, often donor-funded.',
  'state-funded': 'Receives significant funding from a national government.',
  'private-equity': 'Owned or controlled by a private equity firm.',
  'telecom': 'Owned by a telecommunications company.',
  'government': 'Directly operated by a government entity.',
  'other': 'Ownership structure does not fit other categories.',
}

export default function GuideScreen() {
  const router = useRouter()
  const theme = useTheme()
  const sectionLabel = { fontFamily: 'Inter-Medium', fontSize: 10, color: theme.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: 1.5 }
  const sectionBody = { fontFamily: 'Inter', fontSize: 13, color: theme.text.secondary, lineHeight: 20 }
  const sectionMuted = { fontFamily: 'Inter', fontSize: 11, color: theme.text.muted, lineHeight: 16 }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable testID="back-button" onPress={() => router.back()} hitSlop={8}>
            <ChevronLeft size={24} color={theme.text.secondary} />
          </Pressable>
          <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 24, color: theme.text.primary }}>
            Guide
          </Text>
        </View>

        {/* Banner */}
        <GlassView style={{ padding: 20, gap: 12 }}>
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
              <BookOpen size={16} color={theme.text.primary} />
            </View>
            <Text style={{ fontFamily: 'Inter', fontSize: 13, color: theme.text.secondary, flex: 1, lineHeight: 20 }}>
              Axiom uses visual indicators to surface bias, factuality, and coverage patterns at a glance.
            </Text>
          </View>
        </GlassView>

        {/* Section 1: Bias Spectrum */}
        <GlassView testID="bias-spectrum-section" style={{ padding: 16, gap: 12 }}>
          <Text style={sectionLabel}>Bias Spectrum</Text>
          <Text style={sectionBody}>
            Every story shows its political spectrum — from far left to far right. Each source is independently rated for political leaning.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALL_BIASES.map((bias) => (
              <View key={bias} style={{
                backgroundColor: `${BIAS_COLOR[bias]}1A`,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 9999,
              }}>
                <Text style={{ fontFamily: 'Inter', fontSize: 11, color: BIAS_COLOR[bias] }}>
                  {BIAS_LABELS[bias]}
                </Text>
              </View>
            ))}
          </View>
          <Text style={sectionMuted}>
            Blue tones = left-leaning · Gray = center · Red tones = right-leaning
          </Text>
        </GlassView>

        {/* Section 2: Factuality */}
        <GlassView testID="factuality-section" style={{ padding: 16, gap: 12 }}>
          <Text style={sectionLabel}>Factuality Ratings</Text>
          <Text style={sectionBody}>
            The colored bar shows how factual a source is rated. A fuller green bar means higher factuality; a shorter red bar means lower.
          </Text>
          <View style={{ gap: 10 }}>
            {ALL_FACTUALITIES.map((level) => (
              <View key={level} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FactualityBar level={level} showLabel />
              </View>
            ))}
          </View>
        </GlassView>

        {/* Section 3: Blindspots */}
        <GlassView testID="blindspots-section" style={{ padding: 16, gap: 12 }}>
          <Text style={sectionLabel}>Blindspots</Text>
          <Text style={sectionBody}>
            A blindspot badge appears when a story's coverage is heavily skewed to one side — more than 80% of sources lean the same direction.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <BlindspotBadge />
            <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.tertiary }}>
              Indicates skewed coverage
            </Text>
          </View>
          <Text style={sectionBody}>
            Your personal blindspot tracking is available in the Dashboard, analyzing which perspectives you may be missing.
          </Text>
        </GlassView>

        {/* Section 4: Coverage */}
        <GlassView testID="coverage-section" style={{ padding: 16, gap: 12 }}>
          <Text style={sectionLabel}>Coverage & Sources</Text>
          <Text style={sectionBody}>
            The source count shows how many outlets are covering a story. Higher counts indicate more significant events.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <CoverageCount count={12} />
            <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.tertiary }}>
              12 outlets covering this story
            </Text>
          </View>
        </GlassView>

        {/* Section 5: Ownership */}
        <GlassView testID="ownership-section" style={{ padding: 16, gap: 12 }}>
          <Text style={sectionLabel}>Ownership Types</Text>
          <Text style={sectionBody}>
            Who funds a news source can affect its editorial independence. Axiom labels each source with an ownership type.
          </Text>
          <View style={{ gap: 8 }}>
            {ALL_OWNERSHIPS.map((type) => (
              <View key={type} style={{
                backgroundColor: `rgba(${theme.inkRgb}, 0.03)`,
                borderRadius: 10,
                padding: 12,
                gap: 4,
              }}>
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: theme.text.primary }}>
                  {OWNERSHIP_LABELS[type]}
                </Text>
                <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.tertiary, lineHeight: 16 }}>
                  {OWNERSHIP_DESCRIPTIONS[type]}
                </Text>
              </View>
            ))}
          </View>
        </GlassView>
      </ScrollView>
    </SafeAreaView>
  )
}
