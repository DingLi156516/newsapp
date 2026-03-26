# Architecture

> **Quick start?** See [README.md](../README.md) for setup, scripts, and project structure.

## What is RSS?

RSS stands for **Really Simple Syndication**. It's a standardized format that most news websites publish — think of it as a machine-readable "table of contents" for a website. Instead of a human opening CNN.com and scrolling through headlines, a program can fetch `cnn.com/rss/cnn_topstories.rss` and get a structured list of every recent article: title, link, description, publication date, and sometimes a thumbnail.

Nearly every major news outlet publishes an RSS feed. Axiom monitors **55 of them** — from Jacobin (far-left) to Breitbart (far-right) — and automatically collects every new article they publish.

---

## System Overview

Axiom has two halves:

1. **The backend pipeline** (automated, runs on a timer) — collects articles, figures out which ones are about the same event, and asks AI to analyze the political coverage
2. **The frontend** (what users see) — a filterable news feed showing every story with its political spectrum breakdown

### The Big Picture

```
55 News Outlets (RSS feeds)
        │
        ▼
┌──────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  INGEST (15 min) │────▶│  PROCESS (15 min)│────▶│  Supabase   │
│                  │     │                  │     │  Database   │
│  Fetch RSS feeds │     │  1. Assemble (AI)│     │             │
│  Remove dupes    │     │  2. Cluster      │     │  sources    │
│  Save articles   │     │  3. Embed (AI)   │     │  articles   │
└──────────────────┘     └──────────────────┘     │  stories    │
                                                   └──────┬──────┘
                                                          │
                              ┌────────────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │  Next.js App     │
                    │                  │
                    │  /          Feed  │
                    │  /story/id  Detail│
                    │  /sources  Directory│
                    │  /blindspot  Gaps │
                    │  /login     Auth  │
                    │  /signup    Auth  │
                    │  /dashboard Bias  │
                    │  /history  History│
                    │  /settings Prefs  │
                    │  /admin/review Admin│
                    │  /admin/pipeline   │
                    └──────────────────┘
```

### Stage 1: Collection (every 15 minutes)

**Endpoint:** `GET /api/cron/ingest`

1. **Feed registry** (`lib/rss/feed-registry.ts`) — asks the database "which outlets are active and have RSS URLs?" Returns all 55.
2. **RSS parser** (`lib/rss/parser.ts`) — fetches each outlet's RSS feed (with a 10-second timeout so a slow site doesn't jam everything) and extracts: title, URL, description, content, image, and publish date.
3. **Deduplication** (`lib/rss/dedup.ts`) — checks canonical URLs and legacy raw URLs against the database in batches. Already-seen articles are filtered out before insert.
4. **Ingestion** (`lib/rss/ingest.ts`) — orchestrates all the above. Fetches 5 feeds at a time (not all 55 at once, to avoid overwhelming connections). Saves new articles via upsert. Reports results: "42 feeds succeeded, 13 failed, 655 new articles."

Individual feed failures are caught and reported — if Fox News is down, NPR still gets ingested.

### Stage 2: AI Processing (every 15 minutes, staggered)

**Endpoint:** `GET /api/cron/process`

This runs three sub-stages in fair, downstream-first rounds:

#### 2a. Assembly (`lib/ai/story-assembler.ts`)

For each pending story (`assembly_status = 'pending'`), the system claims a bounded batch and runs **7 AI operations in parallel**:

| Operation | File | What it does |
|-----------|------|-------------|
| **Headline** | `headline-generator.ts` | Writes one neutral headline from all article titles |
| **Topic** | `topic-classifier.ts` | Picks one of 9 categories (politics, world, tech, etc.) |
| **AI Summary** | `summary-generator.ts` | Produces 3 perspectives: Common Ground, Left Framing, Right Framing |
| **Region** | `region-classifier.ts` | Classifies story into a geographic region (us, uk, etc.) |
| **Spectrum** | `spectrum-calculator.ts` | Calculates % breakdown by political leaning |
| **Blindspot** | `blindspot-detector.ts` | Flags stories where >80% coverage is from one side |
| **Entity Tags** | `entity-extractor.ts` + `tag-upsert.ts` | Extracts people, orgs, locations, topics; writes to `story_tags` before publication |

The headline prompt explicitly tells Gemini: *"avoid loaded language or bias framing."*

