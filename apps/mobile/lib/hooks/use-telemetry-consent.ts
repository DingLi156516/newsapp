/**
 * apps/mobile/lib/hooks/use-telemetry-consent.ts — Resolve telemetry
 * opt-in for the current device.
 *
 * Returns `false` when the user has flipped off "Share anonymous engagement"
 * in the profile tab (persisted via AsyncStorage so the read is sync-fast
 * during the story screen mount path). iOS App Tracking Transparency hooks
 * land in a follow-up — we keep this consent surface device-local for now
 * and rely on the docs/phase3-privacy-audit.md callout.
 */

import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const TELEMETRY_OPT_OUT_KEY = 'axiom_telemetry_opt_out'

interface ConsentState {
  readonly consent: boolean
  readonly ready: boolean
}

// In-process pub/sub for consent changes. AsyncStorage has no event API,
// so without this a sibling `useTelemetryConsent` consumer (for example
// a ShareButton already mounted on the same screen as the consent
// toggle) would keep a stale `consent=true` snapshot after the user
// flips the toggle off — a real privacy bug on the Profile tab where
// both live side-by-side.
const consentListeners = new Set<() => void>()

function notifyConsentListeners(): void {
  // Snapshot the set so a listener unsubscribing during notify doesn't
  // mutate the iteration source.
  for (const listener of Array.from(consentListeners)) listener()
}

export async function readOptOut(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(TELEMETRY_OPT_OUT_KEY)
    return value === 'true'
  } catch {
    return false
  }
}

export async function writeOptOut(optOut: boolean): Promise<void> {
  try {
    if (optOut) {
      await AsyncStorage.setItem(TELEMETRY_OPT_OUT_KEY, 'true')
    } else {
      await AsyncStorage.removeItem(TELEMETRY_OPT_OUT_KEY)
    }
    notifyConsentListeners()
  } catch {
    // No-op: surface UI handles its own error state.
  }
}

export function useTelemetryConsent(): ConsentState {
  const [state, setState] = useState<ConsentState>({ consent: true, ready: false })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const optOut = await readOptOut()
      if (!cancelled) setState({ consent: !optOut, ready: true })
    }
    void load()

    // Re-read whenever any caller invokes writeOptOut. Fires in-process
    // — cross-process consent is not a concern on native since we only
    // have one app instance.
    const listener = () => {
      void load()
    }
    consentListeners.add(listener)
    return () => {
      cancelled = true
      consentListeners.delete(listener)
    }
  }, [])

  return state
}
