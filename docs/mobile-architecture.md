# Mobile App Architecture

React Native mobile app at `apps/mobile/` built with Expo SDK 54, expo-router, NativeWind v4, and SWR v2. Shares API endpoints and types with the Next.js web app.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 54, React Native, TypeScript |
| Routing | expo-router (file-based) |
| Styling | NativeWind v4, react-native-reanimated v4 |
| Data | SWR v2, Zod v4 |
| Auth | Supabase JS + expo-secure-store |
| OAuth | expo-web-browser (Google) |
| UI | expo-blur (GlassView), expo-image, lucide-react-native |

## Screen Map

| Route | File | Auth | Description |
|-------|------|------|-------------|
| `/` | `app/(tabs)/index.tsx` | No | Home feed — stories, tabs, search, filters |
| `/sources` | `app/(tabs)/sources.tsx` | No | Sources directory — bias/factuality filters |
| `/profile` | `app/(tabs)/profile.tsx` | No* | Bias calibration dashboard (*shows sign-in prompt if unauthenticated) |
| `/story/[id]` | `app/story/[id].tsx` | No | Story detail — spectrum, AI tabs, sources, timeline |
| `/settings` | `app/settings.tsx` | Yes | User preferences — topics, perspective, factuality |
| `/saved` | `app/saved.tsx` | Yes | Saved/bookmarked stories (fetches by story IDs) |
| `/history` | `app/history.tsx` | Yes | Reading history |
| `/(auth)/login` | `app/(auth)/login.tsx` | No | Login — email/password + Google OAuth |
| `/(auth)/signup` | `app/(auth)/signup.tsx` | No | Signup — email/password with confirmation |

## Navigation

```
RootLayout (Stack)
  ├── (tabs) — Tab Navigator
  │   ├── Home (index.tsx)
  │   ├── Sources (sources.tsx)
  │   └── Profile (profile.tsx)
  ├── story/[id] — Stack screen (slide from right)
  ├── saved — Stack screen (slide from right)
  ├── settings — Stack screen (slide from right)
  ├── history — Stack screen (slide from right)
  └── (auth) — Modal stack (slide from bottom)
      ├── login
      └── signup
```

- Tab bar: 3 tabs (Home, Sources, Profile) with lucide-react-native icons
- Auth screens: presented as modal (`presentation: 'modal'`) with X close button
- Stack transitions: `slide_from_right` for content screens, `slide_from_bottom` for auth

## Data Fetching

All data flows through SWR with a custom mobile fetcher at `lib/hooks/fetcher.ts`:

1. **Bearer token auth** — Fetcher calls `supabase.auth.getSession()` and attaches `Authorization: Bearer <token>` header
2. **API base URL** — From `EXPO_PUBLIC_API_BASE_URL` env var (defaults to `http://localhost:3000`)
3. **Expo Go LAN detection** — In dev mode, auto-replaces `localhost` with Mac's LAN IP from `Constants.expoConfig.hostUri` so the phone can reach the dev server
4. **SWR cache revalidation** — `AuthRevalidator` in `swr-provider.tsx` watches `user.id` and revalidates all caches on login/logout
5. **App foreground revalidation** — `AppStateRevalidator` calls `mutate(() => true)` when app returns from background

## Auth Flow

```
AuthProvider (lib/auth/auth-provider.tsx)
  ↓ subscribes to supabase.auth.onAuthStateChange
  ↓ sets user, session, isLoading in React state
  ↓ provides signInWithEmail, signUpWithEmail, signInWithGoogle, signOut

Google OAuth:
  1. Build URL: SUPABASE_URL/auth/v1/authorize?provider=google&redirect_to=axiom://auth/callback
  2. Open via WebBrowser.openAuthSessionAsync(url, 'axiom://auth/callback')
  3. Extract access_token + refresh_token from callback URL hash fragment
  4. Call supabase.auth.setSession() with tokens

Session storage: expo-secure-store (encrypted keychain)
```

**Supabase Dashboard requirement:** `axiom://auth/callback` must be in Authentication > URL Configuration > Redirect URLs.

## Hooks

