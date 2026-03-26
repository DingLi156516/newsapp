import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { ALL_FACTUALITIES, FACTUALITY_LABELS } from '@/lib/shared/types'
import { FACTUALITY } from '@/lib/shared/design'
import type { FactualityLevel } from '@/lib/shared/types'

describe('FactualityBar', () => {
  it.each(ALL_FACTUALITIES)(
    'has accessibility label for level "%s"',
    (level: FactualityLevel) => {
      render(<FactualityBar level={level} />)
      expect(screen.getByLabelText(`Factuality: ${FACTUALITY_LABELS[level]}`)).toBeTruthy()
    }
  )

  it.each(ALL_FACTUALITIES)(
    'fill bar uses correct color for level "%s"',
    (level: FactualityLevel) => {
      const { toJSON } = render(<FactualityBar level={level} />)
      const tree = toJSON() as { children: Array<{ children: Array<{ props: { style: { backgroundColor: string } } }> }> }
      const track = tree.children[0]
      const fill = track.children[0]
      expect(fill.props.style.backgroundColor).toBe(FACTUALITY[level].color)
    }
  )

  it('default size: track is 40x4', () => {
    const { toJSON } = render(<FactualityBar level="high" />)
    const tree = toJSON() as { children: Array<{ props: { style: { width: number; height: number } } }> }
    const track = tree.children[0]
    expect(track.props.style.width).toBe(40)
    expect(track.props.style.height).toBe(4)
  })

  it('compact size: track is 28x3', () => {
    const { toJSON } = render(<FactualityBar level="high" size="compact" />)
    const tree = toJSON() as { children: Array<{ props: { style: { width: number; height: number } } }> }
    const track = tree.children[0]
    expect(track.props.style.width).toBe(28)
    expect(track.props.style.height).toBe(3)
  })

  it('renders text label when showLabel is true', () => {
    render(<FactualityBar level="high" showLabel />)
    expect(screen.getByText('High Factuality')).toBeTruthy()
  })

  it('does not render text label when showLabel is false', () => {
    render(<FactualityBar level="high" />)
    expect(screen.queryByText('High Factuality')).toBeNull()
  })
})
