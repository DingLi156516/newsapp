/**
 * lib/api/source-admin-queries.ts — Supabase CRUD helpers for admin source management.
 *
 * Provides paginated listing, create, update, slug check, and bulk import.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { DbSource } from '@/lib/supabase/types'
import type { AdminSourcesQuery, CreateSourceInput, UpdateSourceInput } from '@/lib/api/source-admin-validation'
import { normalizeSourceSlug } from '@/lib/source-slugs'

function escapePostgrestLike(value: string): string {
  return value.replace(/[%_,.()\\\*]/g, (ch) => `\\${ch}`)
}

export async function queryAdminSources(
  client: SupabaseClient<Database>,
  params: AdminSourcesQuery
): Promise<{ data: DbSource[]; count: number }> {
  const { search, bias, region, is_active, source_type, page, limit } = params
  const offset = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from('sources') as any)
    .select(
      'id, slug, name, bias, factuality, ownership, url, rss_url, region, is_active, last_fetch_at, last_fetch_status, last_fetch_error, consecutive_failures, total_articles_ingested, created_at, updated_at, bias_mbfc, bias_allsides, bias_adfm, factuality_mbfc, factuality_allsides, bias_override, bias_sources_synced_at, source_type, ingestion_config, owner_id',
      { count: 'exact' }
    )

  if (search) {
    const escaped = escapePostgrestLike(search)
    query = query.or(`name.ilike.%${escaped}%,slug.ilike.%${escaped}%`)
  }

  if (bias) {
    query = query.eq('bias', bias)
  }

  if (region) {
    query = query.eq('region', region)
  }

  if (is_active === 'true') {
    query = query.eq('is_active', true)
  } else if (is_active === 'false') {
    query = query.eq('is_active', false)
  }

  if (source_type && source_type !== 'all') {
    query = query.eq('source_type', source_type)
  }

  query = query
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    throw new Error(`Failed to query admin sources: ${error.message}`)
  }

  return { data: data ?? [], count: count ?? 0 }
}

export async function createSource(
  client: SupabaseClient<Database>,
  input: CreateSourceInput
): Promise<DbSource> {
  const slug = input.slug || normalizeSourceSlug(input.name)

  const insertData = {
    name: input.name,
    slug,
    bias: input.bias,
    factuality: input.factuality,
    ownership: input.ownership,
    region: input.region ?? 'us',
    url: input.url ?? null,
    rss_url: input.rss_url ?? null,
    is_active: true,
    source_type: input.source_type ?? 'rss',
    ingestion_config: input.ingestion_config ?? {},
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('sources') as any)
    .insert(insertData)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error(`A source with slug "${slug}" already exists`)
    }
    throw new Error(`Failed to create source: ${error.message}`)
  }

  return data
}

export async function updateSource(
  client: SupabaseClient<Database>,
  id: string,
  input: UpdateSourceInput
): Promise<DbSource> {
  const updateData: Record<string, unknown> = {}

  if (input.name !== undefined) updateData.name = input.name
  if (input.url !== undefined) updateData.url = input.url
  if (input.rss_url !== undefined) updateData.rss_url = input.rss_url
  if (input.bias !== undefined) updateData.bias = input.bias
  if (input.factuality !== undefined) updateData.factuality = input.factuality
  if (input.ownership !== undefined) updateData.ownership = input.ownership
  if (input.region !== undefined) updateData.region = input.region
  if (input.is_active !== undefined) updateData.is_active = input.is_active
  if (input.slug !== undefined) updateData.slug = input.slug
  if (input.bias_override !== undefined) updateData.bias_override = input.bias_override
  if (input.source_type !== undefined) updateData.source_type = input.source_type
  if (input.ingestion_config !== undefined) updateData.ingestion_config = input.ingestion_config
  if (input.owner_id !== undefined) updateData.owner_id = input.owner_id

  // Auto-set bias_override when admin manually changes bias or factuality,
  // but only if the caller didn't explicitly provide bias_override
  if ((input.bias !== undefined || input.factuality !== undefined) && input.bias_override === undefined) {
    updateData.bias_override = true
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No fields to update')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('sources') as any)
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error(`A source with that slug already exists`)
    }
    if (error.code === '23503') {
      throw new Error('Referenced owner does not exist')
    }
    throw new Error(`Failed to update source: ${error.message}`)
  }

  if (!data) {
    throw new Error('Source not found')
  }

  return data
}

interface BulkCreateResult {
  readonly inserted: number
  readonly skipped: number
  readonly errors: { row: number; reason: string }[]
}

const BATCH_SIZE = 50

export async function bulkCreateSources(
  client: SupabaseClient<Database>,
  rows: { name: string; url?: string; rss_url?: string; bias: string; factuality: string; ownership: string; region?: string; slug?: string }[]
): Promise<BulkCreateResult> {
  const errors: { row: number; reason: string }[] = []
  let inserted = 0
  let skipped = 0

  // Prepare all insert objects with original row indices
  const prepared = rows.map((row, i) => ({
    index: i,
    data: {
      name: row.name,
      slug: row.slug || normalizeSourceSlug(row.name),
      bias: row.bias,
      factuality: row.factuality,
      ownership: row.ownership,
      region: row.region || 'us',
      url: row.url || null,
      rss_url: row.rss_url || null,
      is_active: true,
    },
  }))

  // Process in batches of BATCH_SIZE
  for (let start = 0; start < prepared.length; start += BATCH_SIZE) {
    const batch = prepared.slice(start, start + BATCH_SIZE)
    const batchData = batch.map((item) => item.data)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from('sources') as any)
      .insert(batchData)

    if (error) {
      if (error.code === '23505') {
        // Duplicate in batch — fall back to row-by-row to identify which rows
        for (const item of batch) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: rowError } = await (client.from('sources') as any)
            .insert(item.data)

          if (rowError) {
            if (rowError.code === '23505') {
              skipped++
              errors.push({ row: item.index, reason: `Duplicate slug: ${item.data.slug}` })
            } else {
              errors.push({ row: item.index, reason: rowError.message })
            }
          } else {
            inserted++
          }
        }
      } else {
        // Non-duplicate batch error — record all rows in batch as errors
        for (const item of batch) {
          errors.push({ row: item.index, reason: error.message })
        }
      }
    } else {
      inserted += batch.length
    }
  }

  return { inserted, skipped, errors }
}
