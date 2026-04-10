/**
 * lib/ingestion/types.ts — Shared interfaces for multi-source ingestion.
 *
 * All source types (RSS, crawler, news API) produce the same ParsedFeedItem
 * so the downstream pipeline (normalize → dedup → embed → cluster → assemble)
 * is unchanged.
 */

import type { ParsedFeedItem, FeedErrorType } from '@/lib/rss/parser'
import type { SourceType } from '@/lib/supabase/types'

export type { ParsedFeedItem, FeedErrorType, SourceType }

export interface IngestionSource {
  readonly sourceId: string
  readonly slug: string
  readonly name: string
  readonly sourceType: SourceType
  readonly rssUrl: string | null
  readonly config: Record<string, unknown>
}

export interface SourceFetcher {
  readonly sourceType: SourceType
  fetch(source: IngestionSource): Promise<FetchResult>
}

export interface FetchResult {
  readonly items: readonly ParsedFeedItem[]
  readonly error: FeedError | null
}

export interface FeedError {
  readonly slug: string
  readonly name: string
  readonly error: string
  readonly errorType: FeedErrorType
}

export interface IngestionResult {
  readonly totalSources: number
  readonly successfulSources: number
  readonly failedSources: number
  readonly newArticles: number
  readonly errors: readonly FeedError[]
  readonly byType: Readonly<Record<SourceType, TypeBreakdown>>
}

export interface TypeBreakdown {
  readonly total: number
  readonly successful: number
  readonly failed: number
  readonly articles: number
}
