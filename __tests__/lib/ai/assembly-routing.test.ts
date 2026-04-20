/**
 * Tests for lib/ai/assembly-routing.ts — tiered routing decision table.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { BiasCategory } from '@/lib/types'
import { chooseAssemblyPath, countBiasBuckets } from '@/lib/ai/assembly-routing'

const ORIGINAL_MODE = process.env.PIPELINE_ASSEMBLY_MODE
const ORIGINAL_MIN_SOURCES = process.env.PIPELINE_RICH_CLUSTER_MIN_SOURCES
const ORIGINAL_MIN_BUCKETS = process.env.PIPELINE_RICH_CLUSTER_MIN_BUCKETS

function restore(name: string, original: string | undefined) {
  if (original === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = original
  }
}

beforeEach(() => {
  delete process.env.PIPELINE_ASSEMBLY_MODE
  delete process.env.PIPELINE_RICH_CLUSTER_MIN_SOURCES
  delete process.env.PIPELINE_RICH_CLUSTER_MIN_BUCKETS
})

afterEach(() => {
  restore('PIPELINE_ASSEMBLY_MODE', ORIGINAL_MODE)
  restore('PIPELINE_RICH_CLUSTER_MIN_SOURCES', ORIGINAL_MIN_SOURCES)
  restore('PIPELINE_RICH_CLUSTER_MIN_BUCKETS', ORIGINAL_MIN_BUCKETS)
})

describe('countBiasBuckets', () => {
  it('returns 0 for empty input', () => {
    expect(countBiasBuckets([])).toBe(0)
  })

  it('collapses all left-leaning biases into one bucket', () => {
    const biases: BiasCategory[] = ['far-left', 'left', 'lean-left']
    expect(countBiasBuckets(biases)).toBe(1)
  })

  it('collapses all right-leaning biases into one bucket', () => {
    const biases: BiasCategory[] = ['lean-right', 'right', 'far-right']
    expect(countBiasBuckets(biases)).toBe(1)
  })

  it('counts L + C as 2 buckets', () => {
    const biases: BiasCategory[] = ['left', 'center']
    expect(countBiasBuckets(biases)).toBe(2)
  })

  it('counts L + R as 2 buckets', () => {
    const biases: BiasCategory[] = ['left', 'right']
    expect(countBiasBuckets(biases)).toBe(2)
  })

  it('counts L + C + R as 3 buckets', () => {
    const biases: BiasCategory[] = ['far-left', 'center', 'far-right']
    expect(countBiasBuckets(biases)).toBe(3)
  })
})

describe('chooseAssemblyPath — default thresholds (3 sources, 2 buckets)', () => {
  it('returns single for a 1-source cluster', () => {
    expect(
      chooseAssemblyPath({ sourceCount: 1, biases: ['left'] })
    ).toBe('single')
  })

  it('returns thin for a 2-source cluster regardless of bias spread', () => {
    expect(
      chooseAssemblyPath({ sourceCount: 2, biases: ['left', 'right'] })
    ).toBe('thin')
  })

  it('returns thin for 3 sources all in one bucket (all left-ish)', () => {
    expect(
      chooseAssemblyPath({
        sourceCount: 3,
        biases: ['far-left', 'left', 'lean-left'],
      })
    ).toBe('thin')
  })

  it('returns rich for 3 sources spanning L + C', () => {
    expect(
      chooseAssemblyPath({
        sourceCount: 3,
        biases: ['left', 'left', 'center'],
      })
    ).toBe('rich')
  })

  it('returns rich for 3 sources spanning L + R', () => {
    expect(
      chooseAssemblyPath({
        sourceCount: 3,
        biases: ['left', 'right', 'right'],
      })
    ).toBe('rich')
  })

  it('returns rich for 3 sources spanning L + C + R', () => {
    expect(
      chooseAssemblyPath({
        sourceCount: 3,
        biases: ['far-left', 'center', 'far-right'],
      })
    ).toBe('rich')
  })
})

describe('chooseAssemblyPath — PIPELINE_ASSEMBLY_MODE overrides', () => {
  it('forces thin when PIPELINE_ASSEMBLY_MODE=deterministic (single source)', () => {
    process.env.PIPELINE_ASSEMBLY_MODE = 'deterministic'
    expect(
      chooseAssemblyPath({ sourceCount: 1, biases: ['left'] })
    ).toBe('thin')
  })

  it('forces thin when PIPELINE_ASSEMBLY_MODE=deterministic (rich cluster)', () => {
    process.env.PIPELINE_ASSEMBLY_MODE = 'deterministic'
    expect(
      chooseAssemblyPath({
        sourceCount: 5,
        biases: ['left', 'center', 'right', 'left', 'right'],
      })
    ).toBe('thin')
  })

  it('forces single when PIPELINE_ASSEMBLY_MODE=gemini and sourceCount=1', () => {
    process.env.PIPELINE_ASSEMBLY_MODE = 'gemini'
    expect(
      chooseAssemblyPath({ sourceCount: 1, biases: ['center'] })
    ).toBe('single')
  })

  it('forces rich when PIPELINE_ASSEMBLY_MODE=gemini and sourceCount>=2 (ignores bucket threshold)', () => {
    process.env.PIPELINE_ASSEMBLY_MODE = 'gemini'
    expect(
      chooseAssemblyPath({ sourceCount: 2, biases: ['left', 'left'] })
    ).toBe('rich')
  })
})

describe('chooseAssemblyPath — custom thresholds', () => {
  it('respects PIPELINE_RICH_CLUSTER_MIN_SOURCES=4 (3-source cluster becomes thin)', () => {
    process.env.PIPELINE_RICH_CLUSTER_MIN_SOURCES = '4'
    expect(
      chooseAssemblyPath({
        sourceCount: 3,
        biases: ['left', 'center', 'right'],
      })
    ).toBe('thin')
  })

  it('respects PIPELINE_RICH_CLUSTER_MIN_SOURCES=4 (4-source cluster stays rich)', () => {
    process.env.PIPELINE_RICH_CLUSTER_MIN_SOURCES = '4'
    expect(
      chooseAssemblyPath({
        sourceCount: 4,
        biases: ['left', 'center', 'right', 'left'],
      })
    ).toBe('rich')
  })

  it('respects PIPELINE_RICH_CLUSTER_MIN_BUCKETS=3 (L+R cluster becomes thin)', () => {
    process.env.PIPELINE_RICH_CLUSTER_MIN_BUCKETS = '3'
    expect(
      chooseAssemblyPath({
        sourceCount: 4,
        biases: ['left', 'left', 'right', 'right'],
      })
    ).toBe('thin')
  })

  it('respects PIPELINE_RICH_CLUSTER_MIN_BUCKETS=3 (L+C+R cluster stays rich)', () => {
    process.env.PIPELINE_RICH_CLUSTER_MIN_BUCKETS = '3'
    expect(
      chooseAssemblyPath({
        sourceCount: 3,
        biases: ['left', 'center', 'right'],
      })
    ).toBe('rich')
  })
})
