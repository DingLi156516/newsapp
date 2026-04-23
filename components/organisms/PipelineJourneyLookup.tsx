'use client'

/**
 * components/organisms/PipelineJourneyLookup.tsx — paste an article URL,
 * article UUID, or story UUID and see its full state across every
 * pipeline stage.
 *
 * Renders a vertical timeline:
 *   Ingested → Embedded → Clustered → Assembled → Published
 *
 * Each row shows ✓ / ✗ / pending / claimed plus timestamp + error.
 * DLQ entries get flagged red with the last error.
 */

import { useState } from 'react'
import { Search, CheckCircle2, XCircle, Clock, Loader2, AlertOctagon } from 'lucide-react'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useJourney } from '@/lib/hooks/use-journey'
import type { JourneyDlqEntry, JourneyResult } from '@/lib/api/pipeline-journey'
import type { DbArticle, DbStory } from '@/lib/supabase/types'

type StageStatus = 'success' | 'error' | 'pending' | 'claimed' | 'na'

interface StageRow {
  readonly label: string
  readonly status: StageStatus
  readonly at: string | null
  readonly note?: string
}

function statusIcon(status: StageStatus) {
  switch (status) {
    case 'success':
      return <CheckCircle2 size={14} className="text-emerald-400" />
    case 'error':
      return <XCircle size={14} className="text-red-400" />
    case 'claimed':
      return <Loader2 size={14} className="text-amber-300 animate-spin" />
    case 'pending':
      return <Clock size={14} className="text-white/40" />
    default:
      return <span className="inline-block w-3 h-3 rounded-full bg-white/10" />
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function articleStages(article: DbArticle, dlq: JourneyDlqEntry[]): StageRow[] {
  const dlqEmbed = dlq.find((d) => d.itemKind === 'article_embed' && d.itemId === article.id)
  const dlqCluster = dlq.find((d) => d.itemKind === 'article_cluster' && d.itemId === article.id)

  const ingest: StageRow = {
    label: 'Ingested',
    status: 'success',
    at: article.ingested_at ?? article.fetched_at,
  }

  const embed: StageRow = article.is_embedded
    ? { label: 'Embedded', status: 'success', at: article.embedding_claimed_at ?? null }
    : dlqEmbed
    ? { label: 'Embedded', status: 'error', at: dlqEmbed.failedAt, note: dlqEmbed.lastError }
    : article.embedding_last_error
    ? { label: 'Embedded', status: 'error', at: article.embedding_claimed_at, note: article.embedding_last_error }
    : article.embedding_claimed_at
    ? { label: 'Embedded', status: 'claimed', at: article.embedding_claimed_at }
    : { label: 'Embedded', status: 'pending', at: null }

  const cluster: StageRow = article.story_id
    ? { label: 'Clustered', status: 'success', at: article.clustering_claimed_at ?? null }
    : dlqCluster
    ? { label: 'Clustered', status: 'error', at: dlqCluster.failedAt, note: dlqCluster.lastError }
    : article.clustering_status === 'expired'
    ? { label: 'Clustered', status: 'error', at: null, note: 'expired from clustering pool' }
    : article.clustering_last_error
    ? { label: 'Clustered', status: 'error', at: article.clustering_claimed_at, note: article.clustering_last_error }
    : article.clustering_claimed_at
    ? { label: 'Clustered', status: 'claimed', at: article.clustering_claimed_at }
    : { label: 'Clustered', status: 'pending', at: null }

  return [ingest, embed, cluster]
}

function storyStages(story: DbStory | null, dlq: JourneyDlqEntry[]): StageRow[] {
  if (!story) {
    return [
      { label: 'Assembled', status: 'na', at: null },
      { label: 'Published', status: 'na', at: null },
    ]
  }

  const dlqAssemble = dlq.find((d) => d.itemKind === 'story_assemble' && d.itemId === story.id)

  const assembled: StageRow =
    story.assembly_status === 'completed'
      ? { label: 'Assembled', status: 'success', at: story.assembled_at ?? null }
      : story.assembly_status === 'failed'
      ? {
          label: 'Assembled',
          status: 'error',
          at: story.assembled_at,
          note: story.assembly_last_error ?? 'assembly failed',
        }
      : dlqAssemble
      ? { label: 'Assembled', status: 'error', at: dlqAssemble.failedAt, note: dlqAssemble.lastError }
      : story.assembly_claimed_at
      ? { label: 'Assembled', status: 'claimed', at: story.assembly_claimed_at }
      : { label: 'Assembled', status: 'pending', at: null }

  const published: StageRow =
    story.publication_status === 'published'
      ? { label: 'Published', status: 'success', at: story.published_at ?? null }
      : story.publication_status === 'rejected'
      ? { label: 'Published', status: 'error', at: null, note: 'rejected' }
      : story.publication_status === 'needs_review'
      ? { label: 'Published', status: 'pending', at: null, note: 'in review' }
      : { label: 'Published', status: 'pending', at: null }

  return [assembled, published]
}

function StageRowItem({ row }: { readonly row: StageRow }) {
  return (
    <li className="flex items-start gap-3 py-2 border-l-2 border-white/10 pl-4 ml-2">
      <div className="mt-0.5">{statusIcon(row.status)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/85 font-mono">{row.label}</span>
          <span className="text-white/40 tabular-nums">{formatTime(row.at)}</span>
        </div>
        {row.note && (
          <div className="mt-1 text-[11px] text-red-300 bg-red-500/10 rounded px-2 py-1 break-words">
            {row.note}
          </div>
        )}
      </div>
    </li>
  )
}

function JourneyView({ result }: { readonly result: JourneyResult }) {
  if (result.resolved === 'none') {
    return (
      <div className="glass-sm px-4 py-6 text-center text-sm text-white/40">
        No article or story matched <span className="font-mono">{result.query}</span>.
      </div>
    )
  }

  const dlq = result.dlq
  return (
    <div className="space-y-4">
      {result.articles.map((article) => {
        const stages = articleStages(article, dlq)
        return (
          <div key={article.id} className="glass-sm rounded-2xl p-4 space-y-2">
            <div className="text-xs text-white/60 truncate">
              <span className="text-white/40">article</span>{' '}
              <span className="font-mono">{article.id.slice(0, 8)}…</span>{' '}
              <span className="text-white/40">·</span>{' '}
              <span className="text-white/80">{article.title}</span>
            </div>
            <ul>
              {stages.map((row) => (
                <StageRowItem key={row.label} row={row} />
              ))}
              {storyStages(result.story, dlq).map((row) => (
                <StageRowItem key={row.label} row={row} />
              ))}
            </ul>
          </div>
        )
      })}

      {result.events.length > 0 && (
        <div className="glass-sm rounded-2xl p-4 space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-white/50">
            Recent events ({result.events.length})
          </h3>
          <ul className="space-y-1 max-h-72 overflow-y-auto">
            {result.events.map((ev) => (
              <li
                key={ev.id}
                className="flex items-center gap-2 text-[11px] px-2 py-1 rounded glass-sm"
              >
                <span
                  className={
                    ev.level === 'error'
                      ? 'text-red-300'
                      : ev.level === 'warn'
                      ? 'text-amber-300'
                      : 'text-blue-300'
                  }
                >
                  {ev.level}
                </span>
                <span className="text-white/50">{ev.stage}</span>
                <span className="text-white/85 font-mono truncate flex-1">{ev.event_type}</span>
                <span className="text-white/30 tabular-nums">
                  {new Date(ev.created_at).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.dlq.length > 0 && (
        <div className="glass-sm rounded-2xl p-4 space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-red-300 flex items-center gap-1">
            <AlertOctagon size={12} /> DLQ ({result.dlq.length})
          </h3>
          <ul className="space-y-1">
            {result.dlq.map((entry) => (
              <li key={entry.id} className="text-[11px] text-red-200 break-words">
                <span className="font-mono">{entry.itemKind}</span>: {entry.lastError}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function PipelineJourneyLookup() {
  const [input, setInput] = useState('')
  const debounced = useDebounce(input.trim(), 400)
  const { result, isLoading, error } = useJourney(debounced)

  return (
    <div className="space-y-3">
      <h2
        className="text-lg font-bold text-white"
        style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
      >
        Journey Lookup
      </h2>

      <div className="glass-sm flex items-center gap-2 px-3 py-2 rounded-2xl">
        <Search size={14} className="text-white/40" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste article URL, article UUID, or story UUID…"
          aria-label="Journey lookup query"
          className="flex-1 bg-transparent text-sm text-white/85 placeholder:text-white/30 focus:outline-none font-mono"
        />
        {input && (
          <button
            type="button"
            onClick={() => setInput('')}
            className="text-xs text-white/40 hover:text-white/70 px-2"
          >
            clear
          </button>
        )}
      </div>

      {!debounced ? (
        <p className="text-xs text-white/40 px-1">
          Enter a URL or UUID to trace its pipeline state.
        </p>
      ) : isLoading ? (
        <div className="glass-sm px-4 py-6 text-center text-sm text-white/50">Loading…</div>
      ) : error ? (
        <div className="glass-sm px-4 py-6 text-center text-sm text-red-400">{error}</div>
      ) : result ? (
        <JourneyView result={result} />
      ) : null}
    </div>
  )
}
