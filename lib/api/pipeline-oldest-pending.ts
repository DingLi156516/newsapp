/**
 * lib/api/pipeline-oldest-pending.ts — query helpers for the pipeline
 * "operational SLO" tiles: oldest pending age per stage, stale claim
 * counts (claims older than TTL with no progress), and review-queue
 * reason breakdown.
 *
 * Returned shapes are consumed by GET /api/admin/pipeline/oldest-pending
 * and the SWR hook useOldestPending().
 *
 * TTL constants mirror lib/pipeline/claim-utils.ts: 30 min for article
 * stages (embed, cluster), 60 min for assembly. A claim older than TTL
 * is "stale" — work that was checked out by a runner that never
 * released or completed it.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const ARTICLE_CLAIM_TTL_MIN = 30
const ASSEMBLY_CLAIM_TTL_MIN = 60

export interface OldestPendingResult {
  readonly oldestEmbedPendingAt: string | null
  readonly oldestClusterPendingAt: string | null
  readonly oldestAssemblyPendingAt: string | null
}

export interface StaleClaimsResult {
  readonly staleEmbedClaims: number
  readonly staleClusterClaims: number
  readonly staleAssemblyClaims: number
}

export interface ReviewReasonBreakdown {
  readonly reason: string
  readonly count: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<Database> | any

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

export async function queryOldestPendingByStage(
  client: Client
): Promise<OldestPendingResult> {
  // No time-window filter on purpose: an "oldest pending" SLO that hid
  // very-old stuck rows would defeat its purpose. The matching partial
  // indexes (idx_articles_embed_claim, idx_articles_cluster_claim,
  // idx_stories_assembly_claim) keep these small-result LIMIT 1 queries
  // cheap even on a full pending set.
  //
  // Each query mirrors the claim RPC predicate so the SLO tile reflects
  // what the pipeline can actually pick up next:
  //   - retry backoff (next_attempt_at in the future) is excluded
  //   - rows with a *fresh* claim are excluded (a worker holds them); only
  //     rows whose lease is null or has expired count as backlog
  // Together with the stale-claims tile, ancient stuck rows still surface:
  // they fall back into "claimable" the moment the lease expires.
  const nowIso = new Date().toISOString()
  const articleClaimCutoff = isoMinutesAgo(ARTICLE_CLAIM_TTL_MIN)
  const assemblyClaimCutoff = isoMinutesAgo(ASSEMBLY_CLAIM_TTL_MIN)

  const [embedRow, clusterRow, assemblyRow] = await Promise.all([
    client
      .from('articles')
      .select('created_at')
      .eq('is_embedded', false)
      .or(`embedding_next_attempt_at.is.null,embedding_next_attempt_at.lte.${nowIso}`)
      .or(`embedding_claimed_at.is.null,embedding_claimed_at.lt.${articleClaimCutoff}`)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    client
      .from('articles')
      .select('created_at')
      .eq('is_embedded', true)
      .is('story_id', null)
      .eq('clustering_status', 'pending')
      .or(`clustering_next_attempt_at.is.null,clustering_next_attempt_at.lte.${nowIso}`)
      .or(`clustering_claimed_at.is.null,clustering_claimed_at.lt.${articleClaimCutoff}`)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    client
      .from('stories')
      .select('created_at')
      .eq('assembly_status', 'pending')
      .or(`assembly_next_attempt_at.is.null,assembly_next_attempt_at.lte.${nowIso}`)
      .or(`assembly_claimed_at.is.null,assembly_claimed_at.lt.${assemblyClaimCutoff}`)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  if (embedRow?.error) throw new Error(`oldest embed pending failed: ${embedRow.error.message}`)
  if (clusterRow?.error) throw new Error(`oldest cluster pending failed: ${clusterRow.error.message}`)
  if (assemblyRow?.error) throw new Error(`oldest assembly pending failed: ${assemblyRow.error.message}`)

  return {
    oldestEmbedPendingAt: (embedRow?.data?.created_at as string | null | undefined) ?? null,
    oldestClusterPendingAt: (clusterRow?.data?.created_at as string | null | undefined) ?? null,
    oldestAssemblyPendingAt: (assemblyRow?.data?.created_at as string | null | undefined) ?? null,
  }
}

export async function queryStaleClaimCounts(
  client: Client
): Promise<StaleClaimsResult> {
  const articleCutoff = isoMinutesAgo(ARTICLE_CLAIM_TTL_MIN)
  const assemblyCutoff = isoMinutesAgo(ASSEMBLY_CLAIM_TTL_MIN)

  const [embed, cluster, assembly] = await Promise.all([
    client
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('is_embedded', false)
      .lt('embedding_claimed_at', articleCutoff),
    client
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .is('story_id', null)
      .lt('clustering_claimed_at', articleCutoff),
    // claim_stories_for_assembly() sets assembly_status='processing' on the
    // claimed row (migration 037); a crashed worker leaves the lease here,
    // not on 'pending' rows. Filter on 'processing' so stale assembly
    // claims actually surface in the SLO tile.
    client
      .from('stories')
      .select('id', { count: 'exact', head: true })
      .eq('assembly_status', 'processing')
      .lt('assembly_claimed_at', assemblyCutoff),
  ])

  // Surface query failures rather than silently returning zero, otherwise
  // an RLS/schema regression would make the dashboard report a healthy
  // pipeline during an actual outage.
  if (embed.error) throw new Error(`stale embed count failed: ${embed.error.message}`)
  if (cluster.error) throw new Error(`stale cluster count failed: ${cluster.error.message}`)
  if (assembly.error) throw new Error(`stale assembly count failed: ${assembly.error.message}`)

  return {
    staleEmbedClaims: embed.count ?? 0,
    staleClusterClaims: cluster.count ?? 0,
    staleAssemblyClaims: assembly.count ?? 0,
  }
}

export async function queryReviewReasonBreakdown(
  client: Client
): Promise<ReviewReasonBreakdown[]> {
  const { data, error } = await client
    .from('stories')
    .select('review_reasons')
    .eq('review_status', 'pending')
    .eq('publication_status', 'needs_review')

  if (error) {
    throw new Error(`Failed to load review reasons: ${error.message}`)
  }

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ review_reasons: string[] | null }>) {
    const reasons = row.review_reasons ?? []
    for (const reason of reasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
}
