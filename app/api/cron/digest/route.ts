/**
 * POST /api/cron/digest — Weekly blindspot digest email cron.
 *
 * Queries blindspot stories from the past 7 days, finds users who have
 * opted into the digest, and sends each an email via Resend.
 * Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { sendBlindspotDigest } from '@/lib/email/send-digest'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const client = getSupabaseServerClient()

    // Query blindspot stories from the past 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stories, error: storiesError } = await (client.from('stories') as any)
      .select('id, headline, topic, source_count')
      .eq('is_blindspot', true)
      .eq('publication_status', 'published')
      .gte('first_published', sevenDaysAgo)
      .order('first_published', { ascending: false })
      .limit(20)

    if (storiesError) {
      throw new Error(`Failed to query blindspot stories: ${storiesError.message}`)
    }

    if (!stories || stories.length === 0) {
      return NextResponse.json({
        success: true,
        data: { emailsSent: 0, reason: 'No blindspot stories this week' },
      })
    }

    // Query users who opted in to the digest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subscribers, error: subsError } = await (client.from('user_preferences') as any)
      .select('user_id')
      .eq('blindspot_digest_enabled', true)

    if (subsError) {
      throw new Error(`Failed to query subscribers: ${subsError.message}`)
    }

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({
        success: true,
        data: { emailsSent: 0, reason: 'No subscribers' },
      })
    }

    const digestStories = stories.map((s: { id: string; headline: string; topic: string; source_count: number }) => ({
      id: s.id,
      headline: s.headline,
      topic: s.topic,
      sourceCount: s.source_count,
    }))

    let emailsSent = 0
    const errors: string[] = []

    for (const sub of subscribers) {
      // Fetch user email from auth.users via admin API
      const { data: userData, error: userError } = await client.auth.admin.getUserById(
        sub.user_id
      )

      if (userError || !userData?.user?.email) {
        errors.push(`Could not fetch email for user ${sub.user_id}`)
        continue
      }

      const result = await sendBlindspotDigest(
        userData.user.email,
        userData.user.user_metadata?.name ?? 'Reader',
        digestStories
      )

      if (result.success) {
        emailsSent++
      } else {
        errors.push(`Failed to send to ${sub.user_id}: ${result.error}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: { emailsSent, totalSubscribers: subscribers.length, errors },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
