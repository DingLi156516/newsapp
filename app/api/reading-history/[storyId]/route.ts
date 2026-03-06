/**
 * POST /api/reading-history/:storyId — Mark a story as read.
 * DELETE /api/reading-history/:storyId — Mark a story as unread.
 */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { upsertReadingHistory, markAsUnread } from '@/lib/api/reading-history-queries'
import { z } from 'zod'

const storyIdSchema = z.string().uuid('Invalid story ID')

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { user, error: authError, supabase } = await getAuthenticatedUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { storyId } = await params
  const parsed = storyIdSchema.safeParse(storyId)

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid story ID' },
      { status: 400 }
    )
  }

  try {
    await upsertReadingHistory(supabase, user.id, parsed.data)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { user, error: authError, supabase } = await getAuthenticatedUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { storyId } = await params
  const parsed = storyIdSchema.safeParse(storyId)

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid story ID' },
      { status: 400 }
    )
  }

  try {
    await markAsUnread(supabase, user.id, parsed.data)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
