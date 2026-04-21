/**
 * Tests for components/organisms/HeadlineRoundup.tsx
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeadlineRoundup } from '@/components/organisms/HeadlineRoundup'
import type { HeadlineComparison } from '@/lib/types'

vi.mock('framer-motion')

const h = (title: string, sourceName: string, sourceBias: HeadlineComparison['sourceBias']): HeadlineComparison => ({
  title, sourceName, sourceBias,
})

describe('HeadlineRoundup', () => {
  it('renders all three columns when L/C/R all present', () => {
    const headlines = [
      h('Left take', 'Guardian', 'left'),
      h('Center take', 'Reuters', 'center'),
      h('Right take', 'Fox', 'right'),
    ]
    render(<HeadlineRoundup headlines={headlines} />)
    expect(screen.getByTestId('headline-roundup-left')).toBeInTheDocument()
    expect(screen.getByTestId('headline-roundup-center')).toBeInTheDocument()
    expect(screen.getByTestId('headline-roundup-right')).toBeInTheDocument()
    expect(screen.getByText('Left take')).toBeInTheDocument()
    expect(screen.getByText('Center take')).toBeInTheDocument()
    expect(screen.getByText('Right take')).toBeInTheDocument()
  })

  it('hides a column when its bucket is empty', () => {
    const headlines = [
      h('Left take', 'Guardian', 'left'),
      h('Center take', 'Reuters', 'center'),
    ]
    render(<HeadlineRoundup headlines={headlines} />)
    expect(screen.getByTestId('headline-roundup-left')).toBeInTheDocument()
    expect(screen.getByTestId('headline-roundup-center')).toBeInTheDocument()
    expect(screen.queryByTestId('headline-roundup-right')).not.toBeInTheDocument()
  })

  it('returns null when fewer than two buckets have a headline', () => {
    const headlines = [h('Only left', 'Jacobin', 'far-left')]
    const { container } = render(<HeadlineRoundup headlines={headlines} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null for empty headlines', () => {
    const { container } = render(<HeadlineRoundup headlines={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('hides the right column on a left-blindspot story (a4-style)', () => {
    // Mirrors sample story `a4`: all coverage comes from left-leaning outlets.
    const headlines = [
      h('A', 'Guardian', 'left'),
      h('B', 'NYT', 'lean-left'),
      h('C', 'Jacobin', 'far-left'),
      h('D', 'Reuters', 'center'),
    ]
    render(<HeadlineRoundup headlines={headlines} />)
    expect(screen.getByTestId('headline-roundup-left')).toBeInTheDocument()
    expect(screen.getByTestId('headline-roundup-center')).toBeInTheDocument()
    expect(screen.queryByTestId('headline-roundup-right')).not.toBeInTheDocument()
  })

  it('renders the section label', () => {
    const headlines = [
      h('Left take', 'Guardian', 'left'),
      h('Right take', 'Fox', 'right'),
    ]
    render(<HeadlineRoundup headlines={headlines} />)
    expect(screen.getByLabelText('Headline roundup by political side')).toBeInTheDocument()
  })

  it('pins each side to its positional slot so missing buckets do not reflow', () => {
    // When only left + right are present, right must stay in column 3 on md+.
    const headlines = [
      h('Left take', 'Guardian', 'left'),
      h('Right take', 'Fox', 'right'),
    ]
    render(<HeadlineRoundup headlines={headlines} />)
    const leftCol = screen.getByTestId('headline-roundup-left')
    const rightCol = screen.getByTestId('headline-roundup-right')
    expect(leftCol.className).toContain('md:col-start-1')
    expect(rightCol.className).toContain('md:col-start-3')
  })
})
