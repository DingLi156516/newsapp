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
    story-intelligence.test.ts
    source-comparison.test.ts
    pipeline/
      backlog.test.ts
      logger.test.ts
      stage-events.test.ts
      process-runner.test.ts
      process-runner-freshness.test.ts
      story-state.test.ts
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
      use-online.test.ts
      use-infinite-scroll.test.ts
      use-pipeline.test.ts
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
      trending-score.test.ts
      admin-helpers.test.ts
      review-validation.test.ts
      review-queries.test.ts
    auth/
      validation.test.ts
      auth-provider.test.tsx
    rss/
      parser.test.ts  parser-errors.test.ts  dedup.test.ts  ingest.test.ts  feed-registry.test.ts  normalization.test.ts
    ai/
      gemini-client.test.ts  gemini-client-model-routing.test.ts
      clustering.test.ts  clustering-stage.test.ts  recluster.test.ts
      embeddings.test.ts
      spectrum-calculator.test.ts  story-classifier.test.ts
      summary-generator.test.ts  summary-verifier.test.ts
      blindspot-detector.test.ts
      deterministic-assembly.test.ts  entity-extractor.test.ts
      thin-topic-classifier.test.ts
      story-assembler.test.ts  story-assembler-concurrency.test.ts
    email/
      send-digest.test.ts
    ingestion/
      source-registry.test.ts  fetcher-registry.test.ts
      pipeline-helpers.test.ts  ingest.test.ts
    crawler/
      robots.test.ts  article-discovery.test.ts
      article-extractor.test.ts  fetcher.test.ts
    news-api/
      rate-limiter.test.ts  fetcher.test.ts
      providers/newsapi.test.ts  providers/gdelt.test.ts
    offline/
      cache-manager.test.ts
    supabase/
      client.test.ts  server.test.ts  types.test.ts  seed-sources.test.ts
  app/
    api/
      bookmarks/route.test.ts
      bookmarks/storyId-route.test.ts
      reading-history/route.test.ts
      reading-history/storyId-route.test.ts
      preferences/route.test.ts
      sources/source-slug-route.test.ts
      sources/compare-route.test.ts
      dashboard/bias-profile-route.test.ts
      dashboard/suggestions-route.test.ts
      stories/for-you-route.test.ts
      admin/review-route.test.ts
      admin/review-routing-preview.test.ts
      admin/review-stats-route.test.ts
      admin/pipeline/route.test.ts
      admin/pipeline/sources/route.test.ts
      admin/pipeline/stats/route.test.ts
      admin/pipeline/trigger/route.test.ts
      admin/pipeline/events/route.test.ts
  components/
    atoms/   (10 test files — includes Skeleton.test.tsx, ReviewStatusBadge.test.tsx, OfflineIndicator.test.tsx, ShareButton.test.tsx, Toast.test.tsx)
    molecules/  (11 test files — adds BiasComparisonBar.test.tsx, StatsRow.test.tsx, ForYouCta.test.tsx, ReviewListItem.test.tsx, ReviewDetail.test.tsx, MetricsRow.test.tsx, RoutingPreviewPanel.test.tsx, ActiveOwnerChip.test.tsx)
    organisms/  (25 test files — adds HeroCard.test.tsx, ViewSwitcher.test.tsx, SourcesView.test.tsx, BiasProfileChart.test.tsx, SettingsForm.test.tsx, StickyFilterBar.test.tsx, SuggestionsList.test.tsx, SearchFilters.test.tsx, ReviewQueue.test.tsx, CoverageIntelligence.test.tsx, SourceDirectoryInsights.test.tsx, PipelineControls.test.tsx, PipelineRunHistory.test.tsx, PipelineSummaryStats.test.tsx, SourceHealthTable.test.tsx, PipelineEventsPanel.test.tsx; AppNavigation.test.tsx, PerspectiveSlider.test.tsx and RegionSelector.test.tsx removed)
    pages/
      SourceProfilePage.test.tsx
      SourceComparisonPage.test.tsx
```

`story-intelligence.test.ts` now covers structured story-analysis output for momentum, coverage gaps, framing delta, and methodology copy. `CoverageIntelligence.test.tsx` verifies the corresponding story-detail analysis cards, and `e2e/public/story-detail.spec.ts` checks that those sections render in the browser.

`source-slug-route.test.ts` verifies the source-profile API response shape, `compare-route.test.ts` verifies the two-source comparison API response shape, `SourceProfilePage.test.tsx` covers snapshot/recent-coverage/not-found rendering plus the compare CTA, `SourceComparisonPage.test.tsx` covers the picker and comparison sections, and `e2e/public/sources-directory.spec.ts` now exercises both source-profile navigation and the source-to-source comparison flow.

`ViewSwitcher.test.tsx` verifies the pill tabs render, aria-selected state, onChange callbacks, and data-testids. `SourcesView.test.tsx` covers filter sections, source card rendering, search input, and multi-select filtering. `e2e/public/home-feed.spec.ts` checks the ViewSwitcher is visible and that clicking Sources switches the view inline (URL → `/?view=sources`, feed tabs hidden). `e2e/public/view-switcher.spec.ts` covers direct URL navigation to `/?view=sources`, `/sources` redirect, browser back button, and feed/sources content toggling.

`tag-upsert.test.ts` covers entity tag upserting including UUID quoting, deduplication, and error handling. `story-state.test.ts` covers the conservative publication-decision rules and legacy-state backfill mapping. `embeddings.test.ts`, `clustering-stage.test.ts`, `process-runner.test.ts`, and `backlog.test.ts` cover bounded stage claiming, stale-claim recovery, freshness-first process orchestration, skip-reason reporting, and backlog reporting for the pipeline. `PipelineRunHistory.test.tsx` verifies that the admin dashboard shows backlog deltas plus per-stage skip/pass diagnostics for process runs.

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
- Public source-intelligence flows now live in `e2e/public/sources-directory.spec.ts`, including source profile and source comparison navigation

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
| Public pages | 5 | ~40 |
| Auth pages | 3 | ~19 |
| Protected pages | 6 | ~36 |
| Journeys | 4 | ~4 |
| **Total** | **18** | **~100+** |
