/**
 * GET /api/topics/momentum — Topic momentum over rolling time windows.
 *
 * Returns story counts per topic for 24h, 7d, and 30d windows with trend direction.
 */

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { Topic } from '@/lib/types'

interface TopicMomentum {
  readonly topic: Topic
  readonly stories_24h: number
  readonly stories_7d: number
  readonly stories_30d: number
  readonly trend: 'rising' | 'stable' | 'declining'
}

const ALL_TOPICS: Topic[] = [
  'politics', 'world', 'technology', 'business',
  'science', 'health', 'culture', 'sports', 'environment',
]

export async function GET() {
  try {
    const client = getSupabaseServerClient()
    const now = Date.now()
    const ms24h = now - 24 * 60 * 60 * 1000
    const ms7d = now - 7 * 24 * 60 * 60 * 1000
    const iso30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch all published stories from last 30d with topic and timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client.from('stories') as any)
      .select('topic, published_at')
      .eq('publication_status', 'published')
      .gte('published_at', iso30d)

    if (error) {
      throw new Error(`Failed to query topic momentum: ${error.message}`)
    }

    const rows = (data ?? []) as Array<{ topic: string; published_at: string }>

    // Count per topic per window
    const counts = new Map<string, { d24: number; d7: number; d30: number }>()
    for (const topic of ALL_TOPICS) {
      counts.set(topic, { d24: 0, d7: 0, d30: 0 })
    }

    for (const row of rows) {
      const entry = counts.get(row.topic)
      if (!entry) continue
      const tsMs = new Date(row.published_at).getTime()
      if (tsMs >= ms24h) entry.d24 += 1
      if (tsMs >= ms7d) entry.d7 += 1
      entry.d30 += 1
    }

    const momentum: TopicMomentum[] = ALL_TOPICS.map((topic) => {
      const c = counts.get(topic)!
      const avgDaily7d = c.d7 / 7
      const trend: TopicMomentum['trend'] =
        c.d24 > avgDaily7d * 1.5
          ? 'rising'
          : c.d24 < avgDaily7d * 0.5
            ? 'declining'
            : 'stable'

      return {
        topic,
        stories_24h: c.d24,
        stories_7d: c.d7,
        stories_30d: c.d30,
        trend,
      }
    })

    return NextResponse.json({
      success: true,
      data: momentum,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
