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
News Sources (RSS + Crawlers + APIs)
        │
        ▼
┌──────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  INGEST (15 min) │────▶│  PROCESS (15 min)│────▶│  Supabase   │
│                  │     │                  │     │  Database   │
│  RSS / Crawl /   │     │  1. Embed (AI)   │     │             │
│  API → dedup →   │     │  2. Cluster      │     │  sources    │
│  Save articles   │     │  3. Assemble (AI)│     │  articles   │
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

The ingestion pipeline supports three source types via `lib/ingestion/`:

| Source Type | Module | Concurrency | How it works |
|-------------|--------|-------------|-------------|
| **RSS** | `lib/rss/` | 5 | Fetches RSS/Atom feeds via `rss-parser` |
| **Crawler** | `lib/crawler/` | 2 | Discovers article URLs via cheerio CSS selectors, extracts content via `@mozilla/readability` + `linkedom`, respects `robots.txt` |
| **News API** | `lib/news-api/` | 1 | Queries NewsAPI.org and GDELT, with per-provider rate limiting |

All source types produce the same `ParsedFeedItem` format, so the downstream pipeline is unchanged.

**Ingestion flow:**

1. **Source registry** (`lib/ingestion/source-registry.ts`) — queries all active sources, groups by `source_type`
2. **Fetcher registry** (`lib/ingestion/fetcher-registry.ts`) — strategy pattern routing to type-specific fetchers
3. **Source fetchers** — each type's fetcher produces `ParsedFeedItem[]`:
   - RSS: `lib/rss/parser.ts` — 10s timeout, extracts title/URL/description/content/image/date
   - Crawler: discovers URLs → extracts via Readability → falls back to CSS selectors
   - News API: routes to NewsAPI.org or GDELT provider with quota tracking
4. **Deduplication** (`lib/rss/dedup.ts`) — checks canonical/raw URLs against DB in batches
5. **Pipeline helpers** (`lib/ingestion/pipeline-helpers.ts`) — per-source cap, batch insert, health updates
6. **Orchestrator** (`lib/ingestion/ingest.ts`) — `ingestAllSources()` fetches per-type concurrently, dedupes, inserts, returns per-type breakdown

Individual source failures are caught and reported — if one source is down, all others still get ingested.

### Stage 2: AI Processing (every 15 minutes, staggered)

**Endpoint:** `GET /api/cron/process`

This runs three sub-stages in fair, freshness-first rounds:

#### 2a. Assembly (`lib/ai/story-assembler.ts`)

For each pending story (`assembly_status = 'pending'`), the system claims a bounded batch. By default, assembly is deterministic and extractive with no model calls; `PIPELINE_ASSEMBLY_MODE=gemini` opts into the legacy generated-summary path.

| Operation | File | What it does |
|-----------|------|-------------|
| **Deterministic Assembly** | `deterministic-assembly.ts` | Chooses an extractive headline, local topic/region, extractive common-ground bullets, source-bias grouped title bullets, and deterministic key claims |
| **Legacy Gemini Classification** | `story-classifier.ts` | Only used with `PIPELINE_ASSEMBLY_MODE=gemini`; writes one neutral headline from all article titles, picks one of 9 categories, and classifies story into a geographic region |
| **Legacy Gemini Summary** | `summary-generator.ts` | Only used with `PIPELINE_ASSEMBLY_MODE=gemini`; produces Common Ground, Left Framing, Right Framing |
| **Spectrum** | `spectrum-calculator.ts` | Deterministically calculates % breakdown by political leaning |
| **Blindspot** | `blindspot-detector.ts` | Deterministically flags stories where >80% coverage is from one side |
| **Entity Tags** | `entity-extractor.ts` + `tag-upsert.ts` | Starts async local entity extraction after update and awaits completion at the end of the batch; writes `story_tags` |

Entity tag extraction is scheduled after the story update and runs concurrently with other stories in the batch; all tag promises are awaited at the end of the batch to prevent serverless termination before completion. Tagging failures are swallowed so they never block publication or retries. A pure publication-decision layer scores the story and either auto-publishes it or routes it to manual review. Sparse clusters (fewer than 2 articles or sources) go to review. Stories that fail assembly move to `assembly_status = 'failed'` and stay out of the public feed until reprocessed. Story claiming is batched. Story assembly runs with bounded concurrency (default 6, env: PIPELINE_ASSEMBLY_CONCURRENCY).
`assembly_claimed_at` acts as the in-flight lease for this stage; claims older than 60 minutes are treated as stale and can be reclaimed.

