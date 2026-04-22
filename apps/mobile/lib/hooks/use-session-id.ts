/**
 * apps/mobile/lib/hooks/use-session-id.ts — Opaque rotating session id
 * for engagement telemetry on mobile.
 *
 * Mirrors the web `axiom_session` cookie: a UUID v4, rotated every 7 days,
 * stored in expo-secure-store. Cookies on React Native are unreliable
 * across the Expo bridge, so the mobile client passes the id explicitly
 * via the `x-session-id` header on every event POST.
 *
 * The id is derived from no per-user input (no auth uid, no device id,
 * no IDFA). It is a pseudonym the server cannot reverse.
 */

import { useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'

const SESSION_KEY = 'axiom_session'
const SESSION_CREATED_KEY = 'axiom_session_created_at'
const ROTATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function generateUuid(): string {
  // Hermes/JSC: crypto.randomUUID is available on modern RN, fall back to a
  // short manual RFC4122 v4 if a host is missing it. Math.random is OK here
  // because the id is a 7-day-rotating pseudonym, not an auth secret. Call
  // through `cryptoRef.randomUUID()` (not a detached reference) so the
  // implementation receives the correct `this` binding on Node + Hermes.
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID()
  }
  const random = (n: number) => Math.floor(Math.random() * n)
  const hex = (n: number, len: number) => n.toString(16).padStart(len, '0')
  const part = (bytes: number) => hex(random(2 ** (bytes * 4)), bytes)
  return `${part(8)}-${part(4)}-4${part(3)}-${(8 + random(4)).toString(16)}${part(3)}-${part(12)}`
}

interface SessionIdState {
  readonly sessionId: string | null
  readonly ready: boolean
}

// Process-scoped fallback id. When SecureStore is unavailable the first
// caller mints an in-memory UUID; every subsequent caller (e.g. both
// useStoryTelemetry and ShareButton on the same story screen) reuses it
// so dwell/view/share events from the same reader dedupe by session_id
// within the app process.
let fallbackSessionId: string | null = null

function getFallbackSessionId(): string {
  if (!fallbackSessionId) fallbackSessionId = generateUuid()
  return fallbackSessionId
}

// In-flight load promise. On the first story screen open multiple hooks
// (useStoryTelemetry plus the back-button + sticky-header ShareButtons)
// mount in parallel. Without serialization each one races
// `loadOrRotate`: they all see an empty SecureStore, each mints a
// different UUID, and the same reader splits into N "unique viewers".
// We cache the first call's promise so every concurrent caller awaits
// the same outcome — and write happens at most once.
let inflightLoad: Promise<string> | null = null

function loadOrRotateOnce(now: number): Promise<string> {
  if (!inflightLoad) {
    inflightLoad = loadOrRotate(now).finally(() => {
      // Clear after settle so a future rotation (e.g. 7 days later)
      // can reload via a fresh promise.
      inflightLoad = null
    })
  }
  return inflightLoad
}

async function loadOrRotate(now: number): Promise<string> {
  const existingId = await SecureStore.getItemAsync(SESSION_KEY)
  const createdAtRaw = await SecureStore.getItemAsync(SESSION_CREATED_KEY)
  const createdAt = createdAtRaw ? Number(createdAtRaw) : 0

  if (existingId && Number.isFinite(createdAt) && now - createdAt < ROTATION_MS) {
    return existingId
  }

  const next = generateUuid()
  await SecureStore.setItemAsync(SESSION_KEY, next)
  await SecureStore.setItemAsync(SESSION_CREATED_KEY, String(now))
  return next
}

export function useSessionId(): SessionIdState {
  const [state, setState] = useState<SessionIdState>({ sessionId: null, ready: false })

  useEffect(() => {
    let cancelled = false
    loadOrRotateOnce(Date.now())
      .then((id) => {
        if (!cancelled) setState({ sessionId: id, ready: true })
      })
      .catch(() => {
        // Secure store unavailable — fall back to the process-scoped id
        // so this screen's events still dedupe with any sibling hook
        // call (e.g. ShareButton) within the same app process.
        if (!cancelled) setState({ sessionId: getFallbackSessionId(), ready: true })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

export const __testing = {
  generateUuid,
  loadOrRotate,
  loadOrRotateOnce,
  getFallbackSessionId,
  resetFallbackSessionId: () => {
    fallbackSessionId = null
  },
  resetInflightLoad: () => {
    inflightLoad = null
  },
  ROTATION_MS,
  SESSION_KEY,
  SESSION_CREATED_KEY,
}
