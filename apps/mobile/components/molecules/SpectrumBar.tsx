/**
 * SpectrumBar — 3-group colored bias spectrum (Left / Center / Right).
 *
 * Aggregates the 7-category spectrum data into 3 visual groups with
 * blue (Left) / gray (Center) / red (Right) coloring.
 * Optional labels show percentage breakdowns below the bar.
 */

import { View, Text } from 'react-native'
import type { SpectrumSegment } from '@/lib/shared/types'
import { groupSpectrumSegments } from '@/lib/shared/types'
import { useTheme } from '@/lib/shared/theme'

interface SpectrumBarProps {
  readonly segments: SpectrumSegment[]
  readonly height?: number
  readonly showLabels?: boolean
}

export function SpectrumBar({ segments, height = 6, showLabels = false }: SpectrumBarProps) {
  const theme = useTheme()
  const groups = groupSpectrumSegments(segments)
  const total = groups.reduce((sum, g) => sum + g.percentage, 0)
  if (total === 0) return null

  const a11yParts = groups.filter(g => g.percentage > 0).map(g => `${g.label} ${g.percentage}%`)

  return (
    <View accessibilityLabel={`Bias spectrum: ${a11yParts.join(', ')}`} style={{ gap: showLabels ? 8 : 0 }}>
      {/* Bar */}
      <View
        style={{
          flexDirection: 'row',
          height,
          borderRadius: height / 2,
          overflow: 'hidden',
          backgroundColor: theme.semantic.muted.bg,
        }}
      >
        {groups.map((group) => {
          if (group.percentage === 0) return null
          return (
            <View
              key={group.label}
              style={{
                flex: group.percentage / total,
                backgroundColor: group.color,
                opacity: 0.85,
              }}
            />
          )
        })}
      </View>

      {/* Labels */}
      {showLabels && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {groups.map((group) => (
            <View key={group.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: group.color, opacity: 0.85 }} />
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.secondary }}>
                {group.label} {group.percentage}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