#### 2b. Clustering (`lib/ai/clustering.ts`)

This is where the magic happens. The system groups articles about the same event into a single "story":

1. Fetch all embedded articles that don't belong to a story yet
2. For each article, compare its fingerprint to existing stories using **cosine similarity** (a math operation that measures how "close" two vectors are — 1.0 = identical, 0.0 = completely unrelated)
3. If similarity >= **72%** to an existing story, assign it to that story
4. Otherwise, try to match it with other unassigned articles to form a new cluster
5. A cluster with **2+ articles** becomes a `standard` story immediately
6. Singletons remain unclustered while `clustering_attempts < 3`; once they hit the retry cap they are promoted into single-article stories. Separately, still-pending articles older than **7 days** are expired out of the clustering pool

Clustering matches stories over the last **7 days** by default.

Uses `clustering_claimed_at` as the article-stage lease marker, with the same 30 minute stale-claim recovery window as embedding.
New stories begin as `assembly_status = 'pending'` and `publication_status = 'draft'`.

#### 2c. Embedding (`lib/ai/embeddings.ts`)

Every article gets a **768-number fingerprint** that represents its meaning. The title + description are sent to Google Gemini's embedding model, which returns a vector like `[0.023, -0.018, 0.041, ...]`. Articles about the same event produce similar vectors, even if the words are completely different.

- Processes bounded batches driven by the process runner. Defaults live
  in `PIPELINE_DEFAULTS` (`lib/pipeline/process-runner.ts`): embed batch
  ceiling = 200, cluster batch ceiling = 300, assemble batch ceiling = 50;
  per-run targets = 1500 / 1500 / 100. These are adaptive CEILINGS —
  `lib/pipeline/batch-tuner.ts` shrinks the next pass when the EMA of the
  last 5 runs exceeds the per-stage target budget and restores when
  consistently under.
- Claims use the atomic `claim_articles_for_embedding`/`claim_articles_for_clustering`
  SECURITY DEFINER RPCs (migration 037) with a per-run `claim_owner` UUID.
  The RPCs issue a DB-side compare-and-set under `FOR UPDATE SKIP LOCKED`
  so two overlapping runners can never claim the same row, and releases are
  owner-scoped so a stale worker cannot release a newer worker's claim.
- Claims older than 30 minutes (article stages) or 60 minutes (assembly)
  are considered expired and become re-claimable.
- Once embedded, the article is flagged `is_embedded = true` and its claim
  is cleared atomically.

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
| **Story detail** | `/story/[id]` | Hero image, headline, spectrum bar, AI perspective tabs (Common Ground / Left / Right), headline roundup (L/C/R picks), coverage-intelligence analysis cards, bias drift chart (reuses existing timeline payload — no new endpoint), timeline, source list |
| **Sources** | `/sources` → redirects to `/?view=sources` | `/sources` is a server redirect; the sources directory renders inline on the home page via `SourcesView` |
| **Source profile** | `/sources/[slug]` | Single-outlet profile with metadata snapshot, recent clustered coverage, topic mix, blindspot participation, and methodology |
| **Source comparison** | `/sources/compare?left=<slug>&right=<slug>` | Two-outlet comparison with side-by-side metadata, shared coverage, exclusive stories, topic overlap, blindspot participation, and methodology |
| **Owner profile** | `/owners/[slug]` | Media-owner profile with owner metadata snapshot, controlled sources grid, bias distribution, topic mix, recent 180-day coverage, and methodology |
| **Blindspot** | `/blindspot` | Stories where >80% coverage comes from one political side |
| **Login** | `/login` | Email + Google OAuth sign-in |
| **Signup** | `/signup` | New account registration (email + Google OAuth) |
| **Dashboard** | `/dashboard` | Bias calibration profile, blindspots, Hot Now strip, suggestions |
| **History** | `/history` | Reading history feed |
| **Settings** | `/settings` | User preferences form (topics, perspective, factuality, email digest, anonymous engagement opt-out) |
| **Admin Review** | `/admin/review` | Manual review queue for AI-generated story summaries (admin only) |
| **Admin Pipeline** | `/admin/pipeline` | Pipeline admin dashboard with live stats, run history, source health, and manual triggers (admin only) |
| **Admin Sources** | `/admin/sources` | Source CRUD management with CSV import and RSS discovery (admin only) |

