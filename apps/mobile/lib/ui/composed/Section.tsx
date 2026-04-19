/**
 * Section — overline label row followed by children. Standardizes the
 * inline `sectionLabel` style used repeatedly in Profile.
 */

import { View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/lib/ui/primitives'
import { SPACING } from '@/lib/ui/tokens'

export interface SectionProps {
  readonly label: string
  readonly trailing?: React.ReactNode
  readonly children: React.ReactNode
  readonly style?: StyleProp<ViewStyle>
}

export function Section({ label, trailing, children, style }: SectionProps) {
  return (
    <View style={[{ gap: SPACING.sm }, style]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACING.sm,
        }}
      >
        <Text variant="overline" tone="muted">
          {label}
        </Text>
        {trailing}
      </View>
      {children}
    </View>
  )
}
