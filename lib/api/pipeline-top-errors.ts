/**
 * lib/api/pipeline-top-errors.ts — aggregates pipeline_stage_events
 * with level in (warn, error) over a recent window, grouped by
 * (stage, event_type), with count + first/last seen + a sample
 * payload.
 *
 * Aggregation is done client-side after a bounded fetch (last 1000
 * warn/error rows in the window) so we keep the SQL simple. With the
 * existing idx_stage_events_level partial index, this is cheap.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, DbStageKind } from '@/lib/supabase/types'

const FETCH_LIMIT = 1000

export interface TopErrorRow {
  readonly stage: DbStageKind
  readonly eventType: string
  readonly count: number
  readonly firstSeen: string
  readonly lastSeen: string
  readonly samplePayload: Record<string, unknown>
  readonly sampleRunId: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<Database> | any

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

interface RawEventRow {
  readonly stage: DbStageKind
  readonly event_type: string
  readonly created_at: string
  readonly payload: Record<string, unknown> | null
  readonly run_id: string
}

export async function queryTopErrors(
  client: Client,
  windowHours = 24
): Promise<TopErrorRow[]> {
  const since = isoHoursAgo(windowHours)

  const { data, error } = await client
    .from('pipeline_stage_events')
    .select('stage, event_type, created_at, payload, run_id')
    .in('level', ['warn', 'error'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(FETCH_LIMIT)

  if (error) throw new Error(`Failed to load top errors: ${error.message}`)

  const groups = new Map<string, { rows: RawEventRow[] }>()
  for (const row of (data ?? []) as RawEventRow[]) {
    const key = `${row.stage}::${row.event_type}`
    const bucket = groups.get(key)
    if (bucket) bucket.rows.push(row)
    else groups.set(key, { rows: [row] })
  }

  return Array.from(groups.values())
    .map(({ rows }): TopErrorRow => {
      const sample = rows[0]
      const last = rows[0].created_at
      let first = rows[0].created_at
      for (const r of rows) {
        if (r.created_at < first) first = r.created_at
      }
      return {
        stage: sample.stage,
        eventType: sample.event_type,
        count: rows.length,
        firstSeen: first,
        lastSeen: last,
        samplePayload: sample.payload ?? {},
        sampleRunId: sample.run_id,
      }
    })
    .sort((a, b) => b.count - a.count)
}