#### Key UI components

- **NexusCard** — the story card in the feed. Shows headline, spectrum bar, source count, factuality dots, blindspot badge, bookmark button
- **ViewSwitcher** — inline pill tab (Feed / Sources) in the page header; switches the home page content between the story feed and the `SourcesView`; updates URL to `/?view=sources` for browser back button support
- **MonochromeSpectrumBar** — the colored bar showing political coverage distribution (far-left through far-right)
- **AISummaryTabs** — three-tab panel showing Common Ground / Left Framing / Right Framing
- **SearchFilters** — expandable panel with topic, bias range, factuality, date range, region, and perspective preset filters
- **CoverageIntelligence** — story-detail panel that turns existing spectrum, AI summaries, ownership, and timeline data into momentum, gap, framing, and methodology analysis
- **SourceDirectoryInsights** — source-directory summary card that describes the currently filtered source set
- **SourceProfilePage** — source-detail shell that renders snapshot metadata, recent coverage, topic mix, and methodology copy
- **OwnerProfilePage** — owner-detail shell that renders owner snapshot, controlled sources grid, bias distribution, topic mix, recent 180-day coverage, and methodology copy
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

lib/api/         — API utilities (18+ files)
  query-helpers.ts  — Supabase query builders; functions: queryStories(), queryStoryById(),
                      querySourceBySlug(), querySourcesForStory(), queryRecentStoriesForSource(),
                      querySources(). queryStories() branches on sort=trending, filtering to the
                      last 7 days and ordering by the materialized `stories.trending_score` column.
  trending-score.ts — Pure function: computeTrendingScore(), shannonDiversityFactor(),
                      rankByTrendingScore(). impact × (1 + log10(velocity)) × diversity × time_decay.
  transformers.ts   — DB row → frontend type converters; transformSource(), transformStory(),
                      transformStoryList()
  timeline-transformer.ts — Pure function: articles → timeline events (transformTimeline)
  validation.ts     — Zod schemas for query params; storiesQuerySchema, sourcesQuerySchema,
                      forYouQuerySchema, parseSearchParams()
  auth-helpers.ts   — Server-side auth utilities; session validation, user extraction from cookies
  bias-calculator.ts    — Pure functions: computeDistribution(), identifyBlindspots(), computeBiasProfile()
  ownership-aggregator.ts — Pure function: computeOwnershipDistribution() — sources[] → {groups[], unknownCount, concentrationIndex (HHI/10000), dominantOwner}
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

lib/ingestion/   — Unified multi-source ingestion (6 files)
  types.ts          — Shared interfaces: IngestionSource, SourceFetcher, FetchResult
  source-registry.ts — Queries all active sources, groups by source_type
  fetcher-registry.ts — Strategy pattern mapping source type → fetcher
  pipeline-helpers.ts — Shared helpers: article insert, per-source cap, batch upsert, health updates
  rss-fetcher.ts    — RSS SourceFetcher adapter (wraps lib/rss/parser.ts)
  ingest.ts         — Unified orchestrator: ingestAllSources() replaces ingestFeeds()

lib/rss/         — RSS feed parsing (6 files)
  feed-registry.ts  — RSS-only source registry (convenience wrapper)
  parser.ts         — Parses RSS feeds via rss-parser, produces ParsedFeedItem[]
  normalization.ts  — URL normalization for dedup (canonical URL extraction)
  dedup.ts          — Detects duplicate articles by canonical URL plus legacy raw URL compatibility checks
  ingest.ts         — Legacy RSS-only orchestrator (superseded by lib/ingestion/ingest.ts)
  discover.ts       — RSS auto-discovery: parse HTML <link> tags + probe common feed paths

