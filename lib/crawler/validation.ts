/**
 * lib/crawler/validation.ts — Zod schema for CrawlerConfig.
 */

import { z } from 'zod'
import { validatePublicUrl } from '@/lib/rss/discover'

function isPublicCrawlerUrl(val: string): boolean {
  try {
    validatePublicUrl(val)
    return true
  } catch {
    return false
  }
}

export const crawlerConfigSchema = z.object({
  articleListUrl: z
    .string()
    .url('articleListUrl must be a valid URL')
    .refine(isPublicCrawlerUrl, {
      message: 'articleListUrl must not target a private or reserved network address',
    }),
  articleLinkSelector: z.string().min(1, 'articleLinkSelector is required').max(500),
  contentSelector: z.string().max(500).optional(),
  titleSelector: z.string().max(500).optional(),
  imageSelector: z.string().max(500).optional(),
  jsRender: z.boolean().optional().default(false),
  maxArticles: z.number().int().min(1).max(100).optional().default(30),
})

export type CrawlerConfigInput = z.infer<typeof crawlerConfigSchema>
