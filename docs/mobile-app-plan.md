# React Native Mobile App — Fresh Build on Main

## Overview

Build a full-featured iOS + Android app at `apps/mobile/` consuming the existing Axiom News REST API. Full feature parity with the web app. Reuse good patterns from the old `feature/mobile-app` branch but rebuild on current `main` which has significant changes (ViewSwitcher, emerging story removal, relaxed publication criteria, ShareButton, infinite scroll, filter persistence, shimmer skeletons).

## Tech Stack (same as old branch, updated versions)

| Layer | Technology |
|-------|-----------|
| Framework | Expo 55, expo-router |
| Auth | @supabase/supabase-js + expo-secure-store |
| Data | SWR v2, Zod v4 (web uses v4 now) |
| Styling | NativeWind v4 (Tailwind for RN) |
| Animations | react-native-reanimated v3 |
| Images | expo-image |
| Icons | lucide-react-native |
| Haptics | expo-haptics |
| Offline | AsyncStorage + @react-native-community/netinfo |
| Bottom Sheet | @gorhom/bottom-sheet |

## Shared Code Strategy

Files shared between web and mobile (via relative imports from monorepo root):
- `lib/types.ts` — all TypeScript types, enums, label maps
- Zod validation schemas (bookmark, preferences, auth)
- Auth types

Files NOT shared (platform-specific):
- Components (React DOM vs React Native)
- Hooks (SWR fetcher uses different auth headers — Bearer token vs cookies)
- Navigation (expo-router vs Next.js App Router)
- Styling (NativeWind classes vs Tailwind CSS)

## Screen Map

