/**
 * lib/api/validation.ts — Zod schemas for API query parameter validation.
 *
 * Each schema parses and coerces URL search params into typed filter objects.
 * Invalid values fall back to safe defaults rather than throwing errors.
 */

import { z } from 'zod'

const TOPICS = [
  'politics', 'world', 'technology', 'business',
  'science', 'health', 'culture', 'sports', 'environment',
] as const

const REGIONS = ['us', 'international', 'uk', 'canada', 'europe'] as const

const BIASES = [
  'far-left', 'left', 'lean-left', 'center',
  'lean-right', 'right', 'far-right',
] as const

const FACTUALITIES = ['very-high', 'high', 'mixed', 'low', 'very-low'] as const

const OWNERSHIPS = [
  'independent', 'corporate', 'private-equity',
  'state-funded', 'telecom', 'government', 'non-profit', 'other',
] as const

const DATE_PRESETS = ['24h', '7d', '30d', 'all'] as const

export const TAG_TYPES = ['person', 'organization', 'location', 'event', 'topic'] as const

const SORT_FIELDS = ['last_updated', 'source_count'] as const

export const storiesQuerySchema = z.object({
  topic: z.enum(TOPICS).optional(),
  region: z.enum(REGIONS).optional(),
  search: z.string().max(200).regex(/^[\w\s\-'".,!?]*$/u, 'Invalid search characters').optional(),
  blindspot: z.enum(['true', 'false']).optional(),
  biasRange: z.string().max(200).optional().refine(
    (v) => v === undefined || v.split(',').every(b => BIASES.includes(b as typeof BIASES[number])),
    { message: 'biasRange contains invalid bias values' }
  ),
  minFactuality: z.enum(FACTUALITIES).optional(),
  datePreset: z.enum(DATE_PRESETS).optional(),
  sort: z.enum(SORT_FIELDS).optional(),
  tag: z.string().max(100).optional(),
  tag_type: z.enum(TAG_TYPES).optional(),
  ids: z.string().max(2000).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
}).refine(
  (data) => !data.tag_type || !!data.tag,
  { message: 'tag_type requires tag to be specified', path: ['tag_type'] }
)

export type StoriesQuery = z.infer<typeof storiesQuerySchema>

export const sourcesQuerySchema = z.object({
  bias: z.enum(BIASES).optional(),
  factuality: z.enum(FACTUALITIES).optional(),
  ownership: z.enum(OWNERSHIPS).optional(),
  region: z.enum(REGIONS).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

export type SourcesQuery = z.infer<typeof sourcesQuerySchema>

export const forYouQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

export type ForYouQuery = z.infer<typeof forYouQuerySchema>

export const tagsQuerySchema = z.object({
  type: z.enum(TAG_TYPES).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

export type TagsQuery = z.infer<typeof tagsQuerySchema>

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)

export const promotedTagsQuerySchema = z.object({
  threshold: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).optional()),
})

export type PromotedTagsQuery = z.infer<typeof promotedTagsQuerySchema>

export function parseSearchParams(
  searchParams: URLSearchParams,
  schema: z.ZodType
): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
  const raw: Record<string, string> = {}
  for (const [key, value] of searchParams.entries()) {
    raw[key] = value
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    )
    return { success: false, error: messages.join('; ') }
  }

  return { success: true, data: result.data as Record<string, unknown> }
}
