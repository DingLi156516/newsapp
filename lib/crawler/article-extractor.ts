/**
 * lib/crawler/article-extractor.ts — Extracts article content from a web page.
 *
 * Uses linkedom + @mozilla/readability for content extraction, with
 * fallback to CSS selectors from CrawlerConfig.
 */

import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import * as cheerio from 'cheerio'
import type { CrawlerConfig, ExtractedArticle } from '@/lib/crawler/types'
import { validatePublicUrlWithDns } from '@/lib/rss/discover'

const FETCH_TIMEOUT = Number(process.env.PIPELINE_CRAWLER_TIMEOUT_MS ?? 15_000)
const USER_AGENT = process.env.CRAWLER_USER_AGENT ?? 'AxiomNews/1.0 (News Crawler)'

async function fetchHtml(url: string): Promise<string> {
  // SSRF guard: reject any URL targeting private/reserved networks, including
  // hostnames that resolve via DNS to private IPs
  await validatePublicUrlWithDns(url)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
      },
    })

    // SSRF guard: validate final URL after redirect follow (prevents redirect-based SSRF)
    if (response.url && response.url !== url) {
      await validatePublicUrlWithDns(response.url)
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`)
    }

    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

function extractWithReadability(
  html: string,
  url: string
): { title: string; content: string; excerpt: string | null } | null {
  try {
    const { document } = parseHTML(html)
    const reader = new Readability(document as unknown as Document)
    const article = reader.parse()

    if (!article || !article.title) return null

    return {
      title: article.title,
      content: article.content ?? '',
      excerpt: article.excerpt ?? null,
    }
  } catch {
    return null
  }
}

function extractPublishedAt(html: string): string {
  const $ = cheerio.load(html)

  // Try meta tags
  const metaSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[property="og:article:published_time"]',
    'meta[name="pubdate"]',
    'meta[name="publish-date"]',
    'meta[name="date"]',
  ]

  for (const selector of metaSelectors) {
    const content = $(selector).attr('content')
    if (content) {
      const parsed = new Date(content)
      if (!isNaN(parsed.getTime())) return parsed.toISOString()
    }
  }

  // Try <time> element with datetime attribute
  const timeEl = $('time[datetime]').first()
  if (timeEl.length) {
    const datetime = timeEl.attr('datetime')
    if (datetime) {
      const parsed = new Date(datetime)
      if (!isNaN(parsed.getTime())) return parsed.toISOString()
    }
  }

  // Try JSON-LD schema.org
  const ldScripts = $('script[type="application/ld+json"]')
  for (let i = 0; i < ldScripts.length; i++) {
    try {
      const json = JSON.parse($(ldScripts[i]).html() ?? '')
      const datePublished = json.datePublished ?? json.dateCreated
      if (datePublished) {
        const parsed = new Date(datePublished)
        if (!isNaN(parsed.getTime())) return parsed.toISOString()
      }
    } catch {
      // Skip invalid JSON-LD
    }
  }

  return new Date().toISOString()
}

function extractImage(html: string, config: CrawlerConfig): string | null {
  const $ = cheerio.load(html)

  if (config.imageSelector) {
    const img = $(config.imageSelector).first()
    const src = img.attr('src') ?? img.attr('data-src')
    if (src) return src
  }

  // Fallback to og:image
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage) return ogImage

  return null
}

function extractWithSelectors(
  html: string,
  config: CrawlerConfig
): { title: string; content: string; description: string | null } | null {
  const $ = cheerio.load(html)

  const title = config.titleSelector
    ? $(config.titleSelector).first().text().trim()
    : $('h1').first().text().trim()

  if (!title) return null

  const content = config.contentSelector
    ? $(config.contentSelector).first().html()?.trim() ?? ''
    : ''

  const description = $('meta[name="description"]').attr('content')?.trim()
    ?? $('meta[property="og:description"]').attr('content')?.trim()
    ?? null

  return { title, content, description }
}

export async function extractArticle(
  url: string,
  config: CrawlerConfig
): Promise<ExtractedArticle> {
  const html = await fetchHtml(url)

  // Try Readability first
  const readabilityResult = extractWithReadability(html, url)

  if (readabilityResult) {
    return {
      title: readabilityResult.title,
      url,
      description: readabilityResult.excerpt,
      content: readabilityResult.content,
      imageUrl: extractImage(html, config),
      publishedAt: extractPublishedAt(html),
    }
  }

  // Fall back to CSS selectors
  const selectorResult = extractWithSelectors(html, config)

  if (selectorResult) {
    return {
      title: selectorResult.title,
      url,
      description: selectorResult.description,
      content: selectorResult.content,
      imageUrl: extractImage(html, config),
      publishedAt: extractPublishedAt(html),
    }
  }

  throw new Error(`Failed to extract article content from ${url}`)
}
