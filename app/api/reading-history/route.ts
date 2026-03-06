/**
 * GET /api/reading-history — Returns IDs of stories the user has read.
 *
 * Returns: { success: true, data: string[] }
 */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { queryReadStoryIds } from '@/lib/api/reading-history-queries'

export async function GET() {
  const { user, error: authError, supabase } = await getAuthenticatedUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const storyIds = await queryReadStoryIds(supabase, user.id)
    return NextResponse.json({ success: true, data: storyIds })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
