import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useReviewAction } from '@/lib/hooks/use-review-action'

describe('useReviewAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('sends approve request', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response)

    const { result } = renderHook(() => useReviewAction())

    await act(async () => {
      await result.current.approve('story-1')
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/review/story-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'approve' }),
      })
    )
  })

  it('sends approve with edits', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response)

    const { result } = renderHook(() => useReviewAction())

    await act(async () => {
      await result.current.approve('story-1', {
        headline: 'Edited',
        ai_summary: {
          commonGround: 'CG',
          leftFraming: 'LF',
          rightFraming: 'RF',
        },
      })
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/review/story-1',
      expect.objectContaining({
        body: expect.stringContaining('"headline":"Edited"'),
      })
    )
  })

  it('sends reject request', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response)

    const { result } = renderHook(() => useReviewAction())

    await act(async () => {
      await result.current.reject('story-1')
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/review/story-1',
      expect.objectContaining({
        body: JSON.stringify({ action: 'reject' }),
      })
    )
  })

  it('sends reprocess request', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response)

    const { result } = renderHook(() => useReviewAction())

    await act(async () => {
      await result.current.reprocess('story-1')
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/review/story-1',
      expect.objectContaining({
        body: JSON.stringify({ action: 'reprocess' }),
      })
    )
  })

  it('tracks loading state', async () => {
    const mockFetch = vi.mocked(global.fetch)
    let resolveFetch: (value: Response) => void
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      })
    )

    const { result } = renderHook(() => useReviewAction())
    expect(result.current.isLoading).toBe(false)

    let promise: Promise<void>
    act(() => {
      promise = result.current.approve('story-1')
    })

    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      resolveFetch!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)
      await promise!
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('throws on failed request', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ success: false, error: 'Server error' }),
    } as Response)

    const { result } = renderHook(() => useReviewAction())

    await expect(
      act(async () => {
        await result.current.approve('story-1')
      })
    ).rejects.toThrow('Review action failed')
  })
})
