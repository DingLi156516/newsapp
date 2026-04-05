/**
 * lib/hooks/use-admin-sources.ts — SWR hooks for admin source management.
 *
 * Provides hooks for listing, creating, updating, importing, and discovering
 * RSS feeds for sources.
 */

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import type { DbSource } from '@/lib/supabase/types'

interface AdminSourcesOptions {
  readonly search?: string
  readonly bias?: string
  readonly region?: string
  readonly is_active?: 'all' | 'true' | 'false'
  readonly page?: number
  readonly limit?: number
}

interface AdminSourcesResponse {
  readonly success: boolean
  readonly data: DbSource[]
  readonly meta: {
    readonly total: number
    readonly page: number
    readonly limit: number
  }
}

interface MutationResponse {
  readonly success: boolean
  readonly data: DbSource
  readonly error?: string
}

interface ImportResult {
  readonly inserted: number
  readonly skipped: number
  readonly errors: { row: number; reason: string }[]
}

interface ImportResponse {
  readonly success: boolean
  readonly data: ImportResult
  readonly error?: string
}

interface DiscoveredFeed {
  readonly url: string
  readonly source: 'html-link' | 'common-path'
  readonly title?: string
}

interface DiscoverResponse {
  readonly success: boolean
  readonly data: DiscoveredFeed[]
  readonly error?: string
}

async function postFetcher<T>(url: string, { arg }: { arg: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`)
  }
  return data as T
}

async function patchFetcher(
  url: string,
  { arg }: { arg: { id: string; data: Record<string, unknown> } }
): Promise<MutationResponse> {
  const res = await fetch(`${url}/${arg.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg.data),
  })
  const body = await res.json()
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return body as MutationResponse
}

export function useAdminSources(options: AdminSourcesOptions = {}) {
  const { user } = useAuth()
  const { search, bias, region, is_active = 'all', page = 1, limit = 50 } = options

  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (bias) params.set('bias', bias)
  if (region) params.set('region', region)
  if (is_active !== 'all') params.set('is_active', is_active)
  if (page !== 1) params.set('page', String(page))
  if (limit !== 50) params.set('limit', String(limit))

  const queryString = params.toString()
  const url = `/api/admin/sources${queryString ? `?${queryString}` : ''}`

  const { data, mutate, isLoading } = useSWR<AdminSourcesResponse>(
    user ? url : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  )

  return {
    sources: data?.data ?? [],
    total: data?.meta?.total ?? 0,
    isLoading,
    mutate,
  }
}

export function useCreateSource() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/admin/sources',
    postFetcher<MutationResponse>
  )

  return {
    create: trigger,
    isCreating: isMutating,
    error: error instanceof Error ? error.message : null,
  }
}

export function useUpdateSource() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/admin/sources',
    patchFetcher
  )

  return {
    update: trigger,
    isUpdating: isMutating,
    error: error instanceof Error ? error.message : null,
  }
}

export function useImportSources() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/admin/sources/import',
    postFetcher<ImportResponse>
  )

  return {
    importSources: trigger,
    isImporting: isMutating,
    error: error instanceof Error ? error.message : null,
  }
}

export function useDiscoverRss() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/admin/sources/discover-rss',
    postFetcher<DiscoverResponse>
  )

  return {
    discover: trigger,
    isDiscovering: isMutating,
    error: error instanceof Error ? error.message : null,
  }
}
