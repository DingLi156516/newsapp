# Axiom News

A modern news aggregation interface that surfaces political bias distribution, factuality ratings,
and coverage blindspots for every story — helping readers understand not just _what_ is being
reported, but _how_ and _by whom_.

---

## Prerequisites

- **Node.js** 22+
- **npm** 10+

---

## Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd newsapp

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server with HMR |
| `npm run build` | Production build (zero-error gate) |
| `npm start` | Run production build locally |
| `npm run lint` | ESLint with Next.js rules |
| `npm test` | Run Vitest test suite (single run) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Coverage report (target ≥ 80%) |
| `npm run test:e2e` | Playwright E2E tests (headless) |
| `npm run test:e2e:ui` | Playwright interactive UI mode |
| `npm run test:e2e:headed` | Playwright with visible browser |
| `npx tsx scripts/backfill-tags.ts` | Backfill entity tags for existing published stories |
| `npx tsx scripts/backfill-single-source.ts` | Re-assemble single-source stories (fix headlines + perspectives) |

---

## Mobile App

React Native mobile app at `apps/mobile/` built with Expo SDK 54.

### Prerequisites

- **Node.js** 20 LTS (Node 22+ has type stripping issues with Expo)
- **Expo Go** app on iOS/Android, or iOS Simulator
- **Maestro** for E2E tests: `brew install maestro`

### Quick Start

```bash
cd apps/mobile
npm install

# Start dev server (opens in Expo Go or Simulator)
npm start

# Or target specific platform
npm run ios
npm run android
```

### Mobile Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start Expo dev server |
| `npm run ios` | Start with iOS Simulator |
| `npm run android` | Start with Android emulator |
| `npm test` | Jest unit/integration tests (210 tests) |
| `npm run test:coverage` | Coverage report (target 80%) |
| `npm run test:e2e` | Maestro E2E flows (16 flows) |

### Mobile Documentation

| File | Contents |
|------|----------|
| `docs/mobile-architecture.md` | Screens, navigation, hooks, auth flow, API integration |
| `docs/mobile-components.md` | Component inventory with props |
| `docs/mobile-testing.md` | Jest + Maestro setup, testID conventions |
| `docs/mobile-design-system.md` | Editorial Glass tokens, primitives, per-tab polish |

---

## Pipeline Notes

The ingest/process pipeline now uses explicit story lifecycle state instead of relying on placeholder headlines:

- `assembly_status`: `pending | processing | completed | failed`
- `publication_status`: `draft | needs_review | published | rejected`
- `story_kind`: `standard`

Public story APIs only serve `published` stories. Assembly applies a conservative risk-based decision:
- low-risk stories auto-publish
- `sparse_coverage`, `ai_fallback`, and `processing_anomaly` trigger admin review; blindspot and factuality no longer gate publication

The processing cron now runs backlog-aware multi-pass embed/cluster/assemble loops and reports backlog counts before and after each run so operators can distinguish ingest, embedding, clustering, assembly, and review backlog.

Singletons retry clustering 3 times then promote to single-article standard stories. Unclustered articles expire after 7 days.

---

## Project Structure