The summary prompt labels each article's source bias (e.g., `[LEFT] CNN: ...`, `[RIGHT] Fox News: ...`) so Gemini can distinguish perspectives.

Entity tags are written before the publication decision is applied, so published stories are never missing tags. After assembly, a pure publication-decision layer scores the story and either auto-publishes it or routes it to manual review. Sparse clusters (fewer than 2 articles or sources) go to review. Stories that fail assembly move to `assembly_status = 'failed'` and stay out of the public feed until reprocessed.
`assembly_claimed_at` acts as the in-flight lease for this stage; claims older than 60 minutes are treated as stale and can be reclaimed.

#### 2b. Clustering (`lib/ai/clustering.ts`)

This is where the magic happens. The system groups articles about the same event into a single "story":

1. Fetch all embedded articles that don't belong to a story yet
2. For each article, compare its fingerprint to existing stories using **cosine similarity** (a math operation that measures how "close" two vectors are — 1.0 = identical, 0.0 = completely unrelated)
3. If similarity >= **78%** to an existing story, assign it to that story
4. Otherwise, try to match it with other unassigned articles to form a new cluster
5. A cluster with **2+ articles** becomes a `standard` story immediately
6. Singletons remain unclustered and retry for up to **7 days**; after that they expire from the clustering pool

Clustering matches stories over the last **72 hours** by default.

Uses `clustering_claimed_at` as the article-stage lease marker, with the same 30 minute stale-claim recovery window as embedding.
New stories begin as `assembly_status = 'pending'` and `publication_status = 'draft'`.

#### 2c. Embedding (`lib/ai/embeddings.ts`)

Every article gets a **768-number fingerprint** that represents its meaning. The title + description are sent to Google Gemini's embedding model, which returns a vector like `[0.023, -0.018, 0.041, ...]`. Articles about the same event produce similar vectors, even if the words are completely different.

- Processes up to 100 articles per pass by default, in batches of 20 at the model layer
- Uses `embedding_claimed_at` to claim bounded batches safely between runs
- Fresh claims are skipped; claims older than 30 minutes are treated as stale and retried
- Once embedded, the article is flagged `is_embedded = true` and its claim is cleared

The process runner in `lib/pipeline/process-runner.ts` no longer drains stages linearly. It works in rounds, refreshes backlog between rounds, reserves time for downstream work, and records per-stage `passes`, `skipped`, and `skipReason` metadata so operators can see whether a stage had no backlog, made no progress, or was intentionally held back to protect clustering/assembly.

### Stage 3: Frontend

#### Data fetching pattern

Every page uses **SWR** (a caching library) to fetch data. While the API loads, **sample data** is shown as a fallback — the page is never blank. SWR also handles:
- Deduplicating identical requests
- Refreshing data when the user switches back to the tab
- Caching so repeated visits are instant

#### Pages

| Page | Route | What it shows |
|------|-------|-------------|
| **Home feed** | `/` | Filterable story feed with inline view switcher (Feed/Sources), feed tabs (For You/Trending/Latest/Blindspot/Saved), search, and advanced filters (topic, region, bias range, factuality, date, perspective presets); `/?view=sources` renders the sources directory inline |
| **Story detail** | `/story/[id]` | Hero image, headline, spectrum bar, AI perspective tabs (Common Ground / Left / Right), coverage-intelligence analysis cards, timeline, source list |
| **Sources** | `/sources` → redirects to `/?view=sources` | `/sources` is a server redirect; the sources directory renders inline on the home page via `SourcesView` |
| **Source profile** | `/sources/[slug]` | Single-outlet profile with metadata snapshot, recent clustered coverage, topic mix, blindspot participation, and methodology |
| **Source comparison** | `/sources/compare?left=<slug>&right=<slug>` | Two-outlet comparison with side-by-side metadata, shared coverage, exclusive stories, topic overlap, blindspot participation, and methodology |
| **Blindspot** | `/blindspot` | Stories where >80% coverage comes from one political side |
| **Login** | `/login` | Email + Google OAuth sign-in |
| **Signup** | `/signup` | New account registration (email + Google OAuth) |
| **Dashboard** | `/dashboard` | Bias calibration profile, blindspots, suggestions |
| **History** | `/history` | Reading history feed |
| **Settings** | `/settings` | User preferences form (topics, perspective, factuality, email digest) |
| **Admin Review** | `/admin/review` | Manual review queue for AI-generated story summaries (admin only) |
| **Admin Pipeline** | `/admin/pipeline` | Pipeline admin dashboard with live stats, run history, source health, and manual triggers (admin only) |

