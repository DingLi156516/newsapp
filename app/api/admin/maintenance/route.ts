/**
 * app/api/admin/maintenance/route.ts — Operator-facing maintenance
 * dispatcher. Admin-only. Closes Codex review finding #11 (MEDIUM).
 *
 *   POST /api/admin/maintenance
 *   body: { action: 'purge_unembedded_articles' | 'purge_orphan_stories'
 *                 | 'purge_expired_articles',
 *           dryRun: boolean,
 *           olderThanDays?: number }
 *
 * Response: { success, data: { action, dryRun, deletedCount, sampleIds, auditId } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import {
  purgeUnembeddedArticles,
  purgeOrphanStories,
  purgeExpiredArticles,
  type PurgeOptions,
  type PurgeResult,
} from '@/lib/admin/pipeline-maintenance'

const requestSchema = z.object({
  action: z.enum([
    'purge_unembedded_articles',
    'purge_orphan_stories',
    'purge_expired_articles',
  ]),
  dryRun: z.boolean(),
  olderThanDays: z.number().int().positive().max(365).optional(),
})

export async function POST(request: NextRequest) {
  // Admin auth check uses the user-scoped client. Once auth clears,
  // we switch to a service-role client for the mutation because both
  // `pipeline_maintenance_audit` and the purge RPCs are service-role
  // only by RLS.
  const { user, isAdmin, error: authError } = await getAdminUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const options: PurgeOptions = {
    dryRun: parsed.data.dryRun,
    olderThanDays: parsed.data.olderThanDays,
    triggeredBy: user.id,
  }

  try {
    const serviceClient = getSupabaseServiceClient()
    let result: PurgeResult
    switch (parsed.data.action) {
      case 'purge_unembedded_articles':
        result = await purgeUnembeddedArticles(serviceClient, options)
        break
      case 'purge_orphan_stories':
        result = await purgeOrphanStories(serviceClient, options)
        break
      case 'purge_expired_articles':
        result = await purgeExpiredArticles(serviceClient, options)
        break
    }

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
