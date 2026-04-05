import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/admin-helpers'
import { discoverRssSchema } from '@/lib/api/source-admin-validation'
import { validatePublicUrl, discoverRssFeeds } from '@/lib/rss/discover'

export async function POST(request: NextRequest) {
  const { user, isAdmin, error: authError } = await getAdminUser()

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

  const parsed = discoverRssSchema.safeParse(body)
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
    validatePublicUrl(parsed.data.url)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid URL'
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }

  try {
    const feeds = await discoverRssFeeds(parsed.data.url)

    return NextResponse.json({ success: true, data: feeds })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Discovery failed'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