lib/crawler/     — Web crawler module (7 files)
  types.ts          — CrawlerConfig, ExtractedArticle interfaces
  robots.ts         — robots.txt compliance (fetch, cache, check per URL)
  article-discovery.ts — Discovers article URLs via CSS selectors on list pages
  article-extractor.ts — Content extraction via Readability + cheerio fallback
  fetcher.ts        — Crawler SourceFetcher implementation
  validation.ts     — Zod schema for CrawlerConfig
  js-renderer.ts    — Optional Playwright wrapper for JS-rendered pages

lib/news-api/    — Third-party news API module (5 files + 2 providers)
  types.ts          — NewsApiConfig, NewsApiProvider types
  rate-limiter.ts   — Per-provider quota tracking (NewsAPI 100/day, GDELT 1/sec)
  fetcher.ts        — News API SourceFetcher implementation
  validation.ts     — Zod schema for NewsApiConfig
  providers/newsapi.ts — NewsAPI.org client (top-headlines endpoint)
  providers/gdelt.ts   — GDELT API client (ArtList mode)

lib/utils/       — Client-side utilities
  csv-parser.ts     — CSV parsing for admin source bulk import (no external deps)

lib/pipeline/    — Pipeline orchestration helpers (6 files)
  backlog.ts         — Counts unembedded, unclustered, pending-assembly, and review backlog
  claim-utils.ts     — Shared stale-claim helpers for article/story leases
  logger.ts          — Persists pipeline_runs and pipeline_steps entries
  process-runner.ts  — Round-based process orchestration with freshness-first budget reservation and skip diagnostics
  story-state.ts     — Publication decision logic and legacy-state backfill helpers
  telemetry-utils.ts — Shared telemetry helpers (toPerMinute rate calculation)

lib/story-intelligence.ts — Pure story-detail analysis helpers; derives coverage rollups, momentum, gap summaries, framing-delta copy, methodology text, and ownership mix from existing frontend data
lib/wikidata/sparql-client.ts — Build-time Wikidata SPARQL wrapper (rate-limit, timeout, retry, UA) used by scripts/seed-ownership.ts. Not imported by runtime code.
lib/source-profiles.ts — Pure source-profile helpers; builds topic mix, blindspot counts, and sample-data fallbacks for source detail pages
lib/source-comparison.ts — Pure source-comparison helpers; computes shared/exclusive coverage, topic overlap, topic imbalance, and sample-data fallback comparisons

