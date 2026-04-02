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

function getIngestRate(summary: Record<string, unknown>): number | null {
  const nestedIngest = summary.ingest
  if (
    nestedIngest
    && typeof nestedIngest === 'object'
    && typeof (nestedIngest as Record<string, unknown>).ingestedPerMinute === 'number'
  ) {
    return (nestedIngest as Record<string, unknown>).ingestedPerMinute as number
  }

  const topLevel = summary.ingestedPerMinute
  return typeof topLevel === 'number' ? topLevel : null
}

function getStageProcessedRate(summary: Record<string, unknown>, stage: string): number | null {
  const value = summary[stage]
  if (!value || typeof value !== 'object') {
    return null
  }

  const processedPerMinute = (value as Record<string, unknown>).processedPerMinute
  return typeof processedPerMinute === 'number' ? processedPerMinute : null
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
      countPipelineBacklog(supabase, { includeAges: true }),
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
            (summary) => getIngestRate(summary)
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
            (summary) => getStageProcessedRate(summary, 'embeddings')
          ),
          clustering: getRecentRate(
            runs,
            (run) => run.run_type === 'process' || run.run_type === 'full',
            (summary) => getStageProcessedRate(summary, 'clustering')
          ),
          assembly: getRecentRate(
            runs,
            (run) => run.run_type === 'process' || run.run_type === 'full',
            (summary) => getStageProcessedRate(summary, 'assembly')
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
