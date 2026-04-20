/**
 * lib/news-api/providers/gdelt.ts — GDELT API client.
 *
 * Fetches articles from api.gdeltproject.org/api/v2/doc/doc
 * and maps responses to ParsedFeedItem[].
 * Free, no API key required. GDELT provides no description/content.
 */

import type { ParsedFeedItem } from '@/lib/rss/parser'
import type { NewsApiConfig } from '@/lib/news-api/types'

const BASE_URL = 'https://api.gdeltproject.org/api/v2/doc/doc'

interface GdeltArticle {
  url: string
  url_mobile?: string
  title: string
  seendate: string
  socialimage?: string
  domain: string
  language?: string
  sourcecountry?: string
}

interface GdeltResponse {
  articles?: GdeltArticle[]
}

/**
 * Converts GDELT date format (YYYYMMDDTHHMMSS) to ISO string, or null
 * if the upstream date is missing/invalid. Callers should mark the
 * resulting row as `published_at_estimated = true`.
 */
function parseGdeltDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null
  try {
    // Format: 20240115T143000Z or 20240115T143000
    const year = dateStr.slice(0, 4)
    const month = dateStr.slice(4, 6)
    const day = dateStr.slice(6, 8)
    const hour = dateStr.slice(9, 11) || '00'
    const minute = dateStr.slice(11, 13) || '00'
    const second = dateStr.slice(13, 15) || '00'

    const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`)
    if (isNaN(parsed.getTime())) return null
    return parsed.toISOString()
  } catch {
    return null
  }
}

export async function fetchGdelt(
  config: NewsApiConfig
): Promise<readonly ParsedFeedItem[]> {
  const params = new URLSearchParams()
  params.set('mode', 'ArtList')
  params.set('format', 'json')
  params.set('maxrecords', String(config.maxResults ?? 30))

  if (config.query) {
    params.set('query', config.query)
  } else {
    // Default query for English news
    params.set('query', config.language === 'en' || !config.language ? 'sourcelang:english' : `sourcelang:${config.language}`)
  }

  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: {
      'User-Agent': 'AxiomNews/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`GDELT HTTP ${response.status}`)
  }

  const data = (await response.json()) as GdeltResponse

  if (!data.articles || !Array.isArray(data.articles)) {
    return []
  }

  return data.articles
    .filter((article) => article.title && article.url)
    .map((article) => ({
      title: article.title.trim(),
      url: article.url.trim(),
      description: null, // GDELT provides no description
      content: null, // GDELT provides no content
      imageUrl: article.socialimage ?? null,
      publishedAt: parseGdeltDate(article.seendate),
      categories: null,
    }))
}