lib/ai/          — AI processing (12 files)
  gemini-client.ts      — Thin Gemini REST client (uses GEMINI_API_KEY)
  embeddings.ts         — Generates vector embeddings for articles
  clustering.ts         — Groups articles into story clusters by embedding similarity (6 composable stages: fetch, claim, pgvector+JS Pass 1, union-find Pass 2, persist assignments, persist clusters); singletons stay unclustered and expire after 7 days
  recluster.ts          — Re-clustering maintenance: merges fragmented story pairs, ejects misassigned articles below split threshold
  deterministic-assembly.ts — Builds no-cost extractive story headline, summary, classification, and key-claim fields
  spectrum-calculator.ts — Computes bias distribution (SpectrumSegment[]) per story cluster
  topic-classifier.ts   — Provides deterministic keyword-based topic fallback
  region-classifier.ts  — Provides deterministic keyword-based region fallback
  thin-topic-classifier.ts — Multi-signal topic/region classifier for the thin path (RSS `<category>` → per-source topic prior → keyword fallback → default). Zero Gemini calls.
  story-classifier.ts   — Legacy Gemini headline/topic/region generation when `PIPELINE_ASSEMBLY_MODE=gemini`
  summary-generator.ts  — Legacy Gemini cross-spectrum AISummary generation when `PIPELINE_ASSEMBLY_MODE=gemini`
  summary-verifier.ts   — Verify-then-regenerate wrapper around generateAISummary; checks keyQuotes appear verbatim in source articles (fuzzy whitespace) and keyClaims have ≥60% token overlap; regenerates up to 2× with drop hints before dropping unverified fields
  blindspot-detector.ts — Flags stories with skewed left/right coverage as blindspots
  entity-extractor.ts   — Extracts named entities (people, orgs, locations, topics) from article titles/descriptions with local heuristics
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
  use-routing-preview.ts — SWR hook for `/api/admin/review/[id]/routing-preview`; returns which assembly path the pipeline would pick for a story (rich/single/thin) plus applied thresholds
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
| `GET` | `/api/owners` | Media owner directory (paginated, optional search + owner_type filter) |
| `GET` | `/api/owners/[id]` | Single owner detail (UUID-keyed) with associated sources |
| `GET` | `/api/owners/by-slug/[slug]` | Owner profile with controlled sources, recent 180-day coverage, bias distribution, and topic breakdown |
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
| `GET` | `/api/dashboard/hot-stories` | Top 5 stories by recent unique-viewer count (last 6h, auth required) |
| `POST` | `/api/events/story` | Anonymous engagement telemetry insert (`view`/`dwell`/`read_through`/`share`); honors DNT, drops without session id |
| `GET` | `/api/stories/for-you` | Personalized "For You" feed (auth required) |
| `GET` | `/api/admin/review` | Review queue list with status filter (admin required) |
| `PATCH` | `/api/admin/review/[id]` | Approve or reject a story (admin required) |
| `GET` | `/api/admin/review/[id]/routing-preview` | Preview which assembly path (`rich`/`single`/`thin`) the pipeline would select for this story, with applied thresholds + mode override (admin required) |
| `GET` | `/api/admin/review/stats` | Review queue statistics (admin required) |
| `GET` | `/api/admin/pipeline` | Pipeline dashboard overview (admin required) |
| `GET` | `/api/admin/pipeline/sources` | Source health data for pipeline admin (admin required) |
| `GET` | `/api/admin/pipeline/stats` | Pipeline statistics (admin required) |
| `POST` | `/api/admin/pipeline/trigger` | Trigger pipeline run manually (admin required) |
| `GET` | `/api/admin/pipeline/events` | Pipeline stage event drill-down; filters `runId`, `stage`, `level`, `limit`, `offset` (admin required) |
| `POST` | `/api/cron/digest` | Weekly blindspot digest email (protected by CRON_SECRET) |
| `GET` | `/api/cron/recluster` | Hourly re-clustering maintenance — merge fragmented stories, eject misassigned articles (protected by CRON_SECRET) |
| `GET` | `/api/admin/sources` | List all sources with filters (admin required) |
| `POST` | `/api/admin/sources` | Create new source (admin required) |
| `PATCH` | `/api/admin/sources/[id]` | Update source (admin required) |
| `POST` | `/api/admin/sources/import` | Bulk CSV import of sources (admin required) |
| `POST` | `/api/admin/sources/discover-rss` | Discover RSS feeds from URL (admin required) |
All responses follow `{ success: boolean, data: T, meta?: { total, page, limit } }`.

### Query Parameters

