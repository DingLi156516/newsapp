import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/hooks/use-telemetry-consent', () => ({
  useTelemetryConsent: vi.fn(() => true),
}))

import { useTelemetryConsent } from '@/lib/hooks/use-telemetry-consent'
import { dwellBucketForMs, useStoryTelemetry } from '@/lib/hooks/use-story-telemetry'

const mockConsent = vi.mocked(useTelemetryConsent)

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockConsent.mockReturnValue(true)
  fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
  vi.stubGlobal('fetch', fetchSpy)
  // Default: short page so the immediate read-through check fires.
  Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true })
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: 800,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })
  // sendBeacon polyfill that returns false so we always go through fetch in tests.
  Object.defineProperty(navigator, 'sendBeacon', {
    value: () => false,
    writable: true,
    configurable: true,
  })
})

function eventBodies() {
  return fetchSpy.mock.calls
    .filter((c) => c[0] === '/api/events/story')
    .map((c) => JSON.parse((c[1] as RequestInit).body as string))
}

describe('dwellBucketForMs', () => {
  it.each([
    [0, 0],
    [4_999, 0],
    [5_000, 1],
    [29_999, 1],
    [30_000, 2],
    [119_999, 2],
    [120_000, 3],
    [3_600_000, 3],
  ])('maps %ims to bucket %i', (ms, bucket) => {
    expect(dwellBucketForMs(ms)).toBe(bucket)
  })
})

describe('useStoryTelemetry', () => {
  it('fires a single view event on mount', () => {
    renderHook(() => useStoryTelemetry({ storyId: '550e8400-e29b-41d4-a716-446655440000' }))
    const views = eventBodies().filter((b) => b.action === 'view')
    expect(views).toHaveLength(1)
    expect(views[0]).toMatchObject({
      storyId: '550e8400-e29b-41d4-a716-446655440000',
      action: 'view',
      client: 'web',
    })
  })

  it('does not fire any events when consent is denied', () => {
    mockConsent.mockReturnValue(false)
    const { unmount } = renderHook(() => useStoryTelemetry({ storyId: '550e8400-e29b-41d4-a716-446655440000' }))
    unmount()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fires read_through immediately when document fits in viewport', () => {
    renderHook(() => useStoryTelemetry({ storyId: '550e8400-e29b-41d4-a716-446655440000' }))
    const reads = eventBodies().filter((b) => b.action === 'read_through')
    expect(reads).toHaveLength(1)
  })

  it('fires read_through only after scrolling past 80% on a long page', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 4000,
      writable: true,
      configurable: true,
    })
    renderHook(() => useStoryTelemetry({ storyId: '550e8400-e29b-41d4-a716-446655440000' }))
    expect(eventBodies().some((b) => b.action === 'read_through')).toBe(false)

    Object.defineProperty(window, 'scrollY', { value: 2000, writable: true, configurable: true })
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(eventBodies().some((b) => b.action === 'read_through')).toBe(false)

    Object.defineProperty(window, 'scrollY', { value: 2700, writable: true, configurable: true })
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    const reads = eventBodies().filter((b) => b.action === 'read_through')
    expect(reads).toHaveLength(1)
  })

  it('fires dwell on unmount with bucket 0 for an immediate close', () => {
    const { unmount } = renderHook(() => useStoryTelemetry({ storyId: '550e8400-e29b-41d4-a716-446655440000' }))
    unmount()
    const dwells = eventBodies().filter((b) => b.action === 'dwell')
    expect(dwells).toHaveLength(1)
    expect(dwells[0].dwellBucket).toBe(0)
  })

  it('pauses (does not finalize) dwell on visibilitychange to hidden', () => {
    renderHook(() => useStoryTelemetry({ storyId: '550e8400-e29b-41d4-a716-446655440000' }))
    fetchSpy.mockClear()
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    // Hidden alone does NOT flush — that would systematically undercount
    // multitasking readers who tab away and come back. Dwell is sent
    // only on pagehide / unmount.
    expect(eventBodies().filter((b) => b.action === 'dwell')).toHaveLength(0)
  })

  it('flushes dwell exactly once after a hide → show → unmount cycle', () => {
    const { unmount } = renderHook(() => useStoryTelemetry({ storyId: '550e8400-e29b-41d4-a716-446655440000' }))
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    unmount()
    const dwells = eventBodies().filter((b) => b.action === 'dwell')
    expect(dwells).toHaveLength(1)
  })

  it('flushes dwell on pagehide', () => {
    renderHook(() => useStoryTelemetry({ storyId: '550e8400-e29b-41d4-a716-446655440000' }))
    fetchSpy.mockClear()
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(eventBodies().filter((b) => b.action === 'dwell')).toHaveLength(1)
  })

  it('does not fire any telemetry while enabled=false (e.g. loading skeleton)', () => {
    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => useStoryTelemetry({ storyId: '550e8400-e29b-41d4-a716-446655440000', enabled }),
      { initialProps: { enabled: false } }
    )
    // While disabled, the immediate scrollable<=0 check must not run.
    expect(eventBodies()).toHaveLength(0)

    // Once enabled, view + read_through fire as usual.
    rerender({ enabled: true })
    expect(eventBodies().some((b) => b.action === 'view')).toBe(true)
    expect(eventBodies().some((b) => b.action === 'read_through')).toBe(true)

    unmount()
  })

  it('does not fire telemetry for non-UUID story ids (sample-data fallback)', () => {
    renderHook(() => useStoryTelemetry({ storyId: 'a1' }))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not flush dwell when consent is revoked mid-session', () => {
    const { rerender, unmount } = renderHook(() => useStoryTelemetry({ storyId: '550e8400-e29b-41d4-a716-446655440000' }))
    fetchSpy.mockClear()

    // Simulate consent revocation from another tab — useTelemetryConsent
    // returns false on next render, the effect tears down, cleanup runs.
    mockConsent.mockReturnValue(false)
    rerender()
    unmount()

    const dwells = eventBodies().filter((b) => b.action === 'dwell')
    expect(dwells).toHaveLength(0)
  })

  it('uses sendBeacon for dwell when available', () => {
    const beaconSpy = vi.fn(() => true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beaconSpy,
      writable: true,
      configurable: true,
    })
    const { unmount } = renderHook(() => useStoryTelemetry({ storyId: '550e8400-e29b-41d4-a716-446655440000' }))
    unmount()
    expect(beaconSpy).toHaveBeenCalledWith('/api/events/story', expect.any(Blob))
  })
})
