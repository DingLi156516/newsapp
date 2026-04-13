/**
 * app/api/admin/sources/[id]/reactivate/route.ts — Operator-driven source
 * reactivation. Closes Codex review finding #10 (MEDIUM).
 *
 *   POST /api/admin/sources/:id/reactivate
 *
 * Clears the cooldown_until, auto_disabled_at, auto_disabled_reason, and
 * resets consecutive_failures so the source becomes eligible immediately.
 * Mirrors the auth pattern in app/api/admin/dlq/route.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUser } from '@/lib/api/admin-helpers'

const idSchema = z.string().uuid()

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { user, isAdmin, error: authError, supabase } = await getAdminUser()

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

  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid source id (must be a UUID)' },
      { status: 400 }
    )
  }

  try {
    const reactivatedAt = new Date().toISOString()

    // Conditional UPDATE first: `.or()` filter asserts the row is still
    // in an actionable state (auto-disabled OR in active cooldown) so a
    // concurrent cron failure write between our check and our write
    // cannot be silently clobbered. If the row transitioned to healthy
    // between read-of-dashboard and our write, the WHERE matches zero
    // rows and we fall through to the disambiguation read below.
    //
    // The PostgREST `or(...)` syntax accepts `not.is.null` and `gt.<iso>`
    // filter expressions separated by commas; `gt.${reactivatedAt}` uses
    // the route's own "now" so the write is deterministic regardless of
    // clock drift between Postgres and Node.
    const { data: updated, error: updateError } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('sources') as any)
      .update({
        cooldown_until: null,
        auto_disabled_at: null,
        auto_disabled_reason: null,
        consecutive_failures: 0,
        last_fetch_error: null,
        updated_at: reactivatedAt,
      })
      .eq('id', parsedId.data)
      .or(`auto_disabled_at.not.is.null,cooldown_until.gt.${reactivatedAt}`)
      .select('id')
      .maybeSingle()

    if (updateError) {
      throw new Error(updateError.message)
    }

    if (updated) {
      return NextResponse.json({
        success: true,
        data: { id: updated.id, reactivatedAt },
      })
    }

    // UPDATE matched zero rows. Distinguish "source doesn't exist" (404)
    // from "source is already healthy, nothing to do" (200 noop). A
    // small race window still exists here — a fresh failure landing
    // between the UPDATE and this SELECT would show as noop — but the
    // only consequence is the admin sees "already healthy" and can
    // retry; no data is lost.
    const { data: existing, error: lookupError } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('sources') as any)
      .select('id')
      .eq('id', parsedId.data)
      .maybeSingle()

    if (lookupError) {
      throw new Error(lookupError.message)
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Source not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { id: existing.id, reactivatedAt, noop: true },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
