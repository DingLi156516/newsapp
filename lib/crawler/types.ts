/**
 * lib/crawler/types.ts — Web crawler configuration types.
 */

export interface CrawlerConfig {
  readonly articleListUrl: string
  readonly articleLinkSelector: string
  readonly contentSelector?: string
  readonly titleSelector?: string
  readonly imageSelector?: string
  readonly jsRender?: boolean
  readonly maxArticles?: number
}

export interface ExtractedArticle {
  readonly title: string
  readonly url: string
  readonly description: string | null
  readonly content: string | null
  readonly imageUrl: string | null
  // Null when the page had no parseable date. Ingestion marks these as
  // published_at_estimated = true instead of fabricating a timestamp.
  readonly publishedAt: string | null
}
