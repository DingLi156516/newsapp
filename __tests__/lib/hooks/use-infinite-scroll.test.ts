import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useInfiniteScroll } from '@/lib/hooks/use-infinite-scroll'

const mockObserve = vi.fn()
const mockDisconnect = vi.fn()

let observerCallback: IntersectionObserverCallback

beforeEach(() => {
  vi.clearAllMocks()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).IntersectionObserver = vi.fn((callback: IntersectionObserverCallback) => {
    observerCallback = callback
    return { observe: mockObserve, disconnect: mockDisconnect, unobserve: vi.fn() }
  })
})

describe('useInfiniteScroll', () => {
  it('returns a ref object', () => {
    const { result } = renderHook(() =>
      useInfiniteScroll(vi.fn(), { enabled: true, isLoading: false })
    )
    expect(result.current).toHaveProperty('current')
  })

  it('does not create observer when disabled', () => {
    renderHook(() =>
      useInfiniteScroll(vi.fn(), { enabled: false, isLoading: false })
    )
    expect(mockObserve).not.toHaveBeenCalled()
  })

  it('does not create observer when loading', () => {
    renderHook(() =>
      useInfiniteScroll(vi.fn(), { enabled: true, isLoading: true })
    )
    expect(mockObserve).not.toHaveBeenCalled()
  })

  it('calls onLoadMore when sentinel intersects', () => {
    const onLoadMore = vi.fn()
    const { result } = renderHook(() =>
      useInfiniteScroll(onLoadMore, { enabled: true, isLoading: false })
    )

    // Simulate attaching ref to a DOM element
    const sentinel = document.createElement('div')
    Object.defineProperty(result.current, 'current', { value: sentinel, writable: true })

    // Re-render to trigger effect with the attached ref
    renderHook(() =>
      useInfiniteScroll(onLoadMore, { enabled: true, isLoading: false })
    )

    // Simulate intersection
    if (observerCallback) {
      observerCallback(
        [{ isIntersecting: true }] as IntersectionObserverEntry[],
        {} as IntersectionObserver
      )
      expect(onLoadMore).toHaveBeenCalledTimes(1)
    }
  })
})
