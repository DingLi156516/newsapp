import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { queryReviewStats } from '@/lib/api/review-queries'

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
    const stats = await queryReviewStats(supabase)
    return NextResponse.json({ success: true, data: stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