**GET /api/stories** — `topic`, `search`, `blindspot`, `biasRange`, `minFactuality`, `datePreset`, `region`, `tag`, `tag_type`, `owner` (media-owner slug, e.g. `warner-bros-discovery`), `sort`, `ids` (comma-separated story IDs, max 2000 chars), `page` (default 1), `limit` (default 20, max 50)
- Uses full-text search (`tsvector` + `textSearch()`) on headline/summary instead of `ilike`
- `biasRange` — comma-separated bias values (e.g., `'lean-left,center,lean-right'`)
- `minFactuality` — minimum factuality threshold (e.g., `'high'` includes high + very-high)
- `datePreset` — time range (default 'all'): `'24h'`, `'7d'`, `'30d'`, `'all'`
- `sort` — `'last_updated'` (default, `published_at DESC`), `'source_count'` (most-covered first), or `'trending'`. Trending orders by the materialized `stories.trending_score` column (migration 050) within the last 7 days using normal SQL pagination, with `biasRange` applied in SQL via JSONB containment before `.range()`. The score is computed at story-assembly time via `lib/api/trending-score.ts` (`impact × (1 + log10(articles_24h)) × diversity × time_decay`); the dedicated cron `GET /api/cron/refresh-trending` calls `refresh_trending_scores()` on a schedule (recommended 15 min) to keep the stored time-decay component fresh and evict aged-out rows from the partial index.
- `owner` — media-owner slug (lowercase, hyphenated; validated against `^[a-z0-9][a-z0-9-]*$`, max 100 chars). `queryStories` resolves slug → `media_owners.id` → `sources.id[]` (active only) → distinct `articles.story_id[]`, then applies as `.in('id', storyIds)`. **Bounded scope:** the filter is a "recent coverage" feed, not an all-time archive — it uses a 180-day article window (`OWNER_FILTER_WINDOW_DAYS`) and caps the materialized ID list at 1000 (`OWNER_FILTER_MAX_STORY_IDS`) so the downstream `.in()` URL stays well under proxy limits. The UI copy ("View recent stories from X") reflects this contract. Archival owner coverage or owners with thousands of distinct stories in-window will require a SQL-side predicate (RPC or materialized `stories.owner_ids[]`) to lift these bounds. Intersects cleanly with the `ids` param — empty intersection short-circuits before hitting the stories query. Returns empty when the slug is unknown, the owner has no active sources, or no articles fall inside the window.

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
| **stories** | 22+ | Clustered stories: AI headline, topic, spectrum, AI summary, blindspot flag, and explicit pipeline/publication state (migrations 010 + 013 + 016 + 017 + 029). `source_count` = unique sources (not article count), recalculated by migration 017. Migration 029 fixes single-source metadata (blindspot, controversy, sentiment) |
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

**pgvector** extension enables storing and searching 768-dimensional embedding vectors with a fast HNSW index. The `match_story_centroid` RPC function performs HNSW-accelerated centroid similarity search for clustering Pass 1 (migration 031).

**Row Level Security** ensures the browser can only read data — writes are restricted to the service role used by the cron jobs.

---

## Observability

Pipeline observability is split across two complementary tables:

| Table | Purpose | Written by | Granularity |
|-------|---------|-----------|-------------|
| `pipeline_runs` | High-level run summary — type, trigger, status, aggregate metrics, per-step durations. One row per cron or admin invocation. | `PipelineLogger.startRun/complete/fail` | Per-run |
| `pipeline_stage_events` | Structured drill-down of warn/error events that fire inside a stage (pgvector fallback, DLQ push, tag extraction failure, retry count read failure, cleanup fallback). Multiple rows per run. | `PipelineLogger.stageEvent` via a pre-bound `StageEventEmitter` | Per-event within a run |

The two tables share a correlation key: `pipeline_stage_events.run_id` points to `pipeline_runs.id`. When an operator notices a degraded run in `PipelineRunHistory`, they can click through to `PipelineEventsPanel` and filter by that `runId` to see every warn/error that contributed.

**Write path.** Cron and admin trigger routes build the emitter once per run:

```ts
const runId = await logger.startRun('process', 'cron')
const claimOwner = generateClaimOwner()
const emitter = logger.makeStageEmitter(runId, claimOwner)

await runProcessPipeline({
  embed: (max) => embedUnembeddedArticles(client, max, claimOwner, emitter),
  cluster: (max) => clusterArticles(client, max, claimOwner, emitter),
  assemble: (max) => assembleStories(client, max, undefined, claimOwner, emitter),
  // …
})
```

Stage functions accept an optional trailing `emitter?: StageEventEmitter` parameter that defaults to `noopStageEmitter`, so they remain callable from tests and one-off scripts without any observability wiring. Every stage call site wraps its emit through the `safeEmit(emitter, input)` helper from `lib/pipeline/stage-events.ts` — `StageEventEmitter` is a bare function type so nothing at the type level forbids a caller from passing in a rejecting emitter. `safeEmit` catches both thrown and rejected errors and logs them via `console.warn`, keeping the "observability outage can never stall the pipeline" contract intact regardless of which emitter got passed in. `PipelineLogger.stageEvent` itself is also best-effort: it catches DB errors and never throws, so the wrapper is a no-op in the common case.

**Dedupe.** Fallback emissions that would otherwise fire once per article/story (e.g. `pgvector_fallback` during an RPC outage) are gated by a local `fallbackEmitted` flag inside `matchAgainstExistingStories` (clustering) and `detectAndMergeStories` (recluster). Exactly one warn event is written per call regardless of how many items tripped the fallback.