| Hook | File | Description |
|------|------|-------------|
| `useAuth` | `lib/hooks/use-auth.ts` | Auth state + methods from AuthContext |
| `useRequireAuth` | `lib/hooks/use-require-auth.ts` | Redirects to login if unauthenticated |
| `useStories` | `lib/hooks/use-stories.ts` | Paginated story feed with filters; accepts `params | null` (null skips fetch); supports `ids` param for fetching specific stories |
| `useStory` | `lib/hooks/use-story.ts` | Single story detail + offline cache fallback |
| `useStoryTimeline` | `lib/hooks/use-story-timeline.ts` | Story timeline events |
| `useSources` | `lib/hooks/use-sources.ts` | Sources directory with filters |
| `useBookmarks` | `lib/hooks/use-bookmarks.ts` | Bookmark toggle + saved list |
| `useReadingHistory` | `lib/hooks/use-reading-history.ts` | Read stories + count |
| `useBiasProfile` | `lib/hooks/use-bias-profile.ts` | User bias distribution + blindspots |
| `useSuggestions` | `lib/hooks/use-suggestions.ts` | Personalized story suggestions |
| `useForYou` | `lib/hooks/use-for-you.ts` | For You personalized feed |
| `usePreferences` | `lib/hooks/use-preferences.ts` | User topic/perspective/factuality preferences |
| `useDebounce` | `lib/hooks/use-debounce.ts` | Debounced value (search input) |
| `useOnline` | `lib/hooks/use-online.ts` | Network connectivity status |
| `useSessionId` | `lib/hooks/use-session-id.ts` | Opaque rotating session id (UUID v4 in expo-secure-store, 7-day rotation) for engagement telemetry |
| `useTelemetryConsent` | `lib/hooks/use-telemetry-consent.ts` | Consent state for engagement telemetry; reads `axiom_telemetry_opt_out` from AsyncStorage |
| `useStoryTelemetry` | `lib/hooks/use-story-telemetry.ts` | Fires view/dwell/read_through events for the story screen via reanimated `useAnimatedReaction` + `AppState` listener |
| `useHotStories` | `lib/hooks/use-hot-stories.ts` | SWR hook for `/api/dashboard/hot-stories` (auth-gated) |
| `fetcher` | `lib/hooks/fetcher.ts` | SWR fetcher with Bearer tokens |
| `SWRProvider` | `lib/hooks/swr-provider.tsx` | SWR config + AppState + Auth revalidation |

## Shared Code

| Module | Path | What it provides |
|--------|------|-----------------|
| Types | `lib/shared/types.ts` | All domain types, label maps, constants (mirrors web `lib/types.ts`) |
| Design tokens | `lib/shared/design.ts` | SPACING, TEXT_OPACITY, GLASS, ACCENT, BADGE, FONT constants |
| Validation | `lib/shared/validation/auth.ts` | Zod schemas for login/signup forms |
| Supabase client | `lib/supabase/client.ts` | Singleton Supabase client with expo-secure-store adapter |
| Secure store adapter | `lib/supabase/secure-store-adapter.ts` | Custom Supabase storage adapter using expo-secure-store for encrypted token persistence |
| Haptics | `lib/haptics.ts` | Haptic feedback utility — impact, notification, selection patterns |
| Story intelligence | `lib/story-intelligence.ts` | Story analysis helpers — coverage momentum, gaps, framing delta, methodology copy |
| Offline cache | `lib/offline/cache-manager.ts` | Cache API helpers for offline story storage |
| Validation (bookmarks) | `lib/shared/validation/bookmarks.ts` | Zod schemas for bookmark storyId |
| Validation (preferences) | `lib/shared/validation/preferences.ts` | Zod schemas for user preferences |
| Validation (stories) | `lib/shared/validation/stories.ts` | Zod schemas for story query params |
| Sample data | `lib/shared/sample-data.ts` | Fallback sample articles and sources for skeleton loading |

## API Integration

The mobile app consumes the same API routes as the web app. All requests go through the Next.js backend:

- `GET /api/stories` — Feed with topic, region, bias, factuality, date filters; `ids` param for fetching specific stories by ID
- `GET /api/stories/[id]` — Story detail
- `GET /api/stories/[id]/timeline` — Story timeline
- `GET /api/stories/for-you` — Personalized feed
- `GET /api/sources` — Sources directory
- `GET/POST /api/bookmarks` — Bookmark management
- `GET /api/reading-history` — Reading history
- `GET/PATCH /api/preferences` — User preferences
- `GET /api/dashboard/bias-profile` — Bias distribution
- `GET /api/dashboard/suggestions` — Suggested stories

Auth: Cookie-based for web, Bearer token for mobile. The web backend's `lib/api/auth-helpers.ts` checks cookies first, then falls back to `Authorization: Bearer <token>` header.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `EXPO_PUBLIC_API_BASE_URL` | Next.js API base URL (e.g. `http://localhost:3000`) |

Set in `apps/mobile/.env.local`.
