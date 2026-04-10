/**
 * lib/news-api/providers/newsapi.ts — NewsAPI.org client.
 *
 * Fetches top headlines from api.newsapi.org/v2/top-headlines
 * and maps responses to ParsedFeedItem[].
 */

import type { ParsedFeedItem } from '@/lib/rss/parser'
import type { NewsApiConfig } from '@/lib/news-api/types'

const BASE_URL = 'https://newsapi.org/v2/top-headlines'

interface NewsApiArticle {
  title: string | null
  url: string | null
  description: string | null
  content: string | null
  urlToImage: string | null
  publishedAt: string | null
  source?: { id: string | null; name: string | null }
}

interface NewsApiResponse {
  status: string
  totalResults: number
  articles: NewsApiArticle[]
  code?: string
  message?: string
}

export async function fetchNewsApi(
  config: NewsApiConfig
): Promise<readonly ParsedFeedItem[]> {
  const apiKey = process.env.NEWSAPI_API_KEY
  if (!apiKey) {
    throw new Error('NEWSAPI_API_KEY environment variable is not configured')
  }

  const params = new URLSearchParams()
  params.set('pageSize', String(config.maxResults ?? 30))

  if (config.query) params.set('q', config.query)
  if (config.language) params.set('language', config.language)
  if (config.category) params.set('category', config.category)
  if (config.country) params.set('country', config.country)

  // Default to English US if no filters specified
  if (!config.query && !config.category && !config.country) {
    params.set('country', 'us')
  }

  // Authenticate via header, NOT query string — keeps the API key out of
  // request logs, proxy caches, and APM traces.
  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: {
      'User-Agent': 'AxiomNews/1.0',
      'X-Api-Key': apiKey,
    },
  })

  if (response.status === 401) {
    throw new Error('NewsAPI authentication failed — check NEWSAPI_API_KEY')
  }

  if (response.status === 429) {
    throw new Error('NewsAPI rate limit exceeded')
  }

  if (!response.ok) {
    throw new Error(`NewsAPI HTTP ${response.status}`)
  }

  const data = (await response.json()) as NewsApiResponse

  if (data.status !== 'ok') {
    throw new Error(`NewsAPI error: ${data.message ?? data.code ?? 'unknown'}`)
  }

  return data.articles
    .filter((article) => {
      // Filter out [Removed] articles (paywalled content placeholders)
      if (!article.title || !article.url) return false
      if (article.title === '[Removed]') return false
      if (article.description === '[Removed]') return false
      return true
    })
    .map((article) => ({
      title: article.title!.trim(),
      url: article.url!.trim(),
      description: article.description?.trim() ?? null,
      content: article.content?.trim() ?? null,
      imageUrl: article.urlToImage ?? null,
      publishedAt: normalizeNewsApiDate(article.publishedAt),
    }))
}

function normalizeNewsApiDate(raw: string | undefined | null): string | null {
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}
