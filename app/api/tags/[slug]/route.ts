/**
 * GET /api/tags/[slug] — Single tag detail with related tags.
 *
 * Returns the tag and its related tags (computed from co-occurrence).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryTagBySlug, queryRelatedTags } from '@/lib/api/query-helpers'
import { transformTag } from '@/lib/api/transformers'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  if (!slug || typeof slug !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing tag slug' },
      { status: 400 }
    )
  }

  const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/
  if (slug.length < 1 || slug.length > 100 || (!SLUG_RE.test(slug) && slug.length > 1)) {
    return NextResponse.json(
      { success: false, error: 'Invalid tag slug format' },
      { status: 400 }
    )
  }

  const typeParam = _request.nextUrl.searchParams.get('type')
  if (typeParam !== null && !['person', 'organization', 'location', 'event', 'topic'].includes(typeParam)) {
    return NextResponse.json(
      { success: false, error: 'Invalid tag type' },
      { status: 400 }
    )
  }

  try {
    const client = getSupabaseServerClient()
    const rows = await queryTagBySlug(client, slug, typeParam ?? undefined)

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tag not found' },
        { status: 404 }
      )
    }

    if (rows.length === 1) {
      const tag = rows[0]
      const relatedTags = await queryRelatedTags(client, tag.id)

      return NextResponse.json({
        success: true,
        data: {
          tag: transformTag(tag),
          relatedTags: relatedTags.map(transformTag),
        },
      })
    }

    // Ambiguous slug — return all variants for disambiguation
    return NextResponse.json({
      success: true,
      data: {
        tags: rows.map(transformTag),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