| Screen | Navigator | API Endpoint | Web Equivalent |
|--------|-----------|-------------|----------------|
| **HomeFeed** | Tab (Home) | GET /api/stories | `/` (feed view) |
| **StoryDetail** | Stack push | GET /api/stories/[id] | `/story/[id]` |
| **Sources** | Tab | GET /api/sources | `/?view=sources` |
| **SourceProfile** | Stack push | GET /api/sources/[slug] | `/sources/[slug]` |
| **Profile** | Tab | GET /api/dashboard/* | `/dashboard` |
| **Settings** | Stack from Profile | GET/PATCH /api/preferences | `/settings` |
| **History** | Stack from Profile | GET /api/reading-history | `/history` |
| **Login** | Modal | Supabase Auth | `/login` |
| **Signup** | Modal | Supabase Auth | `/signup` |

## Phases

### Phase 1: Scaffold + Auth (2-3 sessions)

**Goal:** Expo project boots, auth works, can fetch stories.

1. `npx create-expo-app apps/mobile` with Expo 55
2. Install deps (NativeWind, Supabase, SWR, reanimated, lucide-react-native)
3. Configure NativeWind + tailwind.config.ts for mobile
4. Copy shared types from root `lib/types.ts`
5. Create Supabase client using expo-secure-store for token storage
6. Auth provider with Bearer token flow (already in backend: `lib/api/auth-helpers.ts` has Bearer fallback)
7. SWR fetcher that attaches Bearer token from secure store
8. Login + Signup screens (email + password, match web UI)
9. Root layout with AuthProvider, font loading (Inter), splash screen

**Reuse from old branch:** `app/_layout.tsx`, `app/(auth)/login.tsx`, `app/(auth)/signup.tsx`, auth hooks, Supabase client config. Verify against current `lib/api/auth-helpers.ts`.

**Verify:** App boots, can login, token stored, authenticated API call works.

### Phase 2: Core Feed + Story Detail (3-4 sessions)

**Goal:** Browse stories, read details, see AI perspectives.

1. **Atoms:** BiasTag, BlindspotBadge, BookmarkButton, CoverageCount, FactualityDots, Skeleton (with shimmer), ShareButton (native share API)
2. **Molecules:** MonochromeSpectrumBar (RN View-based), StatsRow, BiasLegend
3. **Organisms:** NexusCard (with visible thumbnail — match new web design), HeroCard, FeedTabs, SearchBar, StickyFilterBar, SearchFilters
4. **HomeFeed screen:** Tab layout, FeedTabs (For You/Trending/Latest/Blindspot/Saved), infinite scroll (FlatList with onEndReached), filter panel (bottom sheet)
5. **StoryDetail screen:** AI Summary tabs (Common Ground/Left/Right), CoverageIntelligence, source list, spectrum bar, share button
6. **Hooks:** useStories, useStory, useDebounce, useBookmarks, useReadingHistory, useForYou

**Key difference from old branch:** No emerging story UI (removed), card images visible (new), share button on cards (new), shimmer skeleton (new).

**Reuse from old branch:** Atom/molecule component structure, hook patterns. Rebuild organisms to match current web design.

**Verify:** Feed loads, cards show images, infinite scroll works, story detail shows AI perspectives, share works.

### Phase 3: Sources + Authenticated Features (2-3 sessions)

**Goal:** Full sources directory, profile/dashboard, settings, history.

1. **Sources tab:** Source directory with filters (bias, factuality, ownership, region), search, card grid
2. **SourceProfile screen:** Metadata snapshot, recent coverage, topic mix
3. **Profile tab:** Bias profile chart, suggestions, blindspot count
4. **Settings screen:** Topic preferences, perspective, factuality minimum, digest email toggle
5. **History screen:** Reading history feed
6. **Hooks:** useSources, useSourceProfile, usePreferences, useBiasProfile, useSuggestions

**Reuse from old branch:** Screen layouts, hook logic. Update to match current backend (no emerging stories in sources).

**Verify:** All screens render, preferences save, history tracks reads.

### Phase 4: Polish + Offline (1-2 sessions)

**Goal:** Production-quality UX.

1. **Offline:** AsyncStorage cache for last-fetched stories, NetInfo connectivity detection, offline indicator
2. **Animations:** Reanimated shared element transitions for card → detail, tab indicator animation, pull-to-refresh
3. **Haptics:** Light impact on bookmark toggle, tab switch, pull-to-refresh
4. **Error states:** Network error screens, retry buttons, empty states with illustrations
5. **Deep linking:** `axiom://story/[id]` URL scheme for sharing
6. **Dark/light theme:** NativeWind theme toggle (web is dark-only, mobile gets both)

### Phase 5: Testing + Build (2-3 sessions)

**Goal:** Test coverage, CI, app store ready.

1. **Unit tests:** Jest + React Native Testing Library, 80% coverage target
2. **Component tests:** All atoms, molecules, organisms
3. **Hook tests:** All SWR hooks with mocked fetcher
4. **EAS Build:** `eas.json` config for dev/preview/production profiles
5. **App store assets:** Icon, splash screen, screenshots, description
6. **CI:** GitHub Actions workflow for lint + test + EAS build on PR

## Backend Changes Needed

1. **Already done:** `lib/api/auth-helpers.ts` has Bearer token fallback (from old branch)
2. **Verify:** All API endpoints work with Bearer auth (no cookie-only paths)
3. **New (if needed):** Push notification token registration endpoint (future)

## Monorepo Structure

```
/
├── apps/
│   └── mobile/
│       ├── app/           # expo-router screens
│       ├── components/    # atoms/, molecules/, organisms/
│       ├── hooks/         # mobile-specific SWR hooks
│       ├── lib/           # Supabase client, auth, fetcher
│       ├── assets/        # fonts, images, icons
│       ├── app.json       # Expo config
│       ├── package.json   # mobile-specific deps
│       └── tailwind.config.ts
├── lib/                   # shared types (imported by both web + mobile)
├── app/                   # Next.js web app
├── components/            # web-specific components
└── package.json           # root workspace
```

## Risk Mitigation

- **NativeWind compatibility:** Some Tailwind classes don't map 1:1 to RN. Test glassmorphism effects early (expo-blur fills the gap).
- **Image domains:** Expo Image needs `expo-image` config for remote news article thumbnails. Whitelist domains in app.json.
- **SWR + React Native:** SWR works in RN but `revalidateOnFocus` needs AppState listener instead of document focus. Create a custom SWR provider.
- **Expo 55 stability:** Expo 55 is current. Pin versions to avoid breaking changes.

## Recommended Execution Order

Start with Phase 1 (scaffold + auth), then Phase 2 (core feed). These two phases give you a working app you can demo. Phases 3-5 add depth and polish.

Each phase should be a separate commit (or small set of commits) on main. No long-lived feature branch this time — merge incrementally.
