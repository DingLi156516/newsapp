/**
 * app/api/admin/dlq/route.ts — Dead letter queue management.
 *
 *   GET  /api/admin/dlq               List unreplayed entries
 *   POST /api/admin/dlq               Replay or dismiss a specific entry
 *                                     Body: { action: 'replay' | 'dismiss', id }
 *
 * Admin-only. Uses the service-role client from the admin helper.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUser } from '@/lib/api/admin-helpers'
import {
  listUnreplayed,
  replayDeadLetterEntry,
  dismissDeadLetterEntry,
} from '@/lib/pipeline/dead-letter'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

const actionSchema = z.object({
  action: z.enum(['replay', 'dismiss']),
  id: z.string().uuid(),
})

export async function GET() {
  const { user, isAdmin, error: authError } = await getAdminUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const client = getSupabaseServiceClient()
    const entries = await listUnreplayed(client)
    return NextResponse.json({ success: true, data: entries })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, isAdmin, error: authError } = await getAdminUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
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

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { action, id } = parsed.data

  try {
    const client = getSupabaseServiceClient()
    if (action === 'replay') {
      const replayed = await replayDeadLetterEntry(client, id)
      if (!replayed) {
        return NextResponse.json(
          { success: false, error: 'DLQ entry not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, data: { id, replayed: true } })
    }

    await dismissDeadLetterEntry(client, id)
    return NextResponse.json({ success: true, data: { id, dismissed: true } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
