import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/admin-helpers'
import {
  chooseAssemblyPath,
  countBiasBuckets,
} from '@/lib/ai/assembly-routing'
import type { BiasCategory } from '@/lib/types'

const DEFAULT_MIN_SOURCES = 3
const DEFAULT_MIN_BUCKETS = 2

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}

function modeOverride(): 'deterministic' | 'gemini' | null {
  const mode = process.env.PIPELINE_ASSEMBLY_MODE
  if (mode === 'deterministic' || mode === 'gemini') return mode
  return null
}

/**
 * GET /api/admin/review/[id]/routing-preview
 *
 * Read-only preview of which assembly path the pipeline would choose
 * for a given story given its current articles + source biases and the
 * active routing thresholds. Exposed only to admins so operators can
 * understand whether a stuck story routes to rich / single / thin
 * before deciding between approve-as-is and manual edit.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: storyId } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const articlesRes = await (supabase.from('articles') as any)
    .select('source_id')
    .eq('story_id', storyId)

  if (articlesRes.error) {
    return NextResponse.json(
      { success: false, error: `Failed to fetch articles: ${articlesRes.error.message}` },
      { status: 500 }
    )
  }

  const articles = (articlesRes.data ?? []) as Array<{ source_id: string }>
  if (articles.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Story has no articles' },
      { status: 404 }
    )
  }

  const sourceIds = [...new Set(articles.map((a) => a.source_id))]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourcesRes = await (supabase.from('sources') as any)
    .select('id, bias')
    .in('id', sourceIds)

  if (sourcesRes.error) {
    return NextResponse.json(
      { success: false, error: `Failed to fetch sources: ${sourcesRes.error.message}` },
      { status: 500 }
    )
  }

  const sourceRows = (sourcesRes.data ?? []) as Array<{ id: string; bias: BiasCategory }>
  const biasById = new Map(sourceRows.map((s) => [s.id, s.bias]))
  const biases = articles
    .map((a) => biasById.get(a.source_id))
    .filter((bias): bias is BiasCategory => bias !== undefined)

  const assemblyPath = chooseAssemblyPath({
    sourceCount: sourceIds.length,
    biases,
  })

  const appliedThresholds = {
    minSources: parsePositiveInt(
      process.env.PIPELINE_RICH_CLUSTER_MIN_SOURCES,
      DEFAULT_MIN_SOURCES
    ),
    minBuckets: parsePositiveInt(
      process.env.PIPELINE_RICH_CLUSTER_MIN_BUCKETS,
      DEFAULT_MIN_BUCKETS
    ),
    modeOverride: modeOverride(),
  }

  return NextResponse.json({
    success: true,
    data: {
      storyId,
      sourceCount: sourceIds.length,
      biases,
      distinctBiasBuckets: countBiasBuckets(biases),
      assemblyPath,
      appliedThresholds,
    },
  })
}
