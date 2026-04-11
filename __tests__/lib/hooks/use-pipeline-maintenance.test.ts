/**
 * Tests for lib/hooks/use-pipeline-maintenance.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePipelineMaintenance } from '@/lib/hooks/use-pipeline-maintenance'

describe('usePipelineMaintenance', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: any

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('POSTs to /api/admin/maintenance and resolves with the result', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            action: 'purge_unembedded_articles',
            dryRun: true,
            deletedCount: 3,
            sampleIds: ['a1', 'a2'],
            auditId: 'audit-1',
          },
        }),
        { status: 200 }
      )
    )

    const { result } = renderHook(() => usePipelineMaintenance())
    const outcome = await result.current.runMaintenance({
      action: 'purge_unembedded_articles',
      dryRun: true,
    })

    expect(outcome?.deletedCount).toBe(3)
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/admin/maintenance',
      expect.objectContaining({ method: 'POST' })
    )
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'purge_unembedded_articles',
      dryRun: true,
    })
  })

  it('throws when the response has success=false', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: 'db crash' }),
        { status: 500 }
      )
    )

    const { result } = renderHook(() => usePipelineMaintenance())

    await expect(
      result.current.runMaintenance({
        action: 'purge_orphan_stories',
        dryRun: false,
      })
    ).rejects.toThrow(/db crash/)

    await waitFor(() => expect(result.current.error).toBeTruthy())
  })
})
