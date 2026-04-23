/**
 * components/atoms/Sparkline.tsx — minimal inline-SVG bar sparkline.
 *
 * No external charting dependency. Renders one bar per value, scaled
 * to the largest value in the series. Empty series → nothing.
 */

interface SparklineProps {
  readonly values: ReadonlyArray<number>
  readonly width?: number
  readonly height?: number
  readonly color?: string
  readonly title?: string
}

export function Sparkline({
  values,
  width = 96,
  height = 18,
  color = 'currentColor',
  title,
}: SparklineProps) {
  if (values.length === 0) return null

  const max = Math.max(...values, 1)
  // Scale stride by width/N so dense series (e.g. 96 hourly snapshots in
  // 24h) still fit inside the viewBox. Bars get a 1px visual gap by being
  // 1px narrower than the stride; very dense series collapse to 1px wide.
  const stride = width / values.length
  const barWidth = Math.max(1, stride - 1)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title ?? 'sparkline'}
      data-testid="sparkline"
      className="overflow-visible"
    >
      {title && <title>{title}</title>}
      {values.map((v, i) => {
        const h = max > 0 ? Math.max(1, (v / max) * height) : 1
        return (
          <rect
            key={i}
            x={i * stride}
            y={height - h}
            width={barWidth}
            height={h}
            fill={color}
            opacity={0.7}
          />
        )
      })}
    </svg>
  )
}
