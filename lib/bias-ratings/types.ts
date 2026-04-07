/**
 * lib/bias-ratings/types.ts — Types for third-party bias rating providers.
 */

import type { BiasCategory, FactualityLevel } from '@/lib/types'

export type BiasProvider = 'mbfc' | 'allsides' | 'adfm'

export interface ProviderRating {
  readonly provider: BiasProvider
  readonly bias: BiasCategory | null
  readonly factuality: FactualityLevel | null
}

export interface ProviderLookupResult {
  readonly matched: boolean
  readonly rating: ProviderRating | null
  readonly matchedOn: string | null
}

export interface AggregatedRating {
  readonly bias: BiasCategory | null
  readonly factuality: FactualityLevel | null
  readonly providerCount: number
  readonly ratings: readonly ProviderRating[]
}

export interface SyncResult {
  readonly synced: number
  readonly skipped: number
  readonly overridden: number
  readonly unmatched: number
  readonly errors: readonly { source: string; reason: string }[]
}
