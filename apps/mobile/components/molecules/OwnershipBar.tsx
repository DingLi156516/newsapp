/**
 * OwnershipBar (mobile) — horizontal segmented bar showing proportional
 * ownership of a story's sources. Mirror of components/molecules/OwnershipBar
 * on web, adapted to RN + theme tokens.
 */

import { View } from 'react-native'
import type { OwnershipDistribution } from '@/lib/shared/ownership-aggregator'
import type { OwnerType } from '@/lib/shared/types'
import { useTheme } from '@/lib/shared/theme'

const OWNER_TYPE_COLOR_TOKEN: Record<OwnerType, string> = {
  public_company: '#94a3b8',
  private_company: '#a1a1aa',
  cooperative: '#2dd4bf',
  public_broadcaster: '#38bdf8',
  trust: '#818cf8',
  individual: '#fbbf24',
  state_adjacent: '#fb7185',
  nonprofit: '#34d399',
}

interface OwnershipBarProps {
  readonly distribution: OwnershipDistribution
  readonly totalSources: number
  readonly height?: number
}

export function OwnershipBar({ distribution, totalSources, height = 8 }: OwnershipBarProps) {
  const theme = useTheme()
  if (totalSources <= 0) return null

  // flex widths are proportional to raw counts (NOT rounded percentages)
  // so 3-owner 1/1/1 scenarios don't render a phantom unknown slice.
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Ownership distribution of sources"
      testID="ownership-bar"
      style={{
        flexDirection: 'row',
        height,
        borderRadius: height / 2,
        overflow: 'hidden',
        backgroundColor: theme.semantic.muted.bg,
      }}
    >
      {distribution.groups.map((group) => (
        <View
          key={group.ownerId}
          testID={`ownership-segment-${group.ownerSlug}`}
          style={{
            flex: group.sourceCount,
            backgroundColor: OWNER_TYPE_COLOR_TOKEN[group.ownerType],
            opacity: 0.85,
          }}
        />
      ))}
      {distribution.unknownCount > 0 && (
        <View
          testID="ownership-segment-unknown"
          style={{
            flex: distribution.unknownCount,
            backgroundColor: theme.surface.border,
            opacity: 0.6,
          }}
        />
      )}
    </View>
  )
}
