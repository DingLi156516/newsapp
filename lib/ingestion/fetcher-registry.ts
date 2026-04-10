/**
 * lib/ingestion/fetcher-registry.ts — Strategy pattern for source fetchers.
 *
 * Maps source types to their corresponding SourceFetcher implementations.
 * New source types register their fetcher here.
 */

import type { SourceType, SourceFetcher } from '@/lib/ingestion/types'

const fetchers = new Map<SourceType, SourceFetcher>()

export function registerFetcher(fetcher: SourceFetcher): void {
  fetchers.set(fetcher.sourceType, fetcher)
}

export function getFetcher(sourceType: SourceType): SourceFetcher {
  const fetcher = fetchers.get(sourceType)
  if (!fetcher) {
    throw new Error(`No fetcher registered for source type: ${sourceType}`)
  }
  return fetcher
}

export function hasFetcher(sourceType: SourceType): boolean {
  return fetchers.has(sourceType)
}