#### Key UI components

- **NexusCard** — the story card in the feed. Shows headline, spectrum bar, source count, factuality dots, blindspot badge, bookmark button
- **ViewSwitcher** — inline pill tab (Feed / Sources) in the page header; switches the home page content between the story feed and the `SourcesView`; updates URL to `/?view=sources` for browser back button support
- **MonochromeSpectrumBar** — the colored bar showing political coverage distribution (far-left through far-right)
- **AISummaryTabs** — three-tab panel showing Common Ground / Left Framing / Right Framing
- **SearchFilters** — expandable panel with topic, bias range, factuality, date range, region, and perspective preset filters
- **CoverageIntelligence** — story-detail panel that turns existing spectrum, AI summaries, ownership, and timeline data into momentum, gap, framing, and methodology analysis
- **SourceDirectoryInsights** — source-directory summary card that describes the currently filtered source set
- **SourceProfilePage** — source-detail shell that renders snapshot metadata, recent coverage, topic mix, and methodology copy
- **SourceComparisonPage** — source-comparison shell that renders a second-source picker, side-by-side snapshot cards, shared coverage, coverage gaps, and methodology copy

---

## Conventions

### Import Alias

- **Always** use `@/` for all project-relative imports
- `@/lib/types`, `@/components/atoms/BiasTag`, etc.
- Never use relative paths (`../`, `./`) for cross-directory imports

### Client Components

- Use `'use client'` only for components that require React state, effects, or browser APIs
- Static atoms (FactualityDots, BlindspotBadge, CoverageCount) are server-safe (no `'use client'`)
- All current pages are `'use client'` due to filtering state

### Async Params (Next.js 15)

- Story detail page uses `use(params)` for Next.js 15 async params
- Never access `params.id` directly — always unwrap with `use()`

### Middleware

- `middleware.ts` at project root — Supabase Auth session refresh on every request; protects routes as needed

### Immutability

- **Never** mutate state — always create new objects/arrays
- Use spread, `map`, `filter`, `reduce` for transformations

---

## Backend Modules

