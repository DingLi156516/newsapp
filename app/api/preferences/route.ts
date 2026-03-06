/**
 * app/api/preferences/route.ts — User preferences API.
 *
 * GET  /api/preferences  — Fetch current user's preferences (auto-creates defaults)
 * PATCH /api/preferences — Update one or more preference fields
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { queryPreferences, updatePreferences } from '@/lib/api/preferences-queries'
import { preferencesUpdateSchema } from '@/lib/api/preferences-validation'

export async function GET() {
  const { user, error: authError, supabase } = await getAuthenticatedUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const preferences = await queryPreferences(supabase, user.id)
    return NextResponse.json({ success: true, data: preferences })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error: authError, supabase } = await getAuthenticatedUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const parsed = preferencesUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map(i => i.message).join('; ') },
        { status: 400 }
      )
    }

    // Ensure row exists first
    await queryPreferences(supabase, user.id)
    const updated = await updatePreferences(supabase, user.id, parsed.data)
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
