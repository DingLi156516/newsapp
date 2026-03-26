/**
 * Zod schema for user preferences updates.
 * Copied from web app lib/api/preferences-validation.ts.
 */
import { z } from 'zod'

const TOPICS = [
  'politics', 'world', 'technology', 'business',
  'science', 'health', 'culture', 'sports', 'environment',
] as const

const PERSPECTIVES = ['all', 'left', 'center', 'right'] as const
const FACTUALITIES = ['very-high', 'high', 'mixed', 'low', 'very-low'] as const

export const preferencesUpdateSchema = z.object({
  followed_topics: z.array(z.enum(TOPICS)).optional(),
  default_perspective: z.enum(PERSPECTIVES).optional(),
  factuality_minimum: z.enum(FACTUALITIES).optional(),
  blindspot_digest_enabled: z.boolean().optional(),
})

export type PreferencesUpdate = z.infer<typeof preferencesUpdateSchema>
