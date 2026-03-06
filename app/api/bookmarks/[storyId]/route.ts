import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { deleteBookmark } from '@/lib/api/bookmark-queries'
import { bookmarkStoryIdSchema } from '@/lib/api/bookmark-validation'

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

  const parsed = bookmarkStoryIdSchema.safeParse({ storyId })
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map(i => i.message).join('; ') },
      { status: 400 }
    )
  }

  try {
    await deleteBookmark(supabase, user.id, parsed.data.storyId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