```
lib/auth/        — Authentication (3 files)
  types.ts          — Auth-related TypeScript types (AuthState, AuthUser, etc.)
  validation.ts     — Zod schemas for login/signup form validation
  auth-provider.tsx  — React context provider; wraps app with Supabase onAuthStateChange listener

lib/api/         — API utilities (16+ files)
  query-helpers.ts  — Supabase query builders; functions: queryStories(), queryStoryById(),
                      querySourceBySlug(), querySourcesForStory(), queryRecentStoriesForSource(),
                      querySources()
  transformers.ts   — DB row → frontend type converters; transformSource(), transformStory(),
                      transformStoryList()
  timeline-transformer.ts — Pure function: articles → timeline events (transformTimeline)
  validation.ts     — Zod schemas for query params; storiesQuerySchema, sourcesQuerySchema,
                      forYouQuerySchema, parseSearchParams()
  auth-helpers.ts   — Server-side auth utilities; session validation, user extraction from cookies
  bias-calculator.ts    — Pure functions: computeDistribution(), identifyBlindspots(), computeBiasProfile()
  bookmark-queries.ts   — queryBookmarks(), insertBookmark(), deleteBookmark()
  bookmark-validation.ts — Zod schema for bookmark storyId
  preferences-queries.ts — queryPreferences() (auto-creates defaults), updatePreferences()
  preferences-validation.ts — Zod schema for preferences update
  reading-history-queries.ts — queryReadingHistory(), queryReadStoryIds(), upsertReadingHistory(), markAsUnread()
  for-you-scoring.ts    — Pure scoring engine; scoreStory(), rankStoriesForUser(); types: ForYouSignals, ScoredStory
  for-you-queries.ts    — Query orchestration; queryForYouStories() (fetches signals, scores, paginates)
  admin-helpers.ts      — Admin authorization; verifyAdmin() checks admin_users table
  review-validation.ts  — Zod schemas for review actions; reviewActionSchema, reviewStatsSchema
  review-queries.ts     — queryReviewQueue(), updateReviewStatus(), queryReviewStats()

lib/supabase/    — Database layer (4 files)
  client.ts         — Browser-side Supabase client (uses NEXT_PUBLIC_ keys)
  server.ts         — Server-side Supabase client (for API routes and Server Components)
  types.ts          — DB schema types: DbSource, DbStory, DbArticle (and Insert variants),
                      Database (full type map for SupabaseClient<Database>)
  seed-sources.ts   — One-time script to seed sources table

lib/rss/         — Ingestion pipeline (5 files)
  feed-registry.ts  — Static list of RSS feeds to ingest
  parser.ts         — Parses RSS feeds into DbArticleInsert records
  normalization.ts  — URL normalization for dedup (canonical URL extraction)
  dedup.ts          — Detects duplicate articles by canonical URL plus legacy raw URL compatibility checks
  ingest.ts         — Orchestrates fetch → parse → dedup → insert pipeline

lib/pipeline/    — Pipeline orchestration helpers (5 files)
  backlog.ts         — Counts unembedded, unclustered, pending-assembly, and review backlog
  claim-utils.ts     — Shared stale-claim helpers for article/story leases
  logger.ts          — Persists pipeline_runs and pipeline_steps entries
  process-runner.ts  — Round-based process orchestration with downstream budget reservation and skip diagnostics
  story-state.ts     — Publication decision logic and legacy-state backfill helpers

lib/story-intelligence.ts — Pure story-detail analysis helpers; derives coverage rollups, momentum, gap summaries, framing-delta copy, methodology text, and ownership mix from existing frontend data
lib/source-profiles.ts — Pure source-profile helpers; builds topic mix, blindspot counts, and sample-data fallbacks for source detail pages
lib/source-comparison.ts — Pure source-comparison helpers; computes shared/exclusive coverage, topic overlap, topic imbalance, and sample-data fallback comparisons

lib/ai/          — AI processing (12 files)
  gemini-client.ts      — Thin Gemini REST client (uses GEMINI_API_KEY)
  embeddings.ts         — Generates vector embeddings for articles
  clustering.ts         — Groups articles into story clusters by embedding similarity; singletons stay unclustered and expire after 7 days
  spectrum-calculator.ts — Computes bias distribution (SpectrumSegment[]) per story cluster
  topic-classifier.ts   — Classifies a story cluster into a Topic
  headline-generator.ts — Synthesises a neutral headline from cluster headlines
  summary-generator.ts  — Generates cross-spectrum AISummary (commonGround, leftFraming, rightFraming)
  blindspot-detector.ts — Flags stories with skewed left/right coverage as blindspots
  region-classifier.ts  — Classifies a story cluster into a Region via Gemini
  entity-extractor.ts   — Extracts named entities (people, orgs, locations, topics) from article titles/descriptions via Gemini
  tag-upsert.ts         — Upserts extracted entities into story_tags table
  story-assembler.ts    — Coordinates the above modules to produce a complete DbStoryInsert

lib/email/       — Email delivery (2 files)
  resend-client.ts      — Thin Resend client wrapper (uses RESEND_API_KEY)
  send-digest.ts        — Builds and sends the weekly blindspot digest email

lib/offline/     — PWA / offline support (1 file)
  cache-manager.ts      — Cache API helpers for offline story storage

lib/hooks/       — SWR data-fetching hooks + auth hooks + utilities (23 files)
  fetcher.ts        — Base SWR fetcher; throws on non-OK responses
  use-stories.ts    — Hook for paginated feed; params: StoriesParams; returns stories, total,
                      page, isLoading, isError, error, mutate
  use-story.ts      — Hook for single story detail; conditional fetch (null key when id absent)
  use-story-timeline.ts — Hook for story timeline; returns StoryTimeline, isLoading, isError
  use-sources.ts    — Hook for source directory; same shape as use-stories
  use-source-profile.ts — Hook for a single source profile; falls back to sample-data rollups when API data is unavailable
  use-source-comparison.ts — Hook for comparing two sources; falls back to sample-data rollups when API data is unavailable
  use-auth.ts       — Hook for accessing auth state from AuthProvider context
  use-require-auth.ts — Hook that redirects unauthenticated users to /login
  use-bookmarks.ts    — Dual storage (Supabase auth / local anon), optimistic toggle
  use-preferences.ts  — SWR fetch + optimistic PATCH, DEFAULT_PREFERENCES fallback
  use-reading-history.ts — isRead, markAsRead, markAsUnread with optimistic updates
  use-bias-profile.ts — Fetches computed bias profile from dashboard API
  use-suggestions.ts  — Fetches bias-aware story recommendations
  use-for-you.ts    — SWR hook for "For You" personalized feed; null key when unauthenticated
  use-debounce.ts   — Generic debounce hook; params: value<T>, delay; returns debouncedValue<T>
  use-admin.ts      — Hook for checking admin status; returns isAdmin, isLoading
  use-review-queue.ts — SWR hook for review queue list; params: status filter, page; returns stories, total, mutate
  use-review-action.ts — Hook for approve/reject actions; optimistic update with mutate
  use-online.ts       — Online/offline connectivity hook; returns boolean isOnline
  use-filter-params.ts — Persists filter state in URL search params; survives navigation to story detail and back
  use-infinite-scroll.ts — IntersectionObserver-based infinite scroll; replaced "Load more" button
  use-pipeline.ts     — SWR hook for pipeline admin dashboard data (runs, stats, sources)
```

