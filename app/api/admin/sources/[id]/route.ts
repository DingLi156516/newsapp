import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { updateSource } from '@/lib/api/source-admin-queries'
import { updateSourceSchema } from '@/lib/api/source-admin-validation'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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

  const parsed = updateSourceSchema.safeParse(body)
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
    const source = await updateSource(supabase, id, parsed.data)

    return NextResponse.json({ success: true, data: source })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    const status = message.includes('not found')
      ? 404
      : message.includes('already exists') || message.includes('does not exist')
        ? 409
        : message.includes('No fields')
          ? 400
          : 500
    return NextResponse.json(
      { success: false, error: message },
      { status }
    )
  }
}
