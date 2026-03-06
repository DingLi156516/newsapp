import { calculateSpectrum } from '@/lib/ai/spectrum-calculator'
import type { BiasCategory } from '@/lib/types'

describe('calculateSpectrum', () => {
  it('returns empty array for empty input', () => {
    expect(calculateSpectrum([])).toEqual([])
  })

  it('calculates percentages for a single bias', () => {
    const result = calculateSpectrum(['center', 'center', 'center'])
    expect(result).toEqual([{ bias: 'center', percentage: 100 }])
  })

  it('calculates percentages across multiple biases', () => {
    const biases: BiasCategory[] = ['left', 'left', 'center', 'right']
    const result = calculateSpectrum(biases)

    expect(result).toEqual([
      { bias: 'left', percentage: 50 },
      { bias: 'center', percentage: 25 },
      { bias: 'right', percentage: 25 },
    ])
  })

  it('maintains bias order from far-left to far-right', () => {
    const biases: BiasCategory[] = ['far-right', 'far-left', 'center']
    const result = calculateSpectrum(biases)

    expect(result[0].bias).toBe('far-left')
    expect(result[1].bias).toBe('center')
    expect(result[2].bias).toBe('far-right')
  })

  it('omits biases with zero count', () => {
    const biases: BiasCategory[] = ['left', 'right']
    const result = calculateSpectrum(biases)

    const hasCenter = result.some((s) => s.bias === 'center')
    expect(hasCenter).toBe(false)
  })

  it('rounds percentages to integers', () => {
    const biases: BiasCategory[] = ['left', 'left', 'center']
    const result = calculateSpectrum(biases)

    expect(result[0].percentage).toBe(67)
    expect(result[1].percentage).toBe(33)
  })
})
