/**
 * GET /api/owners/[id] — Single owner detail with associated sources.
 *
 * Returns owner metadata and array of sources linked to this owner.
 * Public — no auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { queryOwnerById } from '@/lib/api/owner-queries'
import { transformOwner } from '@/lib/api/transformers'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing owner ID' },
      { status: 400 }
    )
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { success: false, error: 'Invalid owner ID format' },
      { status: 400 }
    )
  }

  try {
    const client = getSupabaseServerClient()
    const result = await queryOwnerById(client, id)

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      )
    }

    const sources = result.sources.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      bias: s.bias,
      factuality: s.factuality,
      ownership: s.ownership,
      url: s.url,
      region: s.region,
    }))

    return NextResponse.json({
      success: true,
      data: {
        owner: transformOwner(result.owner),
        sources,
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
