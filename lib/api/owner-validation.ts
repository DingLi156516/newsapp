/**
 * lib/api/owner-validation.ts — Zod schemas for media owner API queries.
 */

import { z } from 'zod'

const OWNER_TYPES = [
  'public_company', 'private_company', 'cooperative',
  'public_broadcaster', 'trust', 'individual',
  'state_adjacent', 'nonprofit',
] as const

export const ownersQuerySchema = z.object({
  search: z.string().max(200).optional(),
  owner_type: z.enum(OWNER_TYPES).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export type OwnersQuery = z.infer<typeof ownersQuerySchema>
