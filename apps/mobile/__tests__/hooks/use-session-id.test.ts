import { renderHook, waitFor } from '@testing-library/react-native'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}))

import * as SecureStore from 'expo-secure-store'
import { useSessionId, __testing } from '@/lib/hooks/use-session-id'

const getItem = SecureStore.getItemAsync as jest.Mock
const setItem = SecureStore.setItemAsync as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useSessionId', () => {
  it('reuses an existing session id when within the rotation window', async () => {
    const now = Date.now()
    getItem.mockImplementation((key: string) => {
      if (key === __testing.SESSION_KEY) return Promise.resolve('existing-uuid')
      if (key === __testing.SESSION_CREATED_KEY) return Promise.resolve(String(now))
      return Promise.resolve(null)
    })
    setItem.mockResolvedValue(undefined)

    const { result } = renderHook(() => useSessionId())
    await waitFor(() => {
      expect(result.current.ready).toBe(true)
    })
    expect(result.current.sessionId).toBe('existing-uuid')
    expect(setItem).not.toHaveBeenCalled()
  })

  it('rotates the session id after 7 days', async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    getItem.mockImplementation((key: string) => {
      if (key === __testing.SESSION_KEY) return Promise.resolve('stale-uuid')
      if (key === __testing.SESSION_CREATED_KEY) return Promise.resolve(String(eightDaysAgo))
      return Promise.resolve(null)
    })
    setItem.mockResolvedValue(undefined)

    const { result } = renderHook(() => useSessionId())
    await waitFor(() => {
      expect(result.current.ready).toBe(true)
    })
    expect(result.current.sessionId).not.toBe('stale-uuid')
    expect(setItem).toHaveBeenCalledWith(__testing.SESSION_KEY, expect.any(String))
    expect(setItem).toHaveBeenCalledWith(__testing.SESSION_CREATED_KEY, expect.any(String))
  })

  it('mints a fresh id on first run', async () => {
    getItem.mockResolvedValue(null)
    setItem.mockResolvedValue(undefined)

    const { result } = renderHook(() => useSessionId())
    await waitFor(() => {
      expect(result.current.ready).toBe(true)
    })
    expect(result.current.sessionId).toMatch(/[0-9a-f-]{10,}/)
    expect(setItem).toHaveBeenCalled()
  })

  it('falls back to memory-only id when secure store throws', async () => {
    __testing.resetFallbackSessionId()
    getItem.mockRejectedValue(new Error('secure store unavailable'))
    setItem.mockRejectedValue(new Error('secure store unavailable'))

    const { result } = renderHook(() => useSessionId())
    await waitFor(() => {
      expect(result.current.ready).toBe(true)
    })
    expect(result.current.sessionId).toMatch(/[0-9a-f-]{10,}/)
  })

  it('serializes concurrent first-open calls so all hooks see the same id', async () => {
    __testing.resetFallbackSessionId()
    __testing.resetInflightLoad()
    // Empty store, slow read+write — simulates the SecureStore race.
    let stored: string | null = null
    let storedAt: string | null = null
    getItem.mockImplementation((key: string) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (key === __testing.SESSION_KEY) resolve(stored)
          else if (key === __testing.SESSION_CREATED_KEY) resolve(storedAt)
          else resolve(null)
        }, 5)
      })
    })
    setItem.mockImplementation((key: string, value: string) => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          if (key === __testing.SESSION_KEY) stored = value
          if (key === __testing.SESSION_CREATED_KEY) storedAt = value
          resolve()
        }, 5)
      })
    })

    // Three concurrent hook callers — should all settle on one id.
    const { result: a } = renderHook(() => useSessionId())
    const { result: b } = renderHook(() => useSessionId())
    const { result: c } = renderHook(() => useSessionId())
    await waitFor(() => {
      expect(a.current.ready && b.current.ready && c.current.ready).toBe(true)
    })
    expect(a.current.sessionId).toBe(b.current.sessionId)
    expect(b.current.sessionId).toBe(c.current.sessionId)
    expect(a.current.sessionId).toBeTruthy()
    // SecureStore.setItemAsync should have been called at most twice
    // (once for the id, once for the created-at) regardless of caller
    // count — proves we did not write three separate ids.
    const idWrites = setItem.mock.calls.filter((c) => c[0] === __testing.SESSION_KEY)
    expect(idWrites.length).toBeLessThanOrEqual(1)
  })

  it('reuses a single fallback id across multiple hook callers in the same process', async () => {
    __testing.resetFallbackSessionId()
    getItem.mockRejectedValue(new Error('secure store unavailable'))
    setItem.mockRejectedValue(new Error('secure store unavailable'))

    const { result: a } = renderHook(() => useSessionId())
    const { result: b } = renderHook(() => useSessionId())
    await waitFor(() => {
      expect(a.current.ready && b.current.ready).toBe(true)
    })
    expect(a.current.sessionId).toBe(b.current.sessionId)
  })
})

describe('generateUuid (helper)', () => {
  it('always produces a non-empty string with dashes', () => {
    const id = __testing.generateUuid()
    expect(id.length).toBeGreaterThan(10)
    expect(id).toContain('-')
  })

  it('produces distinct ids on successive calls', () => {
    const a = __testing.generateUuid()
    const b = __testing.generateUuid()
    expect(a).not.toBe(b)
  })
})
