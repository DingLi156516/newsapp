import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { bulkCreateSources } from '@/lib/api/source-admin-queries'
import { csvRowSchema } from '@/lib/api/source-admin-validation'

const importBodySchema = z.object({
  rows: z.array(csvRowSchema).min(1, 'At least one row is required').max(500, 'Maximum 500 rows per import'),
})

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

  const parsed = importBodySchema.safeParse(body)
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
    const result = await bulkCreateSources(supabase, parsed.data.rows)

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
