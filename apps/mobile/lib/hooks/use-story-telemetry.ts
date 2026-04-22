/**
 * apps/mobile/lib/hooks/use-story-telemetry.ts — Engagement events for the
 * story detail screen.
 *
 * Fires on three lifecycle moments:
 *   1. Mount: a single `view` event so unique-viewers metrics see the open.
 *   2. Read-through: when scroll fraction >= 0.8 (computed off the
 *      reanimated shared value), exactly one `read_through` event.
 *   3. Unmount or backgrounded app: a `dwell` event with the elapsed
 *      bucket (0..3). The unmount path is the primary signal; AppState
 *      backgrounding is the safety net for users who swipe up to Home
 *      without using the back button.
 *
 * All events go through `authFetch` so the Bearer token (mobile auth) is
 * attached when the user is signed in. Session id ships in the
 * `x-session-id` header on every request because RN cookies are unreliable
 * across the bridge.
 */

import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import {
  useAnimatedReaction,
  useSharedValue,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated'
import { authFetch } from '@/lib/hooks/fetcher'
import { useSessionId } from '@/lib/hooks/use-session-id'
import { useTelemetryConsent } from '@/lib/hooks/use-telemetry-consent'

const READ_THROUGH_FRACTION = 0.8
const TELEMETRY_ENDPOINT = '/api/events/story'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TelemetryReferrerKind = 'feed' | 'for_you' | 'search' | 'direct' | 'external'

export interface StoryTelemetryInput {
  readonly storyId: string
  readonly scrollY: SharedValue<number>
  readonly contentHeight: number
  readonly viewportHeight: number
  readonly referrerKind?: TelemetryReferrerKind
  /**
   * Defer telemetry until the story has actually loaded. Pass `false`
   * while the loading spinner is on screen — otherwise the hook would
   * record `view`/`dwell` for time the user spent staring at a spinner
   * (slow network, invalid id, 404), which inflates Hot Now and the
   * trending engagement factor with non-engagement events.
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
  readonly sessionId: string
  readonly client: 'mobile'
  readonly dwellBucket?: number
  readonly referrerKind?: TelemetryReferrerKind
}

async function postEvent(input: PostInput): Promise<void> {
  try {
    await authFetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: { 'x-session-id': input.sessionId },
      body: JSON.stringify({
        storyId: input.storyId,
        action: input.action,
        client: input.client,
        ...(typeof input.dwellBucket === 'number' ? { dwellBucket: input.dwellBucket } : {}),
        ...(input.referrerKind ? { referrerKind: input.referrerKind } : {}),
      }),
    })
  } catch {
    // Telemetry is best-effort. A dropped event must never block the
    // story screen or surface as a user-facing error.
  }
}

export function useStoryTelemetry(input: StoryTelemetryInput): void {
  const { storyId, scrollY, contentHeight, viewportHeight, referrerKind, enabled = true } = input
  const { sessionId, ready: sessionReady } = useSessionId()
  const { consent, ready: consentReady } = useTelemetryConsent()

  const enteredAtRef = useRef<number | null>(null)
  const viewSentRef = useRef(false)
  const dwellSentRef = useRef(false)
  // Use a SharedValue (UI-thread state) for the read-through guard. The
  // useAnimatedReaction body below runs as a worklet on the UI thread —
  // mutating a JS ref from inside a worklet is unsupported and produces
  // either a duplicate event (the read isn't atomic) or a worklet
  // mutation error. SharedValue is the right abstraction for state read
  // and written from the UI thread.
  const readThroughSent = useSharedValue<boolean>(false)

  // Compose all gate signals into one boolean:
  //   - `enabled` (caller-provided) covers the article-loaded condition;
  //   - `sessionReady`/`consentReady` cover async hydration of those
  //     hooks so the first effect-pass cannot use stale defaults;
  //   - `UUID_REGEX.test(storyId)` is a belt-and-braces guard against
  //     the `useLocalSearchParams` window where `id` may briefly be `''`
  //     before the route param resolves, AND against any non-UUID id
  //     (sample data fallback, stale shared URL) that the route's Zod
  //     schema would reject with 400. The regex covers both shapes.
  const active = enabled && sessionReady && consentReady && consent && !!sessionId && UUID_REGEX.test(storyId)

  // Fire the `view` event once, the moment we have both session id +
  // consent + the story id.
  useEffect(() => {
    if (!active || viewSentRef.current) return
    viewSentRef.current = true
    enteredAtRef.current = Date.now()
    void postEvent({
      storyId,
      action: 'view',
      sessionId,
      client: 'mobile',
      referrerKind,
    })
  }, [active, sessionId, storyId, referrerKind])

  // Read-through reaction: as soon as the user scrolls past the threshold
  // we fire the event exactly once. Useful even for short stories: if
  // contentHeight ≈ viewportHeight the threshold is met at scrollY = 0,
  // so the event fires on first paint — which matches "they saw the whole
  // thing" semantics.
  useAnimatedReaction(
    () => {
      if (!active || readThroughSent.value) return false
      if (contentHeight <= 0 || viewportHeight <= 0) return false
      const scrollable = Math.max(contentHeight - viewportHeight, 0)
      if (scrollable === 0) return true
      return scrollY.value / scrollable >= READ_THROUGH_FRACTION
    },
    (reached) => {
      if (!reached || readThroughSent.value || !sessionId) return
      // Mutate the SharedValue first (atomic on the UI thread) so a
      // subsequent reaction tick sees the guard set even before the JS
      // round-trip resolves.
      readThroughSent.value = true
      runOnJS(postEvent)({
        storyId,
        action: 'read_through',
        sessionId,
        client: 'mobile',
        referrerKind,
      })
    },
    [active, contentHeight, viewportHeight, sessionId, storyId, referrerKind]
  )

  // Dwell event: accumulate active foreground time and flush exactly
  // once on unmount. AppState background/inactive *pauses* the timer
  // (replying to a message, locking the phone) and AppState active
  // resumes it. Without pause/resume the previous code permanently
  // sealed the dwell ref on the first background, so a reader who came
  // back and finished the article had only the pre-background slice
  // recorded — systematically undercounting mobile dwell.
  useEffect(() => {
    if (!active || !sessionId) return

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
      dwellSentRef.current = true
      void postEvent({
        storyId,
        action: 'dwell',
        sessionId: sessionId!,
        client: 'mobile',
        dwellBucket: dwellBucketForMs(accumulatedMs),
        referrerKind,
      })
    }

    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'background' || status === 'inactive') pause()
      else if (status === 'active') resume()
    })

    return () => {
      flushDwell()
      subscription.remove()
    }
  }, [active, sessionId, storyId, referrerKind])
}