```
newsapp/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout (fonts, global CSS)
│   ├── page.tsx                # Home feed (filtering, search)
│   ├── blindspot/
│   │   └── page.tsx            # Blindspot-filtered feed
│   ├── sources/
│   │   ├── page.tsx            # Source directory with filters
│   │   ├── compare/
│   │   │   └── page.tsx        # Source comparison driven by left/right slugs
│   │   └── [slug]/
│   │       └── page.tsx        # Source profile detail
│   ├── story/
│   │   └── [id]/
│   │       └── page.tsx        # Story detail (bias breakdown, AI summary)
│   ├── login/
│   │   └── page.tsx            # Login (email + Google OAuth)
│   ├── signup/
│   │   └── page.tsx            # Signup (email + Google OAuth)
│   ├── dashboard/
│   │   └── page.tsx            # Bias calibration profile + suggestions
│   ├── history/
│   │   └── page.tsx            # Reading history feed
│   ├── settings/
│   │   └── page.tsx            # User preferences form
│   ├── admin/
│   │   └── review/
│   │       └── page.tsx        # Admin review queue (admin only)
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts        # GET /auth/callback (OAuth redirect)
│   └── api/
│       ├── stories/
│       │   ├── route.ts        # GET /api/stories
│       │   ├── for-you/
│       │   │   └── route.ts    # GET /api/stories/for-you
│       │   └── [id]/
│       │       ├── route.ts    # GET /api/stories/[id]
│       │       └── timeline/
│       │           └── route.ts # GET /api/stories/[id]/timeline
│       ├── sources/
│       │   ├── route.ts        # GET /api/sources
│       │   ├── compare/
│       │   │   └── route.ts    # GET /api/sources/compare
│       │   └── [slug]/
│       │       └── route.ts    # GET /api/sources/[slug]
│       ├── bookmarks/
│       │   ├── route.ts        # GET/POST /api/bookmarks
│       │   └── [storyId]/
│       │       └── route.ts    # DELETE /api/bookmarks/[storyId]
│       ├── reading-history/
│       │   ├── route.ts        # GET /api/reading-history
│       │   └── [storyId]/
│       │       └── route.ts    # POST/DELETE /api/reading-history/[storyId]
│       ├── preferences/
│       │   └── route.ts        # GET/PATCH /api/preferences
│       ├── dashboard/
│       │   ├── bias-profile/
│       │   │   └── route.ts    # GET /api/dashboard/bias-profile
│       │   └── suggestions/
│       │       └── route.ts    # GET /api/dashboard/suggestions
│       ├── admin/
│       │   └── review/
│       │       ├── route.ts    # GET /api/admin/review
│       │       ├── [id]/
│       │       │   └── route.ts # PATCH /api/admin/review/[id]
│       │       └── stats/
│       │           └── route.ts # GET /api/admin/review/stats
│       └── cron/
│           ├── ingest/route.ts  # GET — RSS ingestion
│           ├── process/route.ts # GET — AI processing
│           └── digest/route.ts  # POST — blindspot digest email
├── components/
│   ├── atoms/                  # Primitive UI components (no state)
│   │   ├── BiasTag.tsx
│   │   ├── BlindspotBadge.tsx
│   │   ├── BookmarkButton.tsx
│   │   ├── CoverageCount.tsx
│   │   ├── FactualityDots.tsx
│   │   ├── ReviewStatusBadge.tsx
│   │   ├── OfflineIndicator.tsx
│   │   └── Skeleton.tsx
│   ├── molecules/              # Composed components (may have local state)
│   │   ├── BiasLegend.tsx
│   │   ├── MonochromeSpectrumBar.tsx
│   │   ├── BiasComparisonBar.tsx
│   │   ├── StatsRow.tsx
│   │   ├── ForYouCta.tsx
│   │   ├── ReviewListItem.tsx
│   │   ├── ReviewDetail.tsx
│   │   └── SourceList.tsx
│   └── organisms/              # Feature-level components
│       ├── AISummaryTabs.tsx
│       ├── FeedTabs.tsx
│       ├── NexusCard.tsx
│       ├── NexusCardSkeleton.tsx
│       ├── SearchBar.tsx
│       ├── SearchFilters.tsx
│       ├── StoryTimeline.tsx
│       ├── TopicPills.tsx
│       ├── AuthForm.tsx
│       ├── UserMenu.tsx
│       ├── HeroCard.tsx
│       ├── ViewSwitcher.tsx
│       ├── SourcesView.tsx
│       ├── BiasProfileChart.tsx
│       ├── SettingsForm.tsx
│       ├── StickyFilterBar.tsx
│       ├── SuggestionsList.tsx
│       └── ReviewQueue.tsx
│   └── pages/                  # Route-level page shells
│       ├── SourceProfilePage.tsx
│       └── SourceComparisonPage.tsx
├── lib/
│   ├── types.ts                # All TypeScript types, enums, label maps
│   ├── sample-data.ts          # Static fallback data
│   ├── sample-timeline.ts      # Static timeline fallback data
│   ├── source-profiles.ts      # Source-profile rollups + sample fallback builder
│   ├── source-comparison.ts    # Source-comparison rollups + sample fallback builder
│   ├── hooks/                  # SWR data-fetching hooks
│   │   ├── fetcher.ts
│   │   ├── use-stories.ts
│   │   ├── use-story.ts
│   │   ├── use-story-timeline.ts
│   │   ├── use-sources.ts
│   │   ├── use-source-profile.ts
│   │   ├── use-source-comparison.ts
│   │   ├── use-auth.ts
│   │   ├── use-require-auth.ts
│   │   ├── use-bookmarks.ts
│   │   ├── use-preferences.ts
│   │   ├── use-reading-history.ts
│   │   ├── use-bias-profile.ts
│   │   ├── use-suggestions.ts
│   │   ├── use-for-you.ts
│   │   ├── use-debounce.ts
│   │   ├── use-admin.ts
│   │   ├── use-review-queue.ts
│   │   ├── use-review-action.ts
│   │   └── use-online.ts
│   ├── auth/                   # Authentication
│   │   ├── types.ts
│   │   ├── validation.ts
│   │   └── auth-provider.tsx
│   ├── api/                    # API utilities
│   │   ├── query-helpers.ts
│   │   ├── transformers.ts
│   │   ├── timeline-transformer.ts
│   │   ├── validation.ts
│   │   ├── auth-helpers.ts
│   │   ├── bias-calculator.ts
│   │   ├── bookmark-queries.ts
│   │   ├── bookmark-validation.ts
│   │   ├── preferences-queries.ts
│   │   ├── preferences-validation.ts
│   │   ├── reading-history-queries.ts
│   │   ├── for-you-scoring.ts
│   │   ├── for-you-queries.ts
│   │   ├── admin-helpers.ts
│   │   ├── review-validation.ts
│   │   └── review-queries.ts
│   ├── email/                   # Email delivery
│   │   ├── resend-client.ts
│   │   └── send-digest.ts
│   ├── offline/                 # PWA / offline support
│   │   └── cache-manager.ts
│   ├── pipeline/                # Pipeline state, backlog, run logging
│   │   ├── backlog.ts
│   │   ├── claim-utils.ts
│   │   ├── logger.ts
│   │   ├── process-runner.ts
│   │   ├── story-state.ts
│   │   └── telemetry-utils.ts
│   ├── supabase/               # Database client + schema types
│   ├── rss/                    # RSS ingestion pipeline
│   │   ├── normalization.ts    # Canonical URL + title fingerprint helpers
│   └── ai/                     # AI processing (Gemini, clustering, summaries, region)
├── __mocks__/                  # Vitest manual mocks
│   ├── framer-motion.tsx
│   ├── @supabase/
│   │   └── ssr.ts
│   └── next/
│       ├── image.tsx
│       └── navigation.ts
├── __tests__/                  # Unit test suite
│   ├── app/api/                # API route tests
│   ├── lib/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── rss/
│   │   ├── ai/
│   │   └── supabase/
│   └── components/
│       ├── atoms/
│       ├── molecules/
│       └── organisms/
├── e2e/                        # Playwright E2E tests
│   ├── global-setup.ts
│   ├── fixtures/
│   ├── helpers/
│   ├── public/
│   ├── auth/
│   ├── protected/
│   └── journeys/
├── public/
│   ├── service-worker.js        # PWA service worker (offline cache)
│   ├── manifest.json            # Web app manifest (PWA)
│   ├── icon-192.png             # PWA icon (192×192)
│   └── icon-512.png             # PWA icon (512×512)
├── middleware.ts                # Supabase Auth session refresh
├── tailwind.config.ts          # Design tokens + custom plugin
├── vitest.config.ts            # Vitest configuration
└── vitest.setup.ts             # jest-dom matchers setup
```

