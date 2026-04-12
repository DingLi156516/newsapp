/**
 * lib/api/owner-queries.ts — Supabase query helpers for media owners.
 *
 * Provides list (with source count) and detail (with sources array) queries.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, DbMediaOwner } from '@/lib/supabase/types'
import type { OwnersQuery } from '@/lib/api/owner-validation'

interface OwnerRow extends DbMediaOwner {
  source_count: number
}

interface SourceRow {
  id: string
  slug: string
  name: string
  bias: string
  factuality: string
  ownership: string
  url: string | null
  region: string
}

export async function queryOwners(
  client: SupabaseClient<Database>,
  params: OwnersQuery
): Promise<{ data: OwnerRow[]; count: number }> {
  const { search, owner_type, page, limit } = params
  const offset = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from('media_owners') as any)
    // Note: source_count includes inactive sources — acceptable for MVP (all 20 seeded sources active)
    .select('*, source_count:sources(count)', { count: 'exact' })

  if (owner_type) {
    query = query.eq('owner_type', owner_type)
  }

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  query = query
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    throw new Error(`Failed to query owners: ${error.message}`)
  }

  // Supabase returns embedded aggregates as [{count: N}] — normalize to flat number
  const normalized = (data ?? []).map((row: Record<string, unknown>) => {
    const rawCount = row.source_count
    const sourceCount = Array.isArray(rawCount) && rawCount.length > 0
      ? (rawCount[0] as { count: number }).count
      : typeof rawCount === 'number'
        ? rawCount
        : 0
    return { ...row, source_count: sourceCount } as OwnerRow
  })

  return { data: normalized, count: count ?? 0 }
}

export async function queryOwnerById(
  client: SupabaseClient<Database>,
  id: string
): Promise<{ owner: DbMediaOwner; sources: SourceRow[] } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: owner, error: ownerError } = await (client.from('media_owners') as any)
    .select('*')
    .eq('id', id)
    .single()

  if (ownerError) {
    if (ownerError.code === 'PGRST116') return null
    throw new Error(`Failed to fetch owner: ${ownerError.message}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sources, error: sourceError } = await (client.from('sources') as any)
    .select('id, slug, name, bias, factuality, ownership, url, region')
    .eq('owner_id', id)
    .eq('is_active', true)

  if (sourceError) {
    throw new Error(`Failed to fetch sources for owner: ${sourceError.message}`)
  }

  return { owner, sources: sources ?? [] }
}
