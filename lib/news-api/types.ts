/**
 * lib/news-api/types.ts — News API provider configuration types.
 */

export type NewsApiProvider = 'newsapi' | 'gdelt'

export interface NewsApiConfig {
  readonly provider: NewsApiProvider
  readonly query?: string
  readonly language?: string
  readonly category?: string
  readonly country?: string
  readonly maxResults?: number
}
