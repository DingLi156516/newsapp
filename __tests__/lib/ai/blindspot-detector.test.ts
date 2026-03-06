import { isBlindspot } from '@/lib/ai/blindspot-detector'
import type { SpectrumSegment } from '@/lib/types'

describe('isBlindspot', () => {
  it('returns false for empty segments', () => {
    expect(isBlindspot([])).toBe(false)
  })

  it('returns false for balanced coverage', () => {
    const segments: SpectrumSegment[] = [
      { bias: 'left', percentage: 30 },
      { bias: 'center', percentage: 40 },
      { bias: 'right', percentage: 30 },
    ]
    expect(isBlindspot(segments)).toBe(false)
  })

  it('returns true when left coverage >= 80%', () => {
    const segments: SpectrumSegment[] = [
      { bias: 'far-left', percentage: 10 },
      { bias: 'left', percentage: 35 },
      { bias: 'lean-left', percentage: 40 },
      { bias: 'center', percentage: 10 },
      { bias: 'lean-right', percentage: 5 },
    ]
    expect(isBlindspot(segments)).toBe(true)
  })

  it('returns true when right coverage >= 80%', () => {
    const segments: SpectrumSegment[] = [
      { bias: 'center', percentage: 5 },
      { bias: 'lean-right', percentage: 25 },
      { bias: 'right', percentage: 40 },
      { bias: 'far-right', percentage: 30 },
    ]
    expect(isBlindspot(segments)).toBe(true)
  })

  it('returns false at exactly 79% left coverage', () => {
    const segments: SpectrumSegment[] = [
      { bias: 'left', percentage: 39 },
      { bias: 'lean-left', percentage: 40 },
      { bias: 'center', percentage: 21 },
    ]
    expect(isBlindspot(segments)).toBe(false)
  })

  it('returns true at exactly 80% right coverage', () => {
    const segments: SpectrumSegment[] = [
      { bias: 'center', percentage: 20 },
      { bias: 'right', percentage: 80 },
    ]
    expect(isBlindspot(segments)).toBe(true)
  })
})
