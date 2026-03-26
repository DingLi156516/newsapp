import { renderHook, act } from '@testing-library/react-native'
import { useToastProvider } from '@/lib/hooks/use-toast'

describe('useToastProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('showToast sets toast state', () => {
    const { result } = renderHook(() => useToastProvider())

    act(() => {
      result.current.showToast({ message: 'Hello', variant: 'info' })
    })

    expect(result.current.toast).not.toBeNull()
    expect(result.current.toast?.message).toBe('Hello')
    expect(result.current.toast?.variant).toBe('info')
  })

  it('dismissToast clears toast', () => {
    const { result } = renderHook(() => useToastProvider())

    act(() => {
      result.current.showToast({ message: 'Hello' })
    })
    expect(result.current.toast).not.toBeNull()

    act(() => {
      result.current.dismissToast()
    })
    expect(result.current.toast).toBeNull()
  })

  it('auto-dismisses after 3 seconds', () => {
    const { result } = renderHook(() => useToastProvider())

    act(() => {
      result.current.showToast({ message: 'Auto' })
    })
    expect(result.current.toast).not.toBeNull()

    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(result.current.toast).toBeNull()
  })

  it('uses 5 second timeout when onUndo is provided', () => {
    const { result } = renderHook(() => useToastProvider())

    act(() => {
      result.current.showToast({ message: 'Undo me', onUndo: jest.fn() })
    })

    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(result.current.toast).not.toBeNull()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(result.current.toast).toBeNull()
  })
})
