/**
 * lib/ai/assembly-routing.ts — Tiered story-assembly routing.
 *
 * Decides which assembly path to run for a given cluster:
 *   - rich   → classifyStory + generateAISummary (full Gemini)
 *   - single → classifyStory + generateSingleSourceSummary
 *   - thin   → deterministic extractive assembly (no Gemini)
 *
 * Rich path is reserved for clusters with enough sources AND bias diversity
 * that multi-perspective synthesis is meaningful. Thin clusters (≤2 sources,
 * or 3+ sources all within the same L/C/R bucket) fall through to the cheap
 * deterministic path.
 *
 * Env overrides (read at call time):
 *   PIPELINE_ASSEMBLY_MODE=deterministic → always 'thin'
 *   PIPELINE_ASSEMBLY_MODE=gemini        → 'single' if 1 source, else 'rich'
 *   PIPELINE_RICH_CLUSTER_MIN_SOURCES    → default 3
 *   PIPELINE_RICH_CLUSTER_MIN_BUCKETS    → default 2
 */

import type { BiasCategory } from '@/lib/types'
import { LEFT_BIASES, RIGHT_BIASES } from '@/lib/ai/deterministic-assembly'

export type AssemblyPath = 'rich' | 'single' | 'thin'

export interface RoutingInput {
  readonly sourceCount: number
  readonly biases: readonly BiasCategory[]
}

const DEFAULT_MIN_SOURCES = 3
const DEFAULT_MIN_BUCKETS = 2

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}

export function countBiasBuckets(biases: readonly BiasCategory[]): number {
  let hasLeft = false
  let hasCenter = false
  let hasRight = false

  for (const bias of biases) {
    if (LEFT_BIASES.has(bias)) {
      hasLeft = true
    } else if (RIGHT_BIASES.has(bias)) {
      hasRight = true
    } else if (bias === 'center') {
      hasCenter = true
    }
  }

  return (hasLeft ? 1 : 0) + (hasCenter ? 1 : 0) + (hasRight ? 1 : 0)
}

export function chooseAssemblyPath(input: RoutingInput): AssemblyPath {
  const mode = process.env.PIPELINE_ASSEMBLY_MODE

  if (mode === 'deterministic') return 'thin'

  if (mode === 'gemini') {
    return input.sourceCount === 1 ? 'single' : 'rich'
  }

  if (input.sourceCount === 1) return 'single'

  const minSources = parsePositiveInt(
    process.env.PIPELINE_RICH_CLUSTER_MIN_SOURCES,
    DEFAULT_MIN_SOURCES
  )
  const minBuckets = parsePositiveInt(
    process.env.PIPELINE_RICH_CLUSTER_MIN_BUCKETS,
    DEFAULT_MIN_BUCKETS
  )

  if (
    input.sourceCount >= minSources &&
    countBiasBuckets(input.biases) >= minBuckets
  ) {
    return 'rich'
  }

  return 'thin'
}
