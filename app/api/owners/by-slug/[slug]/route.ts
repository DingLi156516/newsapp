/**
 * GET /api/owners/by-slug/[slug] — Owner profile keyed by slug.
 *
 * Returns the full OwnerProfile shape: owner metadata + sources controlled
 * by this owner + recent stories in the 180-day window + coverage rollups.
 * Public — no auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryOwnerBySlug, queryRecentStoriesForOwner } from '@/lib/api/owner-queries'
import { transformOwner } from '@/lib/api/transformers'
import { buildOwnerProfile } from '@/lib/owner-profiles'
import { getSourceSlug } from '@/lib/source-slugs'
import type {
  BiasCategory,
  FactualityLevel,
  NewsSource,
  OwnershipType,
  Region,
} from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  if (!slug || typeof slug !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing owner slug' },
      { status: 400 }
    )
  }

  try {
    const client = getSupabaseServerClient()
    const result = await queryOwnerBySlug(client, slug)

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      )
    }

    const ownerTransformed = transformOwner(result.owner)
    // getSourceSlug falls back to a name-derived slug when the row's `slug`
    // column is blank (older source rows from before migration 023 lacked a
    // persisted slug) — without this, /sources/<empty> links would render.
    const sources: NewsSource[] = result.sources.map((s) => ({
      id: s.id,
      slug: getSourceSlug(s),
      name: s.name,
      bias: s.bias as BiasCategory,
      factuality: s.factuality as FactualityLevel,
      ownership: s.ownership as OwnershipType,
      region: s.region as Region,
      ...(s.url ? { url: s.url } : {}),
      owner: ownerTransformed,
    }))

    const recentStories = await queryRecentStoriesForOwner(client, result.owner.id)
    const profile = buildOwnerProfile(ownerTransformed, sources, recentStories)

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
