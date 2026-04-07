import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { syncProviderRatings } from '@/lib/api/bias-sync-queries'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST() {
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

  try {
    const serviceClient = getSupabaseServiceClient()
    const result = await syncProviderRatings(serviceClient)
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