> **Module-level docs** — see [docs/architecture.md](docs/architecture.md#backend-modules) for function signatures and backend module inventory.

---

## Design System

### Liquid Glass Palette
The UI uses a dark glassmorphism aesthetic with three glass utility classes:

| Class | Usage |
|-------|-------|
| `.glass` | Primary card surface (heavier blur) |
| `.glass-sm` | Secondary surfaces, panels |
| `.glass-pill` | Tags, badges, small chips |

### Bias Spectrum CSS
Each political bias category has a unique CSS pattern class:

| Bias | Class |
|------|-------|
| Far Left | `.spectrum-far-left` |
| Left | `.spectrum-left` |
| Lean Left | `.spectrum-lean-left` |
| Center | `.spectrum-center` |
| Lean Right | `.spectrum-lean-right` |
| Right | `.spectrum-right` |
| Far Right | `.spectrum-far-right` |

Use `BIAS_CSS_CLASS[bias]` from `@/lib/types` to get the correct class programmatically.

### Typography
- **Headlines:** DM Serif Display (Google Fonts)
- **UI / Body:** Inter (system-ui fallback)

### Motion
- All tab/pill animations use Framer Motion `layoutId` for shared-layout transitions
- Unique layout IDs: `feed-tab-underline`, `topic-pill-highlight`, `ai-tab-underline`

---

## API Reference

See [docs/architecture.md](docs/architecture.md#api-routes) for endpoint details, query parameters, and response shapes.

---

## Phase Roadmap

See [`TRACKER.md`](TRACKER.md) for full feature and phase deliverable status.

---

## Environment Variables

```bash
# .env.local (required for Phase 2+ features)
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anonymous key (browser-safe)
SUPABASE_SERVICE_ROLE_KEY=       # Service role key (server-only, cron routes)
GEMINI_API_KEY=                  # Google Gemini API key (AI processing)
CRON_SECRET=                     # Auth header for cron endpoints

# Email (F-04 Blindspot Digest)
RESEND_API_KEY=                  # Resend email API key
RESEND_FROM_EMAIL=               # Sender address (optional, defaults to onboarding@resend.dev)
NEXT_PUBLIC_APP_URL=             # App base URL for email links (optional)

# E2E testing (Playwright)
E2E_TEST_EMAIL=                  # Test user email for Playwright auth
E2E_TEST_PASSWORD=               # Test user password for Playwright auth
```
