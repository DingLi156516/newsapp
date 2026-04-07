/**
 * lib/bias-ratings/index.ts — Barrel export for bias rating providers.
 */

export type {
  BiasProvider,
  ProviderRating,
  ProviderLookupResult,
  AggregatedRating,
  SyncResult,
} from '@/lib/bias-ratings/types'

export { normalizeDomain } from '@/lib/bias-ratings/normalize-domain'
export { lookupMbfc, normalizeMbfcBias, normalizeMbfcFactuality } from '@/lib/bias-ratings/providers/mbfc'
export { lookupAllSides, normalizeAllSidesBias } from '@/lib/bias-ratings/providers/allsides'
export { lookupAdFontes } from '@/lib/bias-ratings/providers/adfontesmedia'
export { aggregateRatings } from '@/lib/bias-ratings/aggregator'
