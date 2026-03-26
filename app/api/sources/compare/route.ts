import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryRecentStoriesForSource, querySourceBySlug } from '@/lib/api/query-helpers'
import { transformSource } from '@/lib/api/transformers'
import { buildSourceProfile } from '@/lib/source-profiles'
import { buildSourceComparison } from '@/lib/source-comparison'
import type { SourceProfileSource } from '@/lib/types'
import type { DbSource } from '@/lib/supabase/types'

const RECENT_COVERAGE_WINDOW_DAYS = 30

function getRecentCoverageThreshold(): string {
  return new Date(Date.now() - RECENT_COVERAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

function toProfileSource(source: DbSource & { is_active: boolean; rss_url: string | null }): SourceProfileSource {
  const transformedSource = transformSource(source)

  return {
    ...transformedSource,
    slug: transformedSource.slug ?? source.slug,
    isActive: source.is_active,
    ...(source.rss_url ? { rssUrl: source.rss_url } : {}),
  }
}

export async function GET(request: NextRequest) {
  const leftSlug = request.nextUrl.searchParams.get('left')
  const rightSlug = request.nextUrl.searchParams.get('right')

  if (!leftSlug || !rightSlug) {
    return NextResponse.json(
      { success: false, error: 'Both left and right source slugs are required' },
      { status: 400 }
    )
  }

  try {
    const client = getSupabaseServerClient()
    const [leftSource, rightSource] = await Promise.all([
      querySourceBySlug(client, leftSlug),
      querySourceBySlug(client, rightSlug),
    ])

    if (!leftSource || !rightSource) {
      return NextResponse.json(
        { success: false, error: 'One or both sources were not found' },
        { status: 404 }
      )
    }

    const sinceIso = getRecentCoverageThreshold()
    const [leftStories, rightStories] = await Promise.all([
      queryRecentStoriesForSource(client, leftSource.id, sinceIso),
      queryRecentStoriesForSource(client, rightSource.id, sinceIso),
    ])

    const comparison = buildSourceComparison(
      buildSourceProfile(toProfileSource(leftSource as DbSource & { is_active: boolean; rss_url: string | null }), leftStories),
      buildSourceProfile(toProfileSource(rightSource as DbSource & { is_active: boolean; rss_url: string | null }), rightStories)
    )

    return NextResponse.json({
      success: true,
      data: comparison,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
