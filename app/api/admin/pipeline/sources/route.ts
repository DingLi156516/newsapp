/**
 * app/api/admin/pipeline/sources/route.ts — Source health endpoint.
 *
 * Returns all sources with health columns.
 * Auth: admin only.
 */

import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/admin-helpers'

export async function GET() {
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

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('sources') as any)
      .select(
        'id, slug, name, bias, region, source_type, is_active, last_fetch_at, last_fetch_status, last_fetch_error, consecutive_failures, total_articles_ingested, cooldown_until, auto_disabled_at, auto_disabled_reason'
      )
      .order('consecutive_failures', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch source health: ${error.message}`)
    }

    const now = Date.now()
    return NextResponse.json({
      success: true,
      data: (data ?? []).map((source: {
        consecutive_failures: number
        last_fetch_status: string
        cooldown_until: string | null
        auto_disabled_at: string | null
      }) => {
        // Only treat cooldown as attention-worthy when it is still active.
        // `increment_source_success` does not clear `cooldown_until` (the
        // in-memory eligibility filter treats a past cooldown as eligible),
        // so a healthy source can keep a stale past timestamp indefinitely.
        const cooldownActive =
          source.cooldown_until !== null &&
          new Date(source.cooldown_until).getTime() > now
        return {
          ...source,
          needs_attention:
            source.consecutive_failures >= 3 ||
            source.auto_disabled_at !== null ||
            cooldownActive ||
            (source.last_fetch_status !== 'success' && source.last_fetch_status !== 'unknown'),
        }
      }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
