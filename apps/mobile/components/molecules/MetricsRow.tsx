/**
 * MetricsRow — Compact trending metrics inline on the feed card.
 *
 * Mirrors web MetricsRow: shows impact (0-100), articles_24h, source diversity
 * when the feed is sorted by trending. Returns null when every metric is absent.
 */

import { View, Text } from 'react-native'
import { TrendingUp, Zap, Layers } from 'lucide-react-native'
import { BADGE, FONT } from '@/lib/shared/design'
import { useTheme } from '@/lib/shared/theme'

interface Props {
  readonly impactScore?: number | null
  readonly articles24h?: number | null
  readonly sourceDiversity?: number | null
}

export function MetricsRow({ impactScore, articles24h, sourceDiversity }: Props) {
  const theme = useTheme()
  const hasImpact = typeof impactScore === 'number'
  const hasVelocity = typeof articles24h === 'number'
  const hasDiversity = typeof sourceDiversity === 'number'

  if (!hasImpact && !hasVelocity && !hasDiversity) {
    return null
  }

  const chipStyle = {
    backgroundColor: theme.surface.glassPill,
    borderRadius: BADGE.borderRadius,
    paddingHorizontal: BADGE.paddingH,
    paddingVertical: BADGE.paddingV,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  }
  const valueStyle = {
    fontFamily: FONT.small.family,
    fontSize: FONT.small.size,
    color: theme.text.primary,
    fontWeight: '600' as const,
  }
  const suffixStyle = {
    fontFamily: FONT.small.family,
    fontSize: FONT.small.size,
    color: theme.text.tertiary,
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {hasImpact && (
        <View testID="metrics-impact" style={chipStyle}>
          <TrendingUp size={10} color={theme.text.tertiary} />
          <Text style={valueStyle}>{clamp100(impactScore!)}</Text>
          <Text style={suffixStyle}>impact</Text>
        </View>
      )}
      {hasVelocity && (
        <View testID="metrics-velocity" style={chipStyle}>
          <Zap size={10} color={theme.text.tertiary} />
          <Text style={valueStyle}>{articles24h}</Text>
          <Text style={suffixStyle}>/24h</Text>
        </View>
      )}
      {hasDiversity && (
        <View testID="metrics-diversity" style={chipStyle}>
          <Layers size={10} color={theme.text.tertiary} />
          <Text style={valueStyle}>{sourceDiversity}</Text>
          <Text style={suffixStyle}>owners</Text>
        </View>
      )}
    </View>
  )
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