---

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stories` | Paginated story feed |
| `GET` | `/api/stories/[id]` | Single story detail |
| `GET` | `/api/stories/[id]/timeline` | Story coverage timeline |
| `GET` | `/api/sources` | Source directory |
| `GET` | `/api/sources/[slug]` | Single source profile with recent coverage rollups |
| `GET` | `/api/sources/compare?left=<slug>&right=<slug>` | Two-source comparison built from two 30-day source profiles |
| `GET` | `/api/cron/ingest` | Trigger RSS ingestion (protected by CRON_SECRET) |
| `GET` | `/api/cron/process` | Trigger AI clustering + assembly (protected by CRON_SECRET) |
| `GET` | `/auth/callback` | OAuth callback handler (Google OAuth redirect) |
| `GET` | `/api/bookmarks` | List user's bookmarked story IDs (auth required) |
| `POST` | `/api/bookmarks` | Create bookmark (auth required) |
| `DELETE` | `/api/bookmarks/[storyId]` | Remove bookmark (auth required) |
| `GET` | `/api/reading-history` | List read story IDs (auth required) |
| `POST` | `/api/reading-history/[storyId]` | Mark story as read (auth required) |
| `DELETE` | `/api/reading-history/[storyId]` | Mark story as unread (auth required) |
| `GET` | `/api/preferences` | Get user preferences (auth required) |
| `PATCH` | `/api/preferences` | Update user preferences (auth required) |
| `GET` | `/api/dashboard/bias-profile` | Computed bias distribution (auth required) |
| `GET` | `/api/dashboard/suggestions` | Bias-aware story recommendations (auth required) |
| `GET` | `/api/stories/for-you` | Personalized "For You" feed (auth required) |
| `GET` | `/api/admin/review` | Review queue list with status filter (admin required) |
| `PATCH` | `/api/admin/review/[id]` | Approve or reject a story (admin required) |
| `GET` | `/api/admin/review/stats` | Review queue statistics (admin required) |
| `GET` | `/api/admin/pipeline` | Pipeline dashboard overview (admin required) |
| `GET` | `/api/admin/pipeline/sources` | Source health data for pipeline admin (admin required) |
| `GET` | `/api/admin/pipeline/stats` | Pipeline statistics (admin required) |
| `GET` | `/api/admin/pipeline/trigger` | Trigger pipeline run manually (admin required) |
| `POST` | `/api/cron/digest` | Weekly blindspot digest email (protected by CRON_SECRET) |
All responses follow `{ success: boolean, data: T, meta?: { total, page, limit } }`.

### Query Parameters

**GET /api/stories** — `topic`, `search`, `blindspot`, `biasRange`, `minFactuality`, `datePreset`, `region`, `ids` (comma-separated story IDs, max 2000 chars), `page` (default 1), `limit` (default 20, max 50)
- Uses full-text search (`tsvector` + `textSearch()`) on headline/summary instead of `ilike`
- `biasRange` — comma-separated bias values (e.g., `'lean-left,center,lean-right'`)
- `minFactuality` — minimum factuality threshold (e.g., `'high'` includes high + very-high)
- `datePreset` — time range (default 'all'): `'24h'`, `'7d'`, `'30d'`, `'all'`

**GET /api/sources** — `bias`, `factuality`, `ownership`, `region`, `search`, `page` (default 1), `limit` (default 50, max 100)

**GET /api/sources/[slug]** — no query params; returns source snapshot metadata plus recent-coverage rollups for the last 30 days

**GET /api/sources/compare** — required query params: `left`, `right`; returns two source snapshots plus shared stories, exclusive stories, blindspot counts, and topic overlap/imbalance rollups for the last 30 days

**GET /api/stories/for-you** — `page` (default 1), `limit` (default 20, max 50). Auth required.

---

## Database (Supabase/PostgreSQL)

Six tables:

| Table | Rows | Purpose |
|-------|------|---------|
| **sources** | 55 | News outlet metadata: name, bias rating, factuality, ownership, RSS URL |
| **articles** | ~1,600+ | Raw articles from RSS: title, URL, content, embedding vector, which story they belong to |
| **stories** | 22+ | Clustered stories: AI headline, topic, spectrum, AI summary, blindspot flag, and explicit pipeline/publication state (migrations 010 + 013 + 016 + 017). `source_count` = unique sources (not article count), recalculated by migration 017 |
| **bookmarks** | per-user | user_id FK, story_id FK, created_at (migration 003) |
| **reading_history** | per-user | user_id FK, story_id FK, read_at, is_read (migration 003) |
| **user_preferences** | per-user | user_id FK, followed_topics, default_region, default_perspective, factuality_minimum, blindspot_digest_enabled (migrations 004, 009) |
| **admin_users** | per-admin | user_id FK (unique), role, created_at (migration 006) |

The **stories** table includes both legacy editorial status and explicit pipeline state:
- `review_status` — `pending | approved | rejected`
- `story_kind` — always `'standard'` (constrained by migration 016)
- `assembly_status` — `pending | processing | completed | failed`
- `publication_status` — `draft | needs_review | published | rejected`
- `review_reasons`, `confidence_score`, `processing_error`, `assembled_at`, `published_at`, `assembly_claimed_at`

The **articles** table also stores ingest/pipeline helpers including `canonical_url`, `title_fingerprint`, `embedding_claimed_at`, and `clustering_claimed_at`.

**pgvector** extension enables storing and searching 768-dimensional embedding vectors with a fast HNSW index.

**Row Level Security** ensures the browser can only read data — writes are restricted to the service role used by the cron jobs.

---

## End-to-End Example

A journalist publishes an article about a new climate bill on NPR:

1. **Ingest** — NPR's RSS feed is fetched, the article is saved to `articles` with `story_id = null`
2. **Embed** — "Climate bill passes Senate with bipartisan support" → `[0.023, -0.018, ...]` (768 numbers)
3. **Cluster** — The embedding is 82% similar to a Fox News article about the same bill → both get assigned to the same story
4. **Assemble** — AI generates headline: *"Senate Passes Major Climate Legislation"*, topic: `environment`, summary with three perspectives, spectrum: 60% left / 15% center / 25% right, not a blindspot
5. **Publish** — The classifier marks the story `published` if confidence is high enough, otherwise it lands in `/admin/review`
6. **API** — User opens Axiom, published stories appear in the feed with a spectrum bar and source count badge
7. **Detail** — User clicks in, sees NPR and Fox News listed as covering sources, reads how left outlets emphasize environmental impact while right outlets focus on economic costs

---

## E2E Testing Infrastructure

### data-testid Attributes
Key interactive components have `data-testid` attributes for Playwright selectors:
- `nexus-card`, `hero-card` — article cards
- `feed-tab-{for-you|trending|latest|blindspot|saved}` — feed tab buttons
- `topic-pill-{all|politics|world|...}` — topic filter pills
- `search-input` — search bar input
- `bookmark-button` — bookmark toggle
- `user-menu-trigger`, `user-menu-dropdown` — user menu
- `ai-tab-{common|left|right}` — AI summary tabs
- `stats-row` — stats grid

### Playwright Projects
```
setup → chromium-authenticated (storageState)
     → chromium-journeys (storageState)
chromium-public (no auth dependency)
```

### Auth Flow
`global-setup.ts` logs in test user → saves cookies to `e2e/.auth/user.json` → authenticated projects load this storageState.
