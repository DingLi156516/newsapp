import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryRecentStoriesForSource, querySourceBySlug } from '@/lib/api/query-helpers'
import { transformSource } from '@/lib/api/transformers'
import { buildSourceProfile } from '@/lib/source-profiles'
import type { SourceProfileSource } from '@/lib/types'
import type { DbSource } from '@/lib/supabase/types'

const RECENT_COVERAGE_WINDOW_DAYS = 30

function getRecentCoverageThreshold(): string {
  return new Date(Date.now() - RECENT_COVERAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  if (!slug || typeof slug !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing source slug' },
      { status: 400 }
    )
  }

  try {
    const client = getSupabaseServerClient()
    const source = await querySourceBySlug(client, slug)

    if (!source) {
      return NextResponse.json(
        { success: false, error: 'Source not found' },
        { status: 404 }
      )
    }

    const recentStories = await queryRecentStoriesForSource(
      client,
      source.id,
      getRecentCoverageThreshold()
    )

    const transformedSource = transformSource(source as DbSource) as SourceProfileSource
    const profile = buildSourceProfile(
      {
        ...transformedSource,
        slug: transformedSource.slug,
        isActive: source.is_active,
        ...(source.rss_url ? { rssUrl: source.rss_url } : {}),
      },
      recentStories
    )

    return NextResponse.json({
      success: true,
      data: profile,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
