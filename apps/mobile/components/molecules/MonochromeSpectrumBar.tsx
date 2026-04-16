import { View, type ViewProps } from 'react-native'
import type { SpectrumSegment } from '@/lib/shared/types'
import { BIAS_LABELS, BIAS_OPACITY } from '@/lib/shared/types'
import { useTheme } from '@/lib/shared/theme'

interface MonochromeSpectrumBarProps extends ViewProps {
  readonly segments: SpectrumSegment[]
  readonly height?: number
}

export function MonochromeSpectrumBar({ segments, height = 8, style, ...props }: MonochromeSpectrumBarProps) {
  const theme = useTheme()
  const total = segments.reduce((sum, s) => sum + s.percentage, 0)
  if (total === 0) return null

  const a11yParts = segments.filter(s => s.percentage > 0).map(s => `${BIAS_LABELS[s.bias]} ${s.percentage}%`)

  return (
    <View
      accessibilityLabel={`Bias spectrum: ${a11yParts.join(', ')}`}
      style={[{
        flexDirection: 'row',
        height,
        borderRadius: 9999,
        overflow: 'hidden',
        backgroundColor: `rgba(${theme.inkRgb}, 0.1)`,
        padding: 2,
      }, style]}
      {...props}
    >
      {segments.map((segment) => {
        if (segment.percentage === 0) return null
        return (
          <View
            key={segment.bias}
            style={{
              flex: segment.percentage / total,
              backgroundColor: `rgba(${theme.inkRgb}, ${BIAS_OPACITY[segment.bias]})`,
              borderRadius: 9999,
              marginHorizontal: 0.5,
            }}
          />
        )
      })}
    </View>
  )
}
