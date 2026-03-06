/**
 * lib/api/review-validation.ts — Zod schemas for admin review actions.
 *
 * Validates review queue queries and approve/reject/reprocess actions.
 */

import { z } from 'zod'

const REVIEW_ACTIONS = ['approve', 'reject', 'reprocess'] as const
const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const

export const reviewActionSchema = z.object({
  action: z.enum(REVIEW_ACTIONS),
  headline: z.string().min(1).max(500).optional(),
  ai_summary: z.object({
    commonGround: z.string().min(1),
    leftFraming: z.string().min(1),
    rightFraming: z.string().min(1),
  }).optional(),
})

export type ReviewAction = z.infer<typeof reviewActionSchema>

export const reviewQueueQuerySchema = z.object({
  status: z.enum(REVIEW_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

export type ReviewQueueQuery = z.infer<typeof reviewQueueQuerySchema>
