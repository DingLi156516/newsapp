/**
 * Zod schemas for API query parameter validation.
 * Copied from web app lib/api/validation.ts.
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

const DATE_PRESETS = ['24h', '7d', '30d', 'all'] as const

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
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

export type StoriesQuery = z.infer<typeof storiesQuerySchema>

export const forYouQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

export type ForYouQuery = z.infer<typeof forYouQuerySchema>
