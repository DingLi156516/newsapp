import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { queryAdminSources, createSource } from '@/lib/api/source-admin-queries'
import {
  adminSourcesQuerySchema,
  createSourceSchema,
  type AdminSourcesQuery,
} from '@/lib/api/source-admin-validation'
import { parseSearchParams } from '@/lib/api/validation'

export async function GET(request: NextRequest) {
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

  const parsed = parseSearchParams(
    request.nextUrl.searchParams,
    adminSourcesQuerySchema
  )

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error },
      { status: 400 }
    )
  }

  const params = parsed.data as unknown as AdminSourcesQuery

  try {
    const { data, count } = await queryAdminSources(supabase, params)

    return NextResponse.json({
      success: true,
      data,
      meta: { total: count, page: params.page, limit: params.limit },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  const parsed = createSourceSchema.safeParse(body)
  if (!parsed.success) {
    const messages = parsed.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    )
    return NextResponse.json(
      { success: false, error: messages.join('; ') },
      { status: 400 }
    )
  }

  try {
    const source = await createSource(supabase, parsed.data)

    return NextResponse.json({ success: true, data: source }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    const status = message.includes('already exists') ? 409 : 500
    return NextResponse.json(
      { success: false, error: message },
      { status }
    )
  }
}
