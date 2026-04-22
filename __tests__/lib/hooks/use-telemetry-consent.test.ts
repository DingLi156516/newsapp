import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  useTelemetryConsent,
  setTelemetryOptOut,
  getTelemetryOptOut,
  TELEMETRY_OPT_OUT_KEY,
} from '@/lib/hooks/use-telemetry-consent'

describe('useTelemetryConsent', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(window.navigator, 'doNotTrack', {
      value: '0',
      configurable: true,
    })
  })

  it('returns true when neither DNT nor opt-out is set', () => {
    const { result } = renderHook(() => useTelemetryConsent())
    expect(result.current).toBe(true)
  })

  it('returns false when navigator.doNotTrack is "1"', () => {
    Object.defineProperty(window.navigator, 'doNotTrack', {
      value: '1',
      configurable: true,
    })
    const { result } = renderHook(() => useTelemetryConsent())
    expect(result.current).toBe(false)
  })

  it('returns false when opt-out flag is set in localStorage', () => {
    window.localStorage.setItem(TELEMETRY_OPT_OUT_KEY, 'true')
    const { result } = renderHook(() => useTelemetryConsent())
    expect(result.current).toBe(false)
  })

  it('reacts to a storage event on the opt-out key', () => {
    const { result } = renderHook(() => useTelemetryConsent())
    expect(result.current).toBe(true)

    act(() => {
      window.localStorage.setItem(TELEMETRY_OPT_OUT_KEY, 'true')
      window.dispatchEvent(
        new StorageEvent('storage', { key: TELEMETRY_OPT_OUT_KEY, newValue: 'true' })
      )
    })
    expect(result.current).toBe(false)
  })
})

describe('setTelemetryOptOut / getTelemetryOptOut', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('writes and reads the opt-out flag', () => {
    expect(getTelemetryOptOut()).toBe(false)
    setTelemetryOptOut(true)
    expect(getTelemetryOptOut()).toBe(true)
    setTelemetryOptOut(false)
    expect(getTelemetryOptOut()).toBe(false)
  })

  it('propagates same-tab changes to already-mounted useTelemetryConsent consumers', () => {
    const { result } = renderHook(() => useTelemetryConsent())
    expect(result.current).toBe(true)

    act(() => {
      setTelemetryOptOut(true)
    })
    expect(result.current).toBe(false)

    act(() => {
      setTelemetryOptOut(false)
    })
    expect(result.current).toBe(true)
  })
})
