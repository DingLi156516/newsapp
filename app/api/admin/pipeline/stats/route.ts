import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { countPipelineBacklog } from '@/lib/pipeline/backlog'

function getRecentRate(
  runs: Array<Record<string, unknown>>,
  predicate: (run: Record<string, unknown>) => boolean,
  pick: (summary: Record<string, unknown>) => number | null
): number | null {
  for (const run of runs) {
    if (!predicate(run)) {
      continue
    }

    const summary = run.summary
    if (!summary || typeof summary !== 'object') {
      continue
    }

    const value = pick(summary as Record<string, unknown>)
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return null
}

export async function GET() {
  const { user, isAdmin, error: authError, supabase } = await getAdminUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const [backlog, publishedResult, totalArticlesResult, runHistoryResult] = await Promise.all([
      countPipelineBacklog(supabase),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('stories') as any).select('id', { count: 'exact' }).eq('publication_status', 'published'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('articles') as any).select('id', { count: 'exact' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('pipeline_runs') as any)
        .select('run_type, summary, started_at')
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(20),
    ])

    const runs = (runHistoryResult.data ?? []) as Array<Record<string, unknown>>

    return NextResponse.json({
      success: true,
      data: {
        publishedStories: publishedResult.count ?? 0,
        totalArticles: totalArticlesResult.count ?? 0,
        reviewQueue: backlog.reviewQueueStories,
        unembedded: backlog.unembeddedArticles,
        unclustered: backlog.unclusteredArticles,
        expiredArticles: backlog.expiredArticles,
        backlogAgesMinutes: backlog.oldestAgeMinutes ?? null,
        ratesPerMinute: {
          ingest: getRecentRate(
            runs,
            (run) => run.run_type === 'ingest' || run.run_type === 'full',
            (summary) => {
              const ingest = summary.ingest
              return ingest && typeof ingest === 'object' && typeof (ingest as Record<string, unknown>).ingestedPerMinute === 'number'
                ? (ingest as Record<string, unknown>).ingestedPerMinute as number
                : null
            }
          ),
          process: getRecentRate(
            runs,
            (run) => run.run_type === 'process' || run.run_type === 'full',
            (summary) => {
              if (typeof summary.telemetry !== 'object' || !summary.telemetry) {
                return null
              }
              const value = (summary.telemetry as Record<string, unknown>).processedPerMinute
              return typeof value === 'number' ? value : null
            }
          ),
          embeddings: getRecentRate(
            runs,
            (run) => run.run_type === 'process' || run.run_type === 'full',
            (summary) => {
              if (typeof summary.embeddings !== 'object' || !summary.embeddings) {
                return null
              }
              const value = (summary.embeddings as Record<string, unknown>).processedPerMinute
              return typeof value === 'number' ? value : null
            }
          ),
          clustering: getRecentRate(
            runs,
            (run) => run.run_type === 'process' || run.run_type === 'full',
            (summary) => {
              if (typeof summary.clustering !== 'object' || !summary.clustering) {
                return null
              }
              const value = (summary.clustering as Record<string, unknown>).processedPerMinute
              return typeof value === 'number' ? value : null
            }
          ),
          assembly: getRecentRate(
            runs,
            (run) => run.run_type === 'process' || run.run_type === 'full',
            (summary) => {
              if (typeof summary.assembly !== 'object' || !summary.assembly) {
                return null
              }
              const value = (summary.assembly as Record<string, unknown>).processedPerMinute
              return typeof value === 'number' ? value : null
            }
          ),
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
