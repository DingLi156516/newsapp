/**
 * lib/api/source-admin-validation.ts — Zod schemas for admin source management.
 *
 * Validates create/update source requests, CSV import rows,
 * RSS discovery input, and admin sources query parameters.
 */

import { z } from 'zod'
import { validatePublicUrl } from '@/lib/rss/discover'

function isPublicUrl(val: string | null | undefined): boolean {
  if (!val) return true
  try { validatePublicUrl(val); return true } catch { return false }
}

const publicUrlCheck = { message: 'URL must not target a private or reserved network address' }

const BIASES = [
  'far-left', 'left', 'lean-left', 'center',
  'lean-right', 'right', 'far-right',
] as const

const FACTUALITIES = ['very-high', 'high', 'mixed', 'low', 'very-low'] as const

const OWNERSHIPS = [
  'independent', 'corporate', 'private-equity',
  'state-funded', 'telecom', 'government', 'non-profit', 'other',
] as const

const REGIONS = ['us', 'international', 'uk', 'canada', 'europe'] as const

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)

export const createSourceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  url: z.string().url('Invalid URL').max(500).optional().nullable(),
  rss_url: z.string().url('Invalid RSS URL').max(500).optional().nullable(),
  bias: z.enum(BIASES),
  factuality: z.enum(FACTUALITIES),
  ownership: z.enum(OWNERSHIPS),
  region: z.enum(REGIONS).optional().default('us'),
  slug: z.string().max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
}).refine((d) => isPublicUrl(d.url), { ...publicUrlCheck, path: ['url'] })
  .refine((d) => isPublicUrl(d.rss_url), { ...publicUrlCheck, path: ['rss_url'] })

export type CreateSourceInput = z.infer<typeof createSourceSchema>

export const updateSourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.string().url('Invalid URL').max(500).optional().nullable(),
  rss_url: z.string().url('Invalid RSS URL').max(500).optional().nullable(),
  bias: z.enum(BIASES).optional(),
  factuality: z.enum(FACTUALITIES).optional(),
  ownership: z.enum(OWNERSHIPS).optional(),
  region: z.enum(REGIONS).optional(),
  is_active: z.boolean().optional(),
  slug: z.string().max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
}).refine((d) => isPublicUrl(d.url), { ...publicUrlCheck, path: ['url'] })
  .refine((d) => isPublicUrl(d.rss_url), { ...publicUrlCheck, path: ['rss_url'] })

export type UpdateSourceInput = z.infer<typeof updateSourceSchema>

export const csvRowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  url: z.preprocess(emptyToUndefined, z.string().url('Invalid URL').max(500).optional()),
  rss_url: z.preprocess(emptyToUndefined, z.string().url('Invalid RSS URL').max(500).optional()),
  bias: z.enum(BIASES),
  factuality: z.enum(FACTUALITIES),
  ownership: z.enum(OWNERSHIPS),
  region: z.enum(REGIONS).optional().default('us'),
  slug: z.preprocess(emptyToUndefined, z.string().max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional()),
}).refine((d) => isPublicUrl(d.url), { ...publicUrlCheck, path: ['url'] })
  .refine((d) => isPublicUrl(d.rss_url), { ...publicUrlCheck, path: ['rss_url'] })

export type CsvRowInput = z.infer<typeof csvRowSchema>

export const discoverRssSchema = z.object({
  url: z.string().url('A valid URL is required'),
})

export type DiscoverRssInput = z.infer<typeof discoverRssSchema>

export const adminSourcesQuerySchema = z.object({
  search: z.string().max(200).regex(/^[\w\s\-'"!?]*$/u, 'Invalid search characters').optional(),
  bias: z.preprocess(emptyToUndefined, z.enum(BIASES).optional()),
  region: z.preprocess(emptyToUndefined, z.enum(REGIONS).optional()),
  is_active: z.preprocess(emptyToUndefined, z.enum(['all', 'true', 'false']).optional().default('all')),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export type AdminSourcesQuery = z.infer<typeof adminSourcesQuerySchema>