**Recluster correlation.** The hourly `/api/cron/recluster` route does not fit the `pipeline_runs.run_type` enum (`ingest|process|full`), so it generates a per-invocation `correlationId` via `randomUUID()` and calls `logger.makeStageEmitter(correlationId, null)` — `claimOwner` is `null` because recluster does not hold a pipeline claim lease. Operators see recluster events tagged with that correlation ID in `pipeline_stage_events` even though no corresponding `pipeline_runs` row exists. The `correlationId` is returned in the cron route response.

**When to emit vs. when to use `pipeline_runs.steps`.** Prefer `pipeline_runs.steps` (via `logger.logStep`) for the happy-path per-pass timing and result. Prefer `stageEvent` for error and warn sites that need a payload, a correlation ID, and a free-text event type (`pgvector_fallback`, `dlq_pushed`, `tag_extraction_failed`, `retry_count_read_failed`, `cleanup_fallback_failed`, `embedding_write_failed`). Debug/info emissions are currently reserved for high-value checkpoints; routine stage entry/exit duplicates `pipeline_runs.steps` and should not be emitted.

**Read path.** Admins use `GET /api/admin/pipeline/events?runId=…&stage=…&level=warn,error` (Zod-validated, limit capped at 500) from the `PipelineEventsPanel` organism on `/admin/pipeline`. The route uses the service-role client because the table's RLS policy only grants access to service_role (see `supabase/migrations/044_pipeline_stage_events.sql`).

**Retention.** `pipeline_stage_events` grows unbounded. No automated retention job exists yet — operators can manually run `DELETE FROM pipeline_stage_events WHERE created_at < now() - interval '30 days'` if the table balloons. This is noted in `docs/operations.md`.

**Owner-scoped state transitions (Phase 10).** Every stage write that
clears a `*_claim_owner` column is routed through `runOwnerScopedUpdate`
(`lib/pipeline/claim-utils.ts`) which applies `.eq(ownerColumn, owner)`,
requests `{ count: 'exact' }`, and on `count === 0` does a verify-read
to distinguish benign **ownership moved** (another worker re-claimed
the item after a TTL expiry) from **policy drift** (claim still ours
but the write matched zero rows — a schema-level problem). Benign
cases emit an `ownership_moved` info event and skip follow-up work
(DLQ push, version bump, tag extraction). Policy drift throws a
`[<stage>/policy_drift]`-prefixed error so operators see the issue in
`pipeline_runs.steps`. The helper is the canonical template — the
Phase 7b clustering cleanup fallback (`lib/ai/clustering.ts:1486`) is
the inlined pattern it extracts.

The `create_story_with_articles` RPC (migration 045) enforces the same
predicate inside its transactional UPDATE via
`AND clustering_claim_owner = p_owner`, so the singleton-promotion and
new-cluster creation paths are owner-safe end-to-end. Partial ownership
mismatch raises SQLSTATE **P0010** (a dedicated code reserved for owner
mismatch, distinct from the migration's plain P0001 null-validation
guards), which the JS wrapper translates to `{ kind: 'ownership_moved' }`
in the `CreateStoryOutcome` discriminated union — callers handle this
as a benign skip without retries. The wrapper also runtime-validates
`owner` is a non-empty string before calling the RPC, so caller bugs
fail loud as `{ kind: 'error' }` instead of being silently swallowed.

Pipeline runs under the Supabase service role, so verify-reads are not
filtered by RLS — `data: null` from a verify-read unambiguously means
the row does not exist.

---

## End-to-End Example

A journalist publishes an article about a new climate bill on NPR:

1. **Ingest** — NPR's RSS feed is fetched, the article is saved to `articles` with `story_id = null`
2. **Embed** — "Climate bill passes Senate with bipartisan support" → `[0.023, -0.018, ...]` (768 numbers)
3. **Cluster** — The embedding is 82% similar to a Fox News article about the same bill → both get assigned to the same story
4. **Assemble** — deterministic assembly chooses an extractive headline, topic: `environment`, source-bias grouped summary fields, spectrum: 60% left / 15% center / 25% right, not a blindspot
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
