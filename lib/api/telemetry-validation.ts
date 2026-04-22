/**
 * lib/api/telemetry-validation.ts — Zod schemas for engagement telemetry.
 *
 * Mirrors the bounded enums in migration 053. We validate at the route
 * layer so a malformed event from a stale client never reaches the DB
 * (where it would either fail the CHECK constraint or — worse — slip
 * through if a constraint were ever relaxed).
 */

import { z } from 'zod'

export const STORY_VIEW_ACTIONS = ['view', 'dwell', 'read_through', 'share'] as const
export const STORY_VIEW_REFERRER_KINDS = ['feed', 'for_you', 'search', 'direct', 'external'] as const
export const STORY_VIEW_CLIENTS = ['web', 'mobile'] as const

export const storyViewEventSchema = z
  .object({
    storyId: z.string().uuid('Invalid story ID'),
    action: z.enum(STORY_VIEW_ACTIONS),
    dwellBucket: z.number().int().min(0).max(3).optional(),
    referrerKind: z.enum(STORY_VIEW_REFERRER_KINDS).optional(),
    client: z.enum(STORY_VIEW_CLIENTS),
  })
  .refine(
    (event) => event.action !== 'dwell' || typeof event.dwellBucket === 'number',
    { message: 'dwellBucket required when action=dwell', path: ['dwellBucket'] }
  )

export type StoryViewEvent = z.infer<typeof storyViewEventSchema>
