# Mobile App Testing

Testing strategy for the React Native mobile app at `apps/mobile/`.

## Prerequisites

The mobile app is a pure frontend — all data comes from the Next.js API. **You must have the web dev server running** before launching the app or running E2E tests.

| Terminal | Directory | Command | Purpose |
|----------|-----------|---------|---------|
| 1 | `/` (project root) | `npm run dev` | Next.js API on `localhost:3000` |
| 2 | `apps/mobile/` | `npx expo start --ios` | Expo dev server + iOS simulator |
| 3 | `apps/mobile/` | `npm run test:e2e` | Maestro E2E flows (after simulator is ready) |

The mobile fetcher (`lib/hooks/fetcher.ts`) targets `EXPO_PUBLIC_API_BASE_URL` (defaults to `http://localhost:3000`). In Expo Go dev mode it auto-replaces `localhost` with your Mac's LAN IP so the simulator can reach the dev server. Without the Next.js server running, all SWR hooks return errors and E2E flows fail.

Unit tests (`npm test`) do **not** require the dev server — they mock all API calls via Jest.

## Unit & Integration Tests

| Tool | Version |
|------|---------|
| Jest | 29.7.0 (via jest-expo) |
| @testing-library/react-native | 13.3.3 |
| Coverage | jest --coverage |

**43 test files** organized under `__tests__/`:

```
__tests__/
  atoms/          8 files — BiasTag, BlindspotBadge, BookmarkButton, CoverageCount,
                            FactualityDots, OfflineIndicator, ShareButton, Skeleton
  molecules/      7 files — BiasComparisonBar, BiasLegend, EmptyStateView, ForYouCta,
                            MonochromeSpectrumBar, NetworkErrorView, SourceList
  organisms/     12 files — AISummaryTabs, CoverageIntelligence, FeedTabs, HeroCard,
                            HotNowCard, NexusCard, NexusCardSkeleton, SearchBar,
                            SearchFilters, StickyFilterBar, StoryTimeline, TopicPills
  hooks/         12 files — use-bookmarks, use-debounce, use-for-you, use-preferences,
                            use-reading-history, use-sources, use-stories, use-story,
                            use-session-id, use-telemetry-consent, use-story-telemetry,
                            use-hot-stories
  screens/        4 files — login, profile, saved, sources
  lib/            4 files — auth-provider, haptics, story-intelligence, swr-provider
  ui/             1 file  — GlassView
```

## Mocks

Configured in `jest.setup.ts`:

| Mock | What it replaces |
|------|-----------------|
| `expo-haptics` | Haptic feedback (no-op) |
| `react-native-reanimated` | Animations (returns plain Views) |
| `expo-router` | `useRouter`, `useLocalSearchParams`, `Link` |
| `@gorhom/bottom-sheet` | Bottom sheet components |
| `expo-blur` | BlurView (renders plain View) |
| `@/lib/supabase/client` | Supabase client (mock auth methods) |
| `expo-secure-store` | Secure storage (in-memory) |

## E2E Tests (Maestro)

**16 YAML flows** at `.maestro/flows/`:

| Category | Flows | What they cover |
|----------|-------|----------------|
| `auth/` (4) | login-form, signup-form, skip-login, google-oauth | Form rendering, validation, OAuth, modal dismiss |
| `public/` (5) | home-feed, story-detail, sources, search, story-telemetry | Feed tabs, cards, detail navigation, source filters, search, telemetry view→scroll→back lifecycle |
| `protected/` (5) | dashboard, bookmarks, settings, history, for-you | Bias calibration, bookmark cycle, preferences, reading history |
| `journeys/` (3) | read-story, bookmark-cycle, onboarding | Multi-screen user flows |

### Running E2E

```bash
# Install Maestro (one-time)
brew install maestro

# Start app in simulator
npx expo start --ios

# Run all flows
npm run test:e2e

# Run by category
npm run test:e2e:auth
npm run test:e2e:public
npm run test:e2e:protected
npm run test:e2e:journeys
```

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm test` | `jest` | Run all unit/integration tests |
| `npm run test:watch` | `jest --watch` | Watch mode |
| `npm run test:coverage` | `jest --coverage` | Coverage report |
| `npm run test:e2e` | `maestro test .maestro/flows/` | All Maestro E2E flows |
| `npm run test:e2e:auth` | `maestro test .maestro/flows/auth/` | Auth flows only |
| `npm run test:e2e:public` | `maestro test .maestro/flows/public/` | Public flows only |
| `npm run test:e2e:protected` | `maestro test .maestro/flows/protected/` | Protected flows only |
| `npm run test:e2e:journeys` | `maestro test .maestro/flows/journeys/` | Journey flows only |

## testID Conventions

Maestro targets elements via `testID` props. Naming patterns:

| Pattern | Example | Used in |
|---------|---------|---------|
| `feed-tab-{value}` | `feed-tab-trending` | FeedTabs |
| `topic-pill-{topic}` | `topic-pill-politics` | TopicPills |
| `setting-topic-{topic}` | `setting-topic-technology` | Settings |
| `{element}` | `search-input`, `story-card`, `hero-card` | Various |
| `{action}-button` | `sign-in-button`, `back-button`, `sign-out-button` | Auth, navigation |

## Coverage Target

Target: **80%** statement coverage (matching web app).

```bash
npm run test:coverage
```

Coverage scoped to `components/**` + `lib/**` (excludes `app/` route files and config).
