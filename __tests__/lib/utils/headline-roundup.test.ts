/**
 * Tests for lib/utils/headline-roundup.ts
 */

import { describe, it, expect } from 'vitest'
import { selectHeadlineRoundup } from '@/lib/utils/headline-roundup'
import type { HeadlineComparison } from '@/lib/types'

const h = (title: string, sourceName: string, sourceBias: HeadlineComparison['sourceBias']): HeadlineComparison => ({
  title, sourceName, sourceBias,
})

describe('selectHeadlineRoundup', () => {
  it('picks one headline per side when all three present', () => {
    const headlines = [
      h('Left take', 'Guardian', 'left'),
      h('Center take', 'Reuters', 'center'),
      h('Right take', 'Fox', 'right'),
    ]
    const r = selectHeadlineRoundup(headlines)
    expect(r.left?.sourceName).toBe('Guardian')
    expect(r.center?.sourceName).toBe('Reuters')
    expect(r.right?.sourceName).toBe('Fox')
  })

  it('prefers far-left over left over lean-left', () => {
    const headlines = [
      h('Lean', 'NYT', 'lean-left'),
      h('Left', 'Guardian', 'left'),
      h('Far', 'Jacobin', 'far-left'),
    ]
    expect(selectHeadlineRoundup(headlines).left?.sourceName).toBe('Jacobin')
  })

  it('falls back to lean-left when no stronger left headline exists', () => {
    const headlines = [h('Lean', 'NYT', 'lean-left')]
    expect(selectHeadlineRoundup(headlines).left?.sourceName).toBe('NYT')
  })

  it('prefers far-right over right over lean-right', () => {
    const headlines = [
      h('Lean', 'WSJ', 'lean-right'),
      h('Right', 'Fox', 'right'),
      h('Far', 'Breitbart', 'far-right'),
    ]
    expect(selectHeadlineRoundup(headlines).right?.sourceName).toBe('Breitbart')
  })

  it('returns only center when only center headlines present', () => {
    const headlines = [h('Neutral', 'Reuters', 'center')]
    const r = selectHeadlineRoundup(headlines)
    expect(r.left).toBeUndefined()
    expect(r.right).toBeUndefined()
    expect(r.center?.sourceName).toBe('Reuters')
  })

  it('returns empty object for empty input', () => {
    const r = selectHeadlineRoundup([])
    expect(r.left).toBeUndefined()
    expect(r.center).toBeUndefined()
    expect(r.right).toBeUndefined()
  })

  it('tiebreaks to first occurrence within the same priority bias', () => {
    const headlines = [
      h('First left', 'Guardian', 'left'),
      h('Second left', 'MSNBC', 'left'),
    ]
    expect(selectHeadlineRoundup(headlines).left?.sourceName).toBe('Guardian')
  })

  it('returns right undefined when only left-leaning outlets covered the story', () => {
    const headlines = [
      h('A', 'Guardian', 'left'),
      h('B', 'NYT', 'lean-left'),
      h('C', 'Jacobin', 'far-left'),
    ]
    const r = selectHeadlineRoundup(headlines)
    expect(r.left).toBeDefined()
    expect(r.center).toBeUndefined()
    expect(r.right).toBeUndefined()
  })
})
