/**
 * lib/hooks/use-story-telemetry.ts — Engagement events for the web story
 * detail page. Mirrors apps/mobile/lib/hooks/use-story-telemetry.ts.
 *
 * Web specifics:
 *   - Session id ships in the cookie, set by middleware. We do not need
 *     to forward it as a header — fetch with `credentials: 'same-origin'`
 *     carries it automatically.
 *   - Dwell flushes on `pagehide` and `visibilitychange:hidden` so we
 *     catch the user navigating to a different tab or closing the tab,
 *     not just unmount.
 *   - Read-through fires when the document scroll fraction crosses 0.8.
 *     We listen with a passive scroll handler — the calculation is one
 *     subtraction and one division, no rAF batching needed.
 */

'use client'

import { useEffect, useRef } from 'react'
import { useTelemetryConsent } from '@/lib/hooks/use-telemetry-consent'

const READ_THROUGH_FRACTION = 0.8
const TELEMETRY_ENDPOINT = '/api/events/story'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TelemetryReferrerKind = 'feed' | 'for_you' | 'search' | 'direct' | 'external'

export interface StoryTelemetryInput {
  readonly storyId: string
  readonly referrerKind?: TelemetryReferrerKind
  /**
   * Defer telemetry until the story is actually mounted and rendered.
   * Pass `false` while a loading skeleton is on screen — otherwise the
   * skeleton's `min-h-screen` wrapper makes `scrollable <= 0` and the
   * "page is shorter than viewport" branch fires a spurious read_through
   * before the real article ever arrives.
   */
  readonly enabled?: boolean
}

export function dwellBucketForMs(elapsedMs: number): number {
  if (elapsedMs < 5_000) return 0
  if (elapsedMs < 30_000) return 1
  if (elapsedMs < 120_000) return 2
  return 3
}

interface PostInput {
  readonly storyId: string
  readonly action: 'view' | 'dwell' | 'read_through' | 'share'
  readonly dwellBucket?: number
  readonly referrerKind?: TelemetryReferrerKind
}

function postEvent(input: PostInput): void {
  const body = JSON.stringify({
    storyId: input.storyId,
    action: input.action,
    client: 'web' as const,
    ...(typeof input.dwellBucket === 'number' ? { dwellBucket: input.dwellBucket } : {}),
    ...(input.referrerKind ? { referrerKind: input.referrerKind } : {}),
  })

  // Prefer sendBeacon for the dwell path so the request survives the
  // pagehide window. Fall back to fetch keepalive for browsers that lack
  // it or refuse the JSON Blob.
  if (input.action === 'dwell' && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon(TELEMETRY_ENDPOINT, blob)) return
    } catch {
      // fall through to fetch
    }
  }

  try {
    // Always chain a `.catch` here: telemetry must be best-effort, and a
    // bare `void fetch(...)` surfaces an unhandled rejection in the
    // offline / blocked-request paths the PWA actively supports.
    fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {})
  } catch {
    // best-effort
  }
}

export function useStoryTelemetry(input: StoryTelemetryInput): void {
  const { storyId, referrerKind, enabled = true } = input
  const consent = useTelemetryConsent()
  // UUID guard: the route's Zod schema rejects non-UUID story ids, so a
  // non-UUID (sample data fallback like `a1`, a stale shared URL, etc.)
  // would otherwise produce 400s on every view/dwell/read_through. The
  // page-level `enabled` flag already covers the not-found path; this is
  // a belt-and-braces gate inside the hook itself.
  const active = consent && enabled && UUID_REGEX.test(storyId)

  const enteredAtRef = useRef<number | null>(null)
  const viewSentRef = useRef(false)
  const readThroughSentRef = useRef(false)
  const dwellSentRef = useRef(false)
  // Live mirror of `active`. The dwell effect's cleanup needs to read
  // the *current* consent at flush time, not the captured-at-effect-
  // creation snapshot — otherwise a multi-tab consent revocation would
  // tear down the effect and the cleanup would still post a final
  // dwell after the user has revoked consent.
  const activeRef = useRef(active)
  activeRef.current = active

  // view event — fires once per mount, gated by consent.
  useEffect(() => {
    if (!active || viewSentRef.current) return
    // Server short-circuit: even without DNT in the navigator object the
    // server may have advertised it via x-axiom-dnt; the route layer
    // re-checks the request header so a stale client snapshot can't
    // bypass the user's preference.
    viewSentRef.current = true
    enteredAtRef.current = Date.now()
    postEvent({ storyId, action: 'view', referrerKind })
  }, [active, storyId, referrerKind])

  // read_through — passive scroll listener.
  useEffect(() => {
    if (!active) return

    function handleScroll() {
      if (readThroughSentRef.current) return
      if (typeof document === 'undefined') return
      const doc = document.documentElement
      const scrollTop = window.scrollY || doc.scrollTop || 0
      const scrollable = (doc.scrollHeight || 0) - (window.innerHeight || 0)
      if (scrollable <= 0) {
        // Page is shorter than the viewport — count as read-through.
        readThroughSentRef.current = true
        postEvent({ storyId, action: 'read_through', referrerKind })
        return
      }
      if (scrollTop / scrollable >= READ_THROUGH_FRACTION) {
        readThroughSentRef.current = true
        postEvent({ storyId, action: 'read_through', referrerKind })
      }
    }

    handleScroll() // immediate check for short pages
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [active, storyId, referrerKind])

  // dwell — accumulate active foreground time and flush once on
  // pagehide or unmount. Tab-switch / visibilitychange:hidden pauses
  // the timer (we add the active span to a running total); switching
  // back to the tab resumes it. Without this, a multitasking reader
  // who tab-switches mid-article would have their dwell cut short and
  // never resumed, systematically undercounting engagement.
  useEffect(() => {
    if (!active) return

    let activeSinceMs: number | null = Date.now()
    let accumulatedMs = 0

    function pause() {
      if (activeSinceMs === null) return
      accumulatedMs += Date.now() - activeSinceMs
      activeSinceMs = null
    }

    function resume() {
      if (activeSinceMs === null) activeSinceMs = Date.now()
    }

    function flushDwell() {
      if (dwellSentRef.current) return
      pause()
      // Re-check consent at flush time. If `active` flipped false (e.g.
      // user revoked consent in another tab via the localStorage
      // opt-out), the cleanup still runs but we must not post.
      if (!activeRef.current) {
        dwellSentRef.current = true
        return
      }
      dwellSentRef.current = true
      postEvent({
        storyId,
        action: 'dwell',
        dwellBucket: dwellBucketForMs(accumulatedMs),
        referrerKind,
      })
    }

    function handleVisibility() {
      if (document.visibilityState === 'hidden') pause()
      else resume()
    }

    window.addEventListener('pagehide', flushDwell)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      flushDwell()
      window.removeEventListener('pagehide', flushDwell)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [active, storyId, referrerKind])
}
