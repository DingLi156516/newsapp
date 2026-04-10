/**
 * lib/news-api/validation.ts — Zod schema for NewsApiConfig.
 */

import { z } from 'zod'

export const newsApiConfigSchema = z.object({
  provider: z.enum(['newsapi', 'gdelt']),
  query: z.string().max(500).optional(),
  language: z.string().max(10).optional().default('en'),
  category: z.string().max(50).optional(),
  country: z.string().max(10).optional(),
  maxResults: z.number().int().min(1).max(100).optional().default(30),
})

export type NewsApiConfigInput = z.infer<typeof newsApiConfigSchema>
