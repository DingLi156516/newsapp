import { renderHook, waitFor, act } from '@testing-library/react-native'
import { AppState } from 'react-native'

jest.mock('@/lib/hooks/fetcher', () => ({
  authFetch: jest.fn(() => Promise.resolve({ ok: true })),
}))

jest.mock('@/lib/hooks/use-session-id', () => ({
  useSessionId: jest.fn(() => ({ sessionId: 'sess-1', ready: true })),
}))

jest.mock('@/lib/hooks/use-telemetry-consent', () => ({
  useTelemetryConsent: jest.fn(() => ({ consent: true, ready: true })),
}))

import { authFetch } from '@/lib/hooks/fetcher'
import { useSessionId } from '@/lib/hooks/use-session-id'
import { useTelemetryConsent } from '@/lib/hooks/use-telemetry-consent'
import { dwellBucketForMs, useStoryTelemetry } from '@/lib/hooks/use-story-telemetry'

const mockFetch = authFetch as jest.Mock
const mockUseSession = useSessionId as jest.Mock
const mockUseConsent = useTelemetryConsent as jest.Mock

function makeScrollY(value: number) {
  return { value } as { value: number }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseSession.mockReturnValue({ sessionId: 'sess-1', ready: true })
  mockUseConsent.mockReturnValue({ consent: true, ready: true })
})

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
  it('fires a single view event on mount', async () => {
    renderHook(() =>
      useStoryTelemetry({
        storyId: '550e8400-e29b-41d4-a716-446655440000',
        scrollY: makeScrollY(0) as never,
        contentHeight: 1000,
        viewportHeight: 600,
      })
    )
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    const viewCalls = mockFetch.mock.calls.filter((c) => JSON.parse(c[1].body).action === 'view')
    expect(viewCalls).toHaveLength(1)
    expect(JSON.parse(viewCalls[0][1].body)).toMatchObject({
      storyId: '550e8400-e29b-41d4-a716-446655440000',
      action: 'view',
      client: 'mobile',
    })
    expect(viewCalls[0][1].headers['x-session-id']).toBe('sess-1')
  })

  it('does not fire any events when consent is denied', async () => {
    mockUseConsent.mockReturnValue({ consent: false, ready: true })
    const { unmount } = renderHook(() =>
      useStoryTelemetry({
        storyId: '550e8400-e29b-41d4-a716-446655440000',
        scrollY: makeScrollY(0) as never,
        contentHeight: 1000,
        viewportHeight: 600,
      })
    )
    unmount()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not fire any events while session is not ready', async () => {
    mockUseSession.mockReturnValue({ sessionId: null, ready: false })
    renderHook(() =>
      useStoryTelemetry({
        storyId: '550e8400-e29b-41d4-a716-446655440000',
        scrollY: makeScrollY(0) as never,
        contentHeight: 1000,
        viewportHeight: 600,
      })
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fires a dwell event on unmount with the correct bucket', async () => {
    const { unmount } = renderHook(() =>
      useStoryTelemetry({
        storyId: '550e8400-e29b-41d4-a716-446655440000',
        scrollY: makeScrollY(0) as never,
        contentHeight: 1000,
        viewportHeight: 600,
      })
    )
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    unmount()

    const dwellCalls = mockFetch.mock.calls.filter((c) => JSON.parse(c[1].body).action === 'dwell')
    expect(dwellCalls).toHaveLength(1)
    const body = JSON.parse(dwellCalls[0][1].body)
    expect(body.dwellBucket).toBe(0) // mounted and immediately unmounted
  })

  it('pauses (does not finalize) dwell on AppState background', async () => {
    let listener: ((status: string) => void) | undefined
    const subscription = { remove: jest.fn() }
    const addSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event, cb) => {
        if (event === 'change') listener = cb as (status: string) => void
        return subscription as never
      })

    renderHook(() =>
      useStoryTelemetry({
        storyId: '550e8400-e29b-41d4-a716-446655440000',
        scrollY: makeScrollY(0) as never,
        contentHeight: 1000,
        viewportHeight: 600,
      })
    )
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    act(() => {
      listener?.('background')
    })

    // Background alone does NOT flush — backgrounded readers commonly
    // come back to finish the article. Dwell is sent only on unmount.
    const dwellCalls = mockFetch.mock.calls.filter((c) => JSON.parse(c[1].body).action === 'dwell')
    expect(dwellCalls).toHaveLength(0)
    addSpy.mockRestore()
  })

  it('flushes dwell exactly once after a background → active → unmount cycle', async () => {
    let listener: ((status: string) => void) | undefined
    const subscription = { remove: jest.fn() }
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'change') listener = cb as (status: string) => void
      return subscription as never
    })

    const { unmount } = renderHook(() =>
      useStoryTelemetry({
        storyId: '550e8400-e29b-41d4-a716-446655440000',
        scrollY: makeScrollY(0) as never,
        contentHeight: 1000,
        viewportHeight: 600,
      })
    )
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    act(() => {
      listener?.('background')
    })
    act(() => {
      listener?.('active')
    })
    unmount()

    const dwellCalls = mockFetch.mock.calls.filter((c) => JSON.parse(c[1].body).action === 'dwell')
    expect(dwellCalls).toHaveLength(1)
  })
})
