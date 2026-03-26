import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { countPipelineBacklog } from '@/lib/pipeline/backlog'

export async function GET() {
  const { user, isAdmin, error: authError, supabase } = await getAdminUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const [backlog, publishedResult, totalArticlesResult] = await Promise.all([
      countPipelineBacklog(supabase),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('stories') as any).select('id', { count: 'exact' }).eq('publication_status', 'published'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('articles') as any).select('id', { count: 'exact' }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        publishedStories: publishedResult.count ?? 0,
        totalArticles: totalArticlesResult.count ?? 0,
        reviewQueue: backlog.reviewQueueStories,
        unembedded: backlog.unembeddedArticles,
        unclustered: backlog.unclusteredArticles,
        expiredArticles: backlog.expiredArticles,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
