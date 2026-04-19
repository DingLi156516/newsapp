/**
 * StatCard — Surface + animated counter + label. Used in Profile's 3-up
 * stats row. Optional `glow` paints the top-edge ambient gradient.
 */

import { View, type StyleProp, type ViewStyle } from 'react-native'
import { AnimatedCounter } from '@/components/atoms/AnimatedCounter'
import { Surface } from '@/lib/ui/primitives/Surface'
import { Text } from '@/lib/ui/primitives/Text'
import { SPACING } from '@/lib/ui/tokens'

export interface StatCardProps {
  readonly value: number
  readonly label: string
  readonly glow?: string
  readonly accent?: string
  readonly animated?: boolean
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

export function StatCard({
  value,
  label,
  glow,
  accent,
  animated = true,
  style,
  testID,
}: StatCardProps) {
  return (
    <Surface
      variant="glassSm"
      elevation="sm"
      glow={glow}
      style={[{ flex: 1, padding: SPACING.md }, style]}
      testID={testID}
    >
      <View style={{ gap: SPACING.xs }}>
        {animated ? (
          <AnimatedCounter
            value={value}
            style={accent ? { color: accent } : undefined}
          />
        ) : (
          <Text
            variant="title"
            style={accent ? { color: accent } : undefined}
          >
            {String(value)}
          </Text>
        )}
        <Text variant="small" tone="tertiary">
          {label}
        </Text>
      </View>
    </Surface>
  )
}
