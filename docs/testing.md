# Testing Conventions

## Framework

- **Vitest** + `@testing-library/react` + `@testing-library/user-event`
- Environment: `jsdom`
- Globals enabled (`describe`, `it`, `expect`, `vi` available without imports)

## Required Mocks

Every test file that renders components using these modules must mock them:

```ts
vi.mock('framer-motion')          // → __mocks__/framer-motion.tsx
vi.mock('next/image')             // → __mocks__/next/image.tsx
vi.mock('next/navigation')        // → __mocks__/next/navigation.ts
```

SWR hook tests use `vi.mock('swr')` to stub data-fetching behaviour.

## Mock Files

- `__mocks__/framer-motion.tsx` — renders `motion.*` as plain HTML, `AnimatePresence` as passthrough
- `__mocks__/next/image.tsx` — renders as `<img>`
- `__mocks__/next/navigation.ts` — stubs `useRouter`, `usePathname`
- `__mocks__/@supabase/ssr.ts` — stubs `createBrowserClient`, `createServerClient`

## Test File Locations

```
__tests__/
  lib/
    types.test.ts
    sample-data.test.ts
    hooks/
      fetcher.test.ts
      use-story-timeline.test.ts
      use-auth.test.ts
      use-require-auth.test.ts
      use-bookmarks.test.ts
      use-preferences.test.ts
      use-reading-history.test.ts
      use-bias-profile.test.ts
      use-suggestions.test.ts
      use-for-you.test.ts
      use-debounce.test.ts
      use-stories.test.ts
      use-review-queue.test.ts
      use-review-action.test.ts
    api/
      query-helpers.test.ts
      transformers.test.ts
      timeline-transformer.test.ts
      validation.test.ts
      auth-helpers.test.ts
      bias-calculator.test.ts
      bookmark-queries.test.ts
      bookmark-validation.test.ts
      preferences-queries.test.ts
      preferences-validation.test.ts
      reading-history-queries.test.ts
      for-you-scoring.test.ts
      for-you-queries.test.ts
      admin-helpers.test.ts
      review-validation.test.ts
      review-queries.test.ts
    auth/
      validation.test.ts
      auth-provider.test.tsx
    rss/
      parser.test.ts  dedup.test.ts  ingest.test.ts  feed-registry.test.ts
    ai/
      gemini-client.test.ts  clustering.test.ts
      spectrum-calculator.test.ts  topic-classifier.test.ts
      headline-generator.test.ts  summary-generator.test.ts
      blindspot-detector.test.ts
    supabase/
      client.test.ts  server.test.ts  types.test.ts  seed-sources.test.ts
  app/
    api/
      bookmarks/route.test.ts
      bookmarks/storyId-route.test.ts
      reading-history/route.test.ts
      reading-history/storyId-route.test.ts
      preferences/route.test.ts
      dashboard/bias-profile-route.test.ts
      dashboard/suggestions-route.test.ts
      stories/for-you-route.test.ts
      admin/review-route.test.ts
      admin/review-stats-route.test.ts
  components/
    atoms/   (7 test files — includes Skeleton.test.tsx, ReviewStatusBadge.test.tsx)
    molecules/  (8 test files — adds BiasComparisonBar.test.tsx, StatsRow.test.tsx, ForYouCta.test.tsx, ReviewListItem.test.tsx, ReviewDetail.test.tsx)
    organisms/  (16 test files — adds HeroCard.test.tsx, BiasProfileChart.test.tsx, SettingsForm.test.tsx, StickyFilterBar.test.tsx, SuggestionsList.test.tsx, SearchFilters.test.tsx, ReviewQueue.test.tsx; PerspectiveSlider.test.tsx and RegionSelector.test.tsx removed)
```

## Coverage Target

≥ 80% statement coverage across all source files.

## Testing Notes

- **AuthForm** uses `noValidate` on the `<form>` element to prevent HTML5 native validation from blocking Zod validation in tests

## E2E Testing (Playwright)

### Setup
- Framework: Playwright (`@playwright/test`)
- Config: `playwright.config.ts`
- Test directory: `e2e/`
- Browser: Chromium (installed via `npx playwright install chromium`)

### Running E2E Tests
```bash
npm run test:e2e          # Run all E2E tests (headless)
npm run test:e2e:ui       # Interactive UI mode
npm run test:e2e:headed   # Run with visible browser
```

### Auth Strategy
- Test user credentials: `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` in `.env.local`
- Auth state persisted via `storageState` in `e2e/.auth/user.json`
- `e2e/global-setup.ts` authenticates before tests run

### Directory Structure
```
e2e/
  global-setup.ts           # Auth setup (runs first)
  fixtures/test-data.ts     # Test constants (routes, labels)
  helpers/selectors.ts      # Shared data-testid constants
  public/                   # Unauthenticated page tests
    home-feed.spec.ts
    for-you-anonymous.spec.ts
    story-detail.spec.ts
    blindspot-feed.spec.ts
    sources-directory.spec.ts
  auth/                     # Login, signup, middleware tests
    login.spec.ts
    signup.spec.ts
    middleware.spec.ts
  protected/                # Authenticated page tests (storageState)
    dashboard.spec.ts
    settings.spec.ts
    history.spec.ts
    bookmarks.spec.ts
    for-you.spec.ts
    user-menu.spec.ts
  journeys/                 # Cross-page user flow tests
    read-story-journey.spec.ts
    bookmark-journey.spec.ts
    for-you-journey.spec.ts
    onboarding-journey.spec.ts
```

### Writing New E2E Tests
- Use `page.getByRole()`, `page.getByText()` as primary selectors
- Fall back to `page.getByTestId()` for non-semantic elements
- Authenticated tests: place in `e2e/protected/`, they auto-use storageState
- Unauthenticated tests: place in `e2e/public/` or `e2e/auth/`
- Journey tests: place in `e2e/journeys/` for cross-page flows

### When to Write E2E Tests

**Add E2E when:**
- Cross-page state/navigation (state survives back navigation, redirects)
- Auth flows (login → protected page → redirect)
- Multi-step user journeys (search → filter → click → back)
- Critical revenue/conversion paths

**Skip E2E when:**
- Single-component behavior (unit test covers it)
- API response handling (integration test with mocked API)
- Visual states (unit test with snapshots)

### Test Count
| Category | Files | Tests |
|----------|-------|-------|
| Public pages | 5 | ~39 |
| Auth pages | 3 | ~19 |
| Protected pages | 6 | ~36 |
| Journeys | 4 | ~4 |
| **Total** | **18** | **~90** |
