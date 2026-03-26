import { renderHook, act } from '@testing-library/react-native'
import { useDebounce } from '@/lib/hooks/use-debounce'

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 500))

    expect(result.current).toBe('hello')
  })

  it('does not update value before delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: any; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    rerender({ value: 'updated', delay: 500 })

    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(result.current).toBe('initial')
  })

  it('updates value after delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: any; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    rerender({ value: 'updated', delay: 500 })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current).toBe('updated')
  })

  it('resets timer when value changes during delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: any; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: 'first', delay: 500 } }
    )

    rerender({ value: 'second', delay: 500 })

    act(() => {
      jest.advanceTimersByTime(300)
    })

    rerender({ value: 'third', delay: 500 })

    act(() => {
      jest.advanceTimersByTime(300)
    })

    // 'second' should never have appeared; still waiting for 'third'
    expect(result.current).toBe('first')

    act(() => {
      jest.advanceTimersByTime(200)
    })

    expect(result.current).toBe('third')
  })

  it('works with numeric values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: any; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 300 } }
    )

    expect(result.current).toBe(0)

    rerender({ value: 42, delay: 300 })

    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(result.current).toBe(42)
  })

  it('respects different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: any; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 1000 } }
    )

    rerender({ value: 'b', delay: 1000 })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current).toBe('a')

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current).toBe('b')
  })
})
