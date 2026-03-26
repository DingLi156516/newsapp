import { renderHook, act } from '@testing-library/react'
import { useOnline } from '@/lib/hooks/use-online'

describe('useOnline', () => {
  it('returns true when browser is online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    const { result } = renderHook(() => useOnline())
    expect(result.current.isOnline).toBe(true)
  })

  it('syncs to false when browser is offline after mount', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    const { result } = renderHook(() => useOnline())
    // useEffect syncs navigator.onLine after hydration-safe initial render
    expect(result.current.isOnline).toBe(false)
  })

  it('updates to false on offline event', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    const { result } = renderHook(() => useOnline())

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isOnline).toBe(false)
  })

  it('updates to true on online event', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    const { result } = renderHook(() => useOnline())

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current.isOnline).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current.isOnline).toBe(true)
  })
})
