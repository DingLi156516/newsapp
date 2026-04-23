'use client'

/**
 * components/organisms/PipelineLiveFetchTicker.tsx — shows which RSS /
 * crawler / news-API source is currently in-flight while an ingest
 * run is active.
 *
 * Source events are emitted as `source_fetch_start` /
 * `source_fetch_complete` (level=info, stage=ingest) by
 * lib/ingestion/ingest.ts. We poll /api/admin/pipeline/events filtered
 * to the active run and stage=ingest, then compute the set of starts
 * with no matching complete on the same source_id.
 */

import { useMemo } from 'react'
import useSWR from 'swr'
import { Radio } from 'lucide-react'
import { fetcher } from '@/lib/hooks/fetcher'
import type { DbPipelineStageEvent } from '@/lib/supabase/types'

interface EventsResponse {
  readonly success: boolean
  readonly data: DbPipelineStageEvent[]
}

interface InFlight {
  readonly sourceId: string
  readonly slug: string
  readonly startedAt: string
  readonly elapsedMs: number
}

function findInFlight(events: ReadonlyArray<DbPipelineStageEvent>): InFlight[] {
  const startsBySource = new Map<string, { event: DbPipelineStageEvent; sourceId: string }>()
  const completesBySource = new Set<string>()

  // Events come back newest first; iterate so each source's most recent start
  // is what we report.
  for (const ev of events) {
    const sourceId = ev.source_id
    if (!sourceId) continue
    if (ev.event_type === 'source_fetch_complete') {
      completesBySource.add(sourceId)
    } else if (ev.event_type === 'source_fetch_start' && !startsBySource.has(sourceId)) {
      if (!completesBySource.has(sourceId)) {
        startsBySource.set(sourceId, { event: ev, sourceId })
      }
    }
  }

  const now = Date.now()
  return Array.from(startsBySource.values()).map(({ event: ev, sourceId }) => {
    const startedAt = ev.created_at
    const slug = (ev.payload?.slug as string | undefined) ?? sourceId
    return {
      sourceId,
      slug,
      startedAt,
      elapsedMs: Math.max(0, now - new Date(startedAt).getTime()),
    }
  })
}

interface Props {
  readonly runId: string
}

export function PipelineLiveFetchTicker({ runId }: Props) {
  // Include warn (and error) levels — fetchSource emits the matching
  // source_fetch_complete at level=warn when a fetch throws, so a level=info
  // filter would leave failed sources stuck on the ticker until the run ends.
  const url = `/api/admin/pipeline/events?runId=${runId}&stage=ingest&level=info,warn,error&limit=200`

  const { data } = useSWR<EventsResponse>(url, fetcher, {
    refreshInterval: 2000,
    revalidateOnFocus: true,
    dedupingInterval: 1000,
  })

  const inFlight = useMemo(() => findInFlight(data?.data ?? []), [data])

  if (inFlight.length === 0) return null

  return (
    <div
      data-testid="pipeline-live-fetch-ticker"
      className="mt-2 flex items-center gap-2 text-[11px] text-blue-200/90"
    >
      <Radio size={11} className="text-blue-300 animate-pulse" />
      <span className="text-white/50">fetching:</span>
      {inFlight.slice(0, 3).map((row) => (
        <span key={row.sourceId} className="glass-pill px-2 py-0.5 font-mono">
          {row.slug}
          <span className="ml-1 text-white/40 tabular-nums">
            {Math.floor(row.elapsedMs / 1000)}s
          </span>
        </span>
      ))}
      {inFlight.length > 3 && (
        <span className="text-white/40">+{inFlight.length - 3} more</span>
      )}
    </div>
  )
}
