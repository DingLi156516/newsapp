/**
 * lib/crawler/article-discovery.ts — Discovers article URLs from a news site.
 *
 * Fetches the article list page, applies CSS selector via cheerio,
 * resolves relative URLs, deduplicates, and caps at maxArticles.
 */

import * as cheerio from 'cheerio'
import type { CrawlerConfig } from '@/lib/crawler/types'
import { isAllowedByRobots } from '@/lib/crawler/robots'
import { validatePublicUrl, validatePublicUrlWithDns } from '@/lib/rss/discover'

const DEFAULT_MAX_ARTICLES = 30
const FETCH_TIMEOUT = Number(process.env.PIPELINE_CRAWLER_TIMEOUT_MS ?? 15_000)
const USER_AGENT = process.env.CRAWLER_USER_AGENT ?? 'AxiomNews/1.0 (News Crawler)'

export async function discoverArticleUrls(
  config: CrawlerConfig
): Promise<readonly string[]> {
  const maxArticles = config.maxArticles ?? DEFAULT_MAX_ARTICLES

  // SSRF guard: resolve DNS and reject any URL targeting private/reserved networks
  await validatePublicUrlWithDns(config.articleListUrl)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  let html: string
  try {
    const response = await fetch(config.articleListUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
      },
    })

    // SSRF guard: re-validate final URL after redirect follow
    if (response.url && response.url !== config.articleListUrl) {
      await validatePublicUrlWithDns(response.url)
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${config.articleListUrl}`)
    }

    html = await response.text()
  } finally {
    clearTimeout(timeout)
  }

  const $ = cheerio.load(html)
  const urls = new Set<string>()

  $(config.articleLinkSelector).each((_, element) => {
    const href = $(element).attr('href')
    if (!href) return

    try {
      const resolved = new URL(href, config.articleListUrl).toString()
      // SSRF guard: reject any discovered URL targeting private/reserved networks
      validatePublicUrl(resolved)
      urls.add(resolved)
    } catch {
      // Skip invalid or private-network URLs
    }
  })

  // Check robots.txt and cap results
  const allowed: string[] = []
  for (const url of urls) {
    if (allowed.length >= maxArticles) break

    const robotsOk = await isAllowedByRobots(url)
    if (robotsOk) {
      allowed.push(url)
    }
  }

  return allowed
}
