import React from 'react'
import { render } from '@testing-library/react-native'

import { Skeleton } from '@/components/atoms/Skeleton'

describe('Skeleton', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<Skeleton />)
    expect(toJSON()).not.toBeNull()
  })

  it('applies custom width and height', () => {
    const { toJSON } = render(<Skeleton width={200} height={24} />)
    const tree = toJSON() as { props: { style: Array<{ width: number; height: number }> } }
    // Animated.View merges styles as an array; the animated style contains width/height
    const animatedStyle = tree.props.style.find(
      (s: Record<string, unknown>) => s && 'width' in s && 'height' in s
    )
    expect(animatedStyle?.width).toBe(200)
    expect(animatedStyle?.height).toBe(24)
  })

  it('applies custom borderRadius', () => {
    const { toJSON } = render(<Skeleton borderRadius={16} />)
    const tree = toJSON() as { props: { style: Array<{ borderRadius: number }> } }
    const animatedStyle = tree.props.style.find(
      (s: Record<string, unknown>) => s && 'borderRadius' in s
    )
    expect(animatedStyle?.borderRadius).toBe(16)
  })
})
