/**
 * ScreenHeader — canonical screen-title row. Left-aligned `leading` slot
 * (icon, offline indicator), stacked title + optional subtitle in the middle,
 * `trailing` slot array on the right (usually IconButtons).
 *
 * Replaces the hand-rolled header rows in every tab.
 */

import { View, type StyleProp, type ViewStyle } from 'react-native'
import { Heading, Text } from '@/lib/ui/primitives'
import { SPACING } from '@/lib/ui/tokens'

export interface ScreenHeaderProps {
  readonly title: string
  readonly subtitle?: string
  readonly leading?: React.ReactNode
  readonly trailing?: readonly React.ReactNode[]
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  readonly titleTestID?: string
}

export function ScreenHeader({
  title,
  subtitle,
  leading,
  trailing,
  style,
  testID,
  titleTestID,
}: ScreenHeaderProps) {
  const hasTrailing = trailing && trailing.length > 0

  return (
    <View
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          alignItems: subtitle ? 'flex-start' : 'center',
          gap: SPACING.md,
          paddingHorizontal: SPACING.lg,
          paddingTop: SPACING.xs,
          paddingBottom: SPACING.sm,
        },
        style,
      ]}
    >
      {/* Render leading directly (not wrapped): if the node returns null at
          runtime (e.g. OfflineIndicator while online), row `gap` skips the
          slot instead of pushing the title right. */}
      {leading}

      <View style={{ flex: 1, gap: 4 }}>
        <Heading
          variant="display"
          testID={titleTestID ?? `${testID ?? 'screen-header'}-title`}
        >
          {title}
        </Heading>
        {subtitle && (
          <Text variant="bodySm" tone="tertiary">
            {subtitle}
          </Text>
        )}
      </View>

      {hasTrailing && (
        <View style={{ flexDirection: 'row', gap: SPACING.xs, alignItems: 'center' }}>
          {trailing.map((node, i) => (
            <View key={i}>{node}</View>
          ))}
        </View>
      )}
    </View>
  )
}
