# Phase 3 — Engagement Capture Privacy Audit

Date: 2026-04-22 · Branch: `feat/engagement-capture`

This document is the privacy-design checklist for the Phase 3 engagement
telemetry pipeline (migration 053 + 054, `/api/events/story` route,
mobile + web telemetry hooks, Hot Now dashboard card).

## What we collect

| Field            | Type                                          | Purpose                          |
|------------------|-----------------------------------------------|----------------------------------|
| `story_id`       | UUID                                          | Identifies the engaged story.    |
| `user_id`        | UUID, **null when unauthenticated**           | Powers For-You read-similar bonus. |
| `session_id`     | Opaque UUID v4, rotated every 7 days          | De-dupes events from one reader. |
| `action`         | enum(`view`, `dwell`, `read_through`, `share`)| Lifecycle moment.                |
| `dwell_bucket`   | int 0..3                                      | Coarse dwell time for ranking.   |
| `referrer_kind`  | enum(`feed`, `for_you`, `search`, `direct`, `external`) | Source-of-arrival kicker. |
| `client`         | enum(`web`, `mobile`)                         | Surface attribution.             |
| `created_at`     | timestamptz                                   | Recency window for rankings.     |

## What we deliberately do **not** collect

| Field         | Reason                                                                 |
|---------------|------------------------------------------------------------------------|
| IP address    | Not stored at any layer. Middleware never persists; route never reads. |
| User-Agent    | Not stored. We don't fingerprint browsers.                             |
| Viewport      | Not stored.                                                            |
| Raw referrer URL | Reduced to a 5-value enum; raw URL is never written to the DB.      |
| Raw dwell ms  | Bucketed to 4 values so two readers spending 47s vs 53s look identical.|
| Device ID / IDFA | Mobile session id is a UUID v4 unrelated to any device identifier. |

## Privacy controls

### Consent

- **Web client.** `useTelemetryConsent` (`lib/hooks/use-telemetry-consent.ts`)
  reads `navigator.doNotTrack === '1'` and `localStorage['axiom_telemetry_opt_out']`.
  Either signal makes the hook a no-op.
- **Web server.** Middleware (`middleware.ts`) checks the `DNT: 1` request
  header and emits `x-axiom-dnt: 1` on the response. It also
  *skips minting the `axiom_session` cookie* AND *actively expires any
  existing one* when DNT is set — a user who enables DNT after a
  previous visit needs the identifier cleared on the next request, not
  up to 7 days later when it naturally expires. The
  `/api/events/story` route re-checks the header and returns 204
  without inserting when DNT is present — defense in depth against a
  stale client snapshot.
- **Mobile client.** `useTelemetryConsent` (`apps/mobile/lib/hooks/use-telemetry-consent.ts`)
  reads `axiom_telemetry_opt_out` from AsyncStorage. The TelemetryConsentToggle
  molecule on the profile tab persists user preference. iOS App Tracking
  Transparency hookup is **deferred** — see "Deferred" below.

### Session id

- Web: 7-day httpOnly `axiom_session` cookie set by middleware on first
  request via `crypto.randomUUID()`. `SameSite=Lax`, `Secure` in production.
- Mobile: `useSessionId` persists a UUID v4 in `expo-secure-store` with
  matching 7-day rotation. Forwarded as `x-session-id` header on each
  event POST (RN cookies are unreliable across the bridge).

### RLS

`story_views` enables Row Level Security. Two policies:
- `story_views_service_insert` — only the service role may insert. The
  `/api/events/story` route enforces consent + Zod + dedupe and writes
  via the service-role client. anon and authenticated roles are blocked
  so a leaked anon key cannot be used to forge `session_id`/`user_id`
  rows directly against PostgREST.
- `story_views_admin_read` — SELECT requires `is_admin()`.

Service-role client used by the route bypasses RLS but explicitly sets
`user_id` from authenticated context only — never from the request body.

### Server-side dedup

`idx_story_views_session_dedupe` is a partial unique index on
`(session_id, story_id, action, date_trunc('minute', created_at))` for
`view` and `read_through` actions. Same session, same story, same action,
same minute collapses to one row. The route maps the resulting unique-
violation error to a no-op so the SQL dedupe is invisible to callers.

### Client-side debounce

- Web hook fires `view` exactly once per mount, `read_through` exactly
  once when scroll fraction crosses 0.8, `dwell` exactly once on
  pagehide / visibilitychange-hidden / unmount.
- Mobile hook fires the same trio gated by reanimated `useAnimatedReaction`
  and `AppState` listeners.

## Audit checklist

- [x] No IP column anywhere in the schema.
- [x] No User-Agent column anywhere in the schema.
- [x] Referrer stored as a 5-value enum, not a URL.
- [x] Dwell bucketed to 0..3, not stored as ms.
- [x] Session UUID rotates every 7 days on both web and mobile.
- [x] `DNT: 1` request header short-circuits the server route.
- [x] Middleware does NOT mint `axiom_session` for DNT requests (no dangling identifiers).
- [x] Middleware actively expires an existing `axiom_session` cookie when a request carries DNT (enabling DNT takes effect immediately, not after cookie natural expiry).
- [x] `navigator.doNotTrack === '1'` short-circuits the web client hook.
- [x] AsyncStorage opt-out flag short-circuits the mobile client hook.
- [x] `localStorage` opt-out flag short-circuits the web client hook.
- [x] RLS policy: SELECT admin-only.
- [x] RLS policy: INSERT service-role only (consent enforced at route layer; anon key cannot bypass).
- [x] `Cache-Control: no-store` on the event endpoint.

## Deferred

- **HMAC rotating session id (and the gameability of the current
  unsigned id).** Roadmap mentioned a daily HMAC of (cookie, UA) with
  rotating keys. We start with an opaque 7-day UUID. The privacy win of
  HMAC over UUID is small (the server sees a pseudonym either way); the
  operational cost is real (two keys in the air, scheduled rotation).
  
  **Known limitation:** the route accepts any caller-supplied
  `axiom_session` cookie or `x-session-id` header without verifying we
  actually issued it. A scripted attacker can mint fresh UUIDs and POST
  `view` events to inflate `unique_viewers_6h`, which feeds both Hot
  Now and the trending engagement_factor. We accept this trade-off for
  the MVP and rely on **monitoring**: if a single source IP or session
  cluster suddenly dominates the engagement curve, we add HMAC
  verification on the cookie + per-IP rate limiting (next bullet).
  Detection lives in the admin pipeline dashboard's per-source health
  view; the on-call response is to enable the HMAC layer before the
  next trending refresh.
- **iOS App Tracking Transparency.** Mobile does not currently call
  `expo-tracking-transparency`. The settings-toggle path covers the user-
  facing consent surface; the App Store privacy label still claims "no
  tracking" because nothing we collect is used for cross-app tracking.
  When we add network-level ads or analytics SDKs we'll wire ATT.
- **Per-IP rate limiting.** Client debounce + minute-granularity SQL
  dedupe cover MVP. A shared rate-limit RPC (pattern from
  `lib/news-api/rate-limiter.ts`) is the follow-up if abuse appears.

## Smoke verification

After deployment:
1. Open a story detail. Inspect `story_views` for one `view` row with the
   expected `session_id` cookie value and `client='web'`.
2. Scroll to bottom + leave. Expect one `read_through` and one `dwell`
   row, both deduped within the same minute by the partial unique index.
3. Open the same story from the same session within 60s. Expect zero new
   rows for `view` / `read_through` (dedup index), but a fresh `dwell`
   on close.
4. With `DNT: 1` set in browser headers, open a story. Expect zero rows.
