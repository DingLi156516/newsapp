/**
 * lib/hooks/use-dlq.ts — SWR wrapper around the dead-letter queue admin
 * endpoint.
 *
 * Reads via GET /api/admin/dlq. Provides `replay` and `dismiss`
 * mutation helpers that POST to the same endpoint and then revalidate
 * the SWR cache so the list reflects the server state.
 *
 * Admin-only: when the current user is unauthenticated the SWR key is
 * null and no fetch is issued. The Panel component gates its own
 * rendering behind the admin check already.
 *
 * See:
 *   - app/api/admin/dlq/route.ts (endpoint)
 *   - components/organisms/PipelineDlqPanel.tsx (consumer)
 *   - lib/pipeline/dead-letter.ts (DlqEntry shape)
 */

import useSWR from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'
import type { DlqEntry } from '@/lib/pipeline/dead-letter'

interface DlqResponse {
  readonly success: boolean
  readonly data: DlqEntry[]
}

interface DlqActionResponse {
  readonly success: boolean
  readonly error?: string
  readonly data?: Record<string, unknown>
}

async function postDlqAction(
  action: 'replay' | 'dismiss',
  id: string
): Promise<void> {
  const res = await fetch('/api/admin/dlq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, id }),
  })

  let body: DlqActionResponse
  try {
    body = (await res.json()) as DlqActionResponse
  } catch {
    body = { success: false, error: `HTTP ${res.status}` }
  }

  if (!res.ok || !body.success) {
    throw new Error(body.error ?? `DLQ ${action} failed: HTTP ${res.status}`)
  }
}

export function useDlq() {
  const { user } = useAuth()

  const key = user ? '/api/admin/dlq' : null

  const { data, error, isLoading, mutate } = useSWR<DlqResponse>(key, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  })

  async function replay(id: string): Promise<void> {
    await postDlqAction('replay', id)
    await mutate()
  }

  async function dismiss(id: string): Promise<void> {
    await postDlqAction('dismiss', id)
    await mutate()
  }

  async function refresh(): Promise<void> {
    await mutate()
  }

  return {
    entries: data?.data ?? [],
    isLoading,
    error: error instanceof Error ? error.message : null,
    refresh,
    replay,
    dismiss,
  }
}
