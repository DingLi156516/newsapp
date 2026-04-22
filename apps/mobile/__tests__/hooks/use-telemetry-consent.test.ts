import { renderHook, waitFor, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  useTelemetryConsent,
  readOptOut,
  writeOptOut,
  TELEMETRY_OPT_OUT_KEY,
} from '@/lib/hooks/use-telemetry-consent'

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('useTelemetryConsent', () => {
  it('returns consent=true when no opt-out flag is stored', async () => {
    const { result } = renderHook(() => useTelemetryConsent())
    await waitFor(() => {
      expect(result.current.ready).toBe(true)
    })
    expect(result.current.consent).toBe(true)
  })

  it('returns consent=false when the opt-out flag is set', async () => {
    await AsyncStorage.setItem(TELEMETRY_OPT_OUT_KEY, 'true')
    const { result } = renderHook(() => useTelemetryConsent())
    await waitFor(() => {
      expect(result.current.ready).toBe(true)
    })
    expect(result.current.consent).toBe(false)
  })
})

describe('readOptOut / writeOptOut', () => {
  it('round-trips the opt-out flag', async () => {
    expect(await readOptOut()).toBe(false)
    await writeOptOut(true)
    expect(await readOptOut()).toBe(true)
    await writeOptOut(false)
    expect(await readOptOut()).toBe(false)
  })

  it('writeOptOut notifies already-mounted consumers', async () => {
    const { result } = renderHook(() => useTelemetryConsent())
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.consent).toBe(true)

    await act(async () => {
      await writeOptOut(true)
    })
    await waitFor(() => expect(result.current.consent).toBe(false))

    await act(async () => {
      await writeOptOut(false)
    })
    await waitFor(() => expect(result.current.consent).toBe(true))
  })
})
