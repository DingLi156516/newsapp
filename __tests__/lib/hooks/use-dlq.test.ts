/**
 * Tests for lib/hooks/use-dlq.ts — SWR wrapper around the DLQ admin
 * endpoint. Mirrors the shape of use-pipeline-events tests (SWR mocked)
 * combined with the fetch-spy style used in use-pipeline-maintenance
 * for the replay/dismiss mutation path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('swr', () => ({
  default: vi.fn(),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/use-auth'
import { useDlq } from '@/lib/hooks/use-dlq'

const mockUseSWR = vi.mocked(useSWR)
const mockUseAuth = vi.mocked(useAuth)

const mockAuthReturn = {
  user: { id: 'admin-1' },
  session: null,
  isLoading: false,
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
}

const sampleEntry = {
  id: '11111111-1111-1111-1111-111111111111',
  itemKind: 'article_embed',
  itemId: 'article-abc',
  retryCount: 5,
  lastError: 'gemini 429',
  failedAt: '2026-04-10T12:00:00.000Z',
  replayedAt: null,
}

describe('useDlq', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('does not fetch when the user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ ...mockAuthReturn, user: null } as never)
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderHook(() => useDlq())

    // When user is null, the SWR key should be null → no fetch.
    expect(mockUseSWR).toHaveBeenCalled()
    const swrCall = mockUseSWR.mock.calls[0]
    expect(swrCall[0]).toBe(null)
  })

  it('returns entries from the DLQ endpoint when authenticated', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [sampleEntry] },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { result } = renderHook(() => useDlq())

    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].id).toBe(sampleEntry.id)
    expect(result.current.isLoading).toBe(false)

    // SWR key should be the DLQ admin endpoint.
    const swrKey = mockUseSWR.mock.calls[0][0]
    expect(swrKey).toBe('/api/admin/dlq')
  })

  it('surfaces errors as a string on the error field', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('oops'),
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { result } = renderHook(() => useDlq())
    expect(result.current.error).toBe('oops')
  })

  it('replay() POSTs to /api/admin/dlq and revalidates on success', async () => {
    const mutate = vi.fn()
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [sampleEntry] },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: { id: sampleEntry.id, replayed: true } }),
        { status: 200 }
      )
    )

    const { result } = renderHook(() => useDlq())

    await result.current.replay(sampleEntry.id)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/dlq',
      expect.objectContaining({
        method: 'POST',
      })
    )
    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'replay',
      id: sampleEntry.id,
    })

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled()
    })
  })

  it('dismiss() POSTs the dismiss action and revalidates on success', async () => {
    const mutate = vi.fn()
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [sampleEntry] },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: { id: sampleEntry.id, dismissed: true } }),
        { status: 200 }
      )
    )

    const { result } = renderHook(() => useDlq())

    await result.current.dismiss(sampleEntry.id)

    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'dismiss',
      id: sampleEntry.id,
    })
    await waitFor(() => {
      expect(mutate).toHaveBeenCalled()
    })
  })

  it('throws when the server returns 409 conflict so callers can surface a banner', async () => {
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [sampleEntry] },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error:
            'Cannot replay DLQ entry: story is currently being assembled or its assembly_version moved',
        }),
        { status: 409 }
      )
    )

    const { result } = renderHook(() => useDlq())

    await expect(result.current.replay(sampleEntry.id)).rejects.toThrow(
      /assembly_version moved/
    )
  })

  it('throws on non-OK responses with the server error message', async () => {
    mockUseAuth.mockReturnValue(mockAuthReturn as never)
    mockUseSWR.mockReturnValue({
      data: { success: true, data: [sampleEntry] },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'db crash' }), {
        status: 500,
      })
    )

    const { result } = renderHook(() => useDlq())
    await expect(result.current.dismiss(sampleEntry.id)).rejects.toThrow(/db crash/)
  })
})
