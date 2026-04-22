/**
 * lib/hooks/use-telemetry-consent.ts — Resolve telemetry opt-in for the
 * current visitor.
 *
 * Returns `false` (consent denied) whenever any of the following holds:
 *   - `navigator.doNotTrack === '1'` — DOM bit set by the user agent
 *   - `localStorage['axiom_telemetry_opt_out'] === 'true'` — settings toggle
 *
 * The corresponding HTTP `DNT: 1` header is also honored at the route
 * layer; we duplicate the DNT check on the client because Safari strips
 * the header but exposes the DOM property, and vice versa for some
 * privacy extensions. Belt and braces — privacy is the only place we
 * pay twice for the same check.
 */

'use client'

import { useEffect, useState } from 'react'

export const TELEMETRY_OPT_OUT_KEY = 'axiom_telemetry_opt_out'

// In-process listener set for same-tab consent changes. `storage` events
// only fire in *other* tabs on `localStorage.setItem`, so without this
// pub/sub a user who flips the toggle in SettingsForm would not
// propagate the change to already-mounted useStoryTelemetry /
// ShareButton hooks in the same document until a full reload.
const consentListeners = new Set<() => void>()

function notifyConsentListeners(): void {
  for (const listener of Array.from(consentListeners)) listener()
}

function readConsent(): boolean {
  if (typeof window === 'undefined') return false
  if (window.navigator?.doNotTrack === '1') return false
  try {
    if (window.localStorage.getItem(TELEMETRY_OPT_OUT_KEY) === 'true') return false
  } catch {
    // localStorage unavailable (private mode, blocked) — default to consenting.
  }
  return true
}

export function useTelemetryConsent(): boolean {
  // Lazy initial state: read consent on the first client render so the
  // value the consumers (useStoryTelemetry, ShareButton) see in their
  // first effect-pass is already correct. A naive `useState(true)` would
  // emit `view`/`share` events for opted-out users in the gap between
  // mount and the consent effect resyncing — the route does re-check the
  // DNT *header*, but it cannot see a `localStorage` opt-out.
  // SSR returns false (no window), which is privacy-safe and matches the
  // hydration model: nothing visible renders based on consent, so there is
  // no markup mismatch.
  const [consent, setConsent] = useState<boolean>(() => readConsent())

  useEffect(() => {
    // Re-sync after hydration in case any of the signals changed between
    // initial paint and mount (rare, but keeps the storage listener path
    // consistent).
    setConsent(readConsent())

    function handleChange() {
      setConsent(readConsent())
    }
    function handleStorage(event: StorageEvent) {
      if (event.key === TELEMETRY_OPT_OUT_KEY) handleChange()
    }

    // Same-tab changes: subscribe to the in-process pub/sub.
    // Cross-tab changes: the browser's `storage` event.
    consentListeners.add(handleChange)
    window.addEventListener('storage', handleStorage)
    return () => {
      consentListeners.delete(handleChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return consent
}

export function setTelemetryOptOut(optOut: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (optOut) {
      window.localStorage.setItem(TELEMETRY_OPT_OUT_KEY, 'true')
    } else {
      window.localStorage.removeItem(TELEMETRY_OPT_OUT_KEY)
    }
    // Fire the same-tab listener set. `storage` events only reach *other*
    // tabs/documents, so without this notify already-mounted hooks in
    // this tab would keep their stale consent snapshot.
    notifyConsentListeners()
  } catch {
    // Best-effort — settings UI handles the user-facing failure path.
  }
}

export function getTelemetryOptOut(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(TELEMETRY_OPT_OUT_KEY) === 'true'
  } catch {
    return false
  }
}
