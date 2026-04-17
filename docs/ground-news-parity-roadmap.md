# Axiom News — Ground News Parity: Data Enrichment Roadmap

## Context

**Why this exists.** Axiom News currently computes a rich set of per-story signals (`impact_score`, `story_velocity`, `controversy_score`, `source_diversity`, `sentiment`, `key_quotes`, `key_claims`, `confidence_score`) but ranks the feed purely by `published_at DESC`. The "Trending" tab is a label on a recency sort — identical to "Latest". Peer products (Ground News, AllSides, Improve the News, Techmeme) differentiate on dimensions we either don't surface or don't compute at all: source ownership grouping, bias-over-time, establishment-vs-anti-establishment axis, tone/sensationalism, blind-bias reader calibration, proper velocity-based trending, headline roundups, and author leaderboards.

**Outcome.** A 6-phase roadmap that (a) fixes Trending using signals we already compute, (b) ships Ground-News-class differentiators (ownership, bias drift, blind-bias calibration), and (c) adds the signal infrastructure (engagement capture, new AI classifiers) required for the deeper features. Each phase is independently shippable and delivers a user-visible win.

---

## Current State — Findings (summary)

### Data we produce but never rank on
| Signal | Where | Used by ranking? |
|---|---|---|
| `story_velocity` (articles_24h/48h/7d, phase) | `lib/ai/story-metrics.ts` | ❌ display only |
| `impact_score` (0-100 composite) | `lib/ai/story-metrics.ts:71-90` | ❌ display only |
| `controversy_score` (0-1, L/R text divergence) | `lib/ai/story-metrics.ts` | ❌ display only |
| `source_diversity` (unique ownership count) | `lib/ai/story-metrics.ts` | ❌ display only |
| `is_blindspot` | `lib/ai/blindspot-detector.ts` | ✅ For-You only (+30 pts) |
| `published_at` | ingestion | ✅ sole default sort |

### Data we produce but barely display
- `key_quotes`, `key_claims`, `sentiment`, `tags[], relevance` — story detail only, never on cards.
- `media_owners.{owner_type, is_individual, country, wikidata_qid}` — table exists, rarely surfaced.
- `confidence_score`, `review_reasons`, processing metadata — admin-only.

### Feature parity gaps vs. peers
| Dimension | Axiom | Ground News | AllSides | Improve the News | Techmeme |
|---|---|---|---|---|---|
| Source ownership grouping | ❌ | ✅ 2,276 hand-coded | ❌ | ❌ | — |
| Bias-over-time / bias drift | ❌ | ✅ | ❌ | ❌ | — |
| Establishment ↔ anti-establishment axis | ❌ | ❌ | ❌ | ✅ signature | — |
| Tone: sensational ↔ empirical | ❌ | ❌ | ❌ | ✅ | — |
| Shelf-life: evergreen ↔ fast-expiring | ❌ | ❌ | ❌ | ✅ | — |
| Blind-bias reader calibration | ❌ | ❌ | ✅ patented | ❌ | — |
| Headline Roundups (L/C/R side-by-side) | 🟡 coverage list | 🟡 | ✅ signature | ❌ | — |
| Velocity-based trending | ❌ | ✅ | ❌ | ❌ | ✅ link velocity |
| Author/reporter leaderboard | ❌ | ❌ | ❌ | ❌ | ✅ |
| Burst detection on claims/entities | ❌ | ❌ | ❌ | ❌ | — |
| Story Context / claim timeline with first-reported-by | 🟡 timeline | ✅ | ❌ | ✅ | — |

---

## Open decisions (confirm before implementation)

Before committing any single phase, three calls determine scope:

1. **Engagement telemetry** — capture anonymous `view_events (story_id, user_id|session_id, dwell_ms, action, ts)` for ranking and My-News-Bias features? Without this, Trending stays editorially-computed (mechanically sound but misses reader signal). **Assumption in this plan:** yes, minimal (view + dwell bucket + share), opt-out respected, PII-free — added in Phase 3.
2. **Ownership data source** — populate `media_owners` via (a) Wikidata `P127` automated pass, (b) hand-audit top ~200 outlets, or (c) third-party license. **Assumption:** hybrid — Wikidata seed + hand-audit top 100 (covers ~80% of our ingest volume).
3. **AI classifier budget** — 3 new per-article Gemini passes (establishment axis, tone, shelf-life) add ~2× pipeline cost. **Assumption:** acceptable; run at article ingest not story assembly so we amortize via caching.

All three are flagged again in the phases that consume them.

---

## Roadmap (6 phases)

Each phase ships a user-visible differentiator and is independently deployable. Phases 1, 2, 5 use signals we already compute — immediate wins. Phases 3, 4, 6 add new signals.

### Phase 1 — Real Trending + Surface Existing Metrics ✅ SHIPPED
**Goal.** Make "Trending" an actual algorithm, and expose already-computed signals on feed cards.

**Trending score (`lib/api/trending-score.ts`):**
```
trending_score = impact_score
               × (1 + log10(max(articles_24h, 1)))    # velocity kicker
               × diversity_factor                        # shannon entropy over bias buckets, 0-1
               × time_decay                              # (1 / (hours_since_published + 2)^1.5), HN-style
```
- `impact_score` (0-100) already computed.
- `diversity_factor` = normalized Shannon entropy of `spectrum_segments` — rewards balanced coverage, penalizes echo chambers.
- Half-life behavior governed by `gravity=1.5`.
- Added `sort=trending` branch to `lib/api/query-helpers.ts` (alongside existing `source_count` and default). Phase 1 shipped with **materialized column** (not the original "compute on read" plan) — see `docs/architecture.md` for the materialization + refresh contract (migration 050).

**UI surfacing (no new data):**
- `NexusCard`: compact `MetricsRow` — impact chip (0-100), articles_24h count, owner diversity. Only shown when `showMetrics` prop is true (Trending sort).
- `HeroCard`: same metrics row, same conditional.
- Home page: Trending tab passes `sort=trending`. "Latest" keeps `published_at DESC`.
- Mobile parity via `apps/mobile/components/molecules/MetricsRow.tsx` + `apps/mobile/app/(tabs)/index.tsx`.

**Files touched (shipped):**
- `lib/api/trending-score.ts` — new (pure function, 18 unit tests)
- `lib/api/query-helpers.ts` — trending sort branch + SQL-side biasRange
- `lib/api/validation.ts` — `'trending'` in SORT_FIELDS
- `lib/hooks/use-stories.ts` — `sort` param (web)
- `lib/hooks/feed-filter-key.ts` — new, with 7 tests (page-reset correctness)
- `components/molecules/MetricsRow.tsx` + mobile mirror — 7 tests
- `components/organisms/NexusCard.tsx`, `HeroCard.tsx` — web + mobile
- `app/page.tsx`, `apps/mobile/app/(tabs)/index.tsx` — wiring + sync page reset pattern
- `supabase/migrations/050_story_trending_score.sql` — column, partial index, `refresh_trending_scores()`, `compute_diversity_factor()`, privilege lockdown
- `app/api/cron/refresh-trending/route.ts` — new dedicated 15-min cron
- `vercel.json` — cron schedule
- `lib/supabase/types.ts` — regenerated fields

**Verify (shipped state).** 18 trending-score unit tests + 5 query-helpers trending tests + 7 feed-filter-key tests + 7 MetricsRow tests. All 1992 tests pass. `npm run build` zero errors.

---

### Phase 2 — Source Ownership Graph
**Goal.** Surface "8 of 10 sources owned by Sinclair" on story detail and source directory. This is Ground News's single biggest differentiator.

**Data work:**
- Wikidata seed pass: script `scripts/seed-ownership.ts` reads every active source, queries Wikidata SPARQL for `P127` (owned-by) + `P17` (country) + `P571` (inception), writes to `media_owners` and fills `sources.owner_id`.
- Hand-audit top 100 outlets by article volume (one-off CSV import). Store provenance in `media_owners.owner_source` ('wikidata' | 'manual' | 'third-party').

**UI:**
- `SourceList.tsx` / `components/molecules/SourceList.tsx`: group sources by `owner_id`; show "8 sources / 3 owners" summary.
- `OwnershipBar` — new molecule: horizontal bar split by owner ("40% Sinclair, 30% News Corp, 30% other").
- `SourcesView.tsx`: add "Owner" column, sort-by-owner.
- Story detail: `OwnershipSummary` block under coverage — "This story's coverage is concentrated in 3 conglomerates."
- Mobile: mirror on source list + story detail.

**Files to touch:**
- `lib/supabase/types.ts` — verify `media_owners` columns; add migration if needed
- `scripts/seed-ownership.ts` — new
- `lib/api/ownership-aggregator.ts` — new pure function: sources[] → ownership distribution
- `components/molecules/OwnershipBar.tsx` + `components/organisms/OwnershipSummary.tsx` — new
- `components/organisms/SourcesView.tsx`, `components/organisms/SourceList.tsx` — grouping
- `docs/types.md`, `docs/components.md` — update

**Verify.** Integration test: story with 10 sources across 3 owners returns correct distribution. E2E: story detail shows ownership bar when owner diversity < 0.5.

---

### Phase 3 — Engagement Capture + Ranking Loop
**Goal.** Anonymous telemetry so ranking reflects reader behavior, not just editorial math. Also unlocks "My News Bias" depth.

**Schema (migration `0XX_engagement_events.sql`):**
```
story_views (
  id uuid PK,
  story_id uuid FK,
  user_id uuid NULL,                 -- null for anonymous
  session_id text NOT NULL,          -- hashed device/session
  viewed_at timestamptz DEFAULT now(),
  dwell_bucket smallint,             -- {0-5s, 5-30s, 30-120s, >120s}
  action text CHECK IN ('view','share','bookmark','read-through'),
  referrer text,
  INDEX (story_id, viewed_at DESC),
  INDEX (user_id, viewed_at DESC)
)
```

**Client:**
- `lib/hooks/use-story-telemetry.ts` — new. Fires `view` on mount, `dwell` on unmount with bucketed ms, `read-through` if scroll ≥ 80%. Debounced; honors Do-Not-Track header.
- `/api/events/story` POST endpoint (`app/api/events/story/route.ts`) — Zod-validated, rate-limited.
- Privacy: no IP stored; session_id = rotating HMAC of (cookie, UA) with daily key rotation.

**Ranking:**
- Extend Phase 1 trending: add `engagement_factor = log10(1 + unique_viewers_6h)` multiplied in.
- For-You: add "similar-to-what-you-read" cosine over story embeddings weighted by read-through rate.

**UI:**
- Dashboard gets a "Hot now" card — top 5 by `engagement_factor`, visible only to signed-in users.

**Files to touch:**
- `supabase/migrations/0XX_engagement_events.sql` — new
- `lib/api/engagement-queries.ts`, `lib/api/telemetry-validation.ts` — new
- `app/api/events/story/route.ts` — new
- `lib/hooks/use-story-telemetry.ts` — new
- `lib/api/trending-score.ts` — consume engagement factor
- `lib/api/for-you-scoring.ts:36-43` — add read-similarity bonus
- `lib/supabase/types.ts` — regenerate
- `apps/mobile/` — mirror telemetry hook (Expo tracks backgrounding differently)

**Verify.** Privacy audit: no PII stored. Load test: 100 rps on `/api/events/story`. Integration test: synthetic views bump a story's trending rank deterministically. E2E: `test:e2e` scroll to bottom → dwell event recorded.

---

### Phase 4 — New Signal Dimensions (Establishment, Tone, Shelf-life)
**Goal.** Three new per-article classifications giving users sliders beyond L/R — the Improve-the-News playbook.

**Schema (migration):**
```
ALTER TABLE articles ADD COLUMN establishment_score REAL      CHECK 0..1;   -- 0=anti, 1=establishment
ALTER TABLE articles ADD COLUMN tone_score         REAL      CHECK 0..1;   -- 0=empirical, 1=sensational
ALTER TABLE articles ADD COLUMN shelf_life         TEXT      CHECK IN ('breaking','analysis','explainer','evergreen');
```

**AI pipeline:**
- `lib/ai/establishment-classifier.ts` — new Gemini prompt with rubric anchors and few-shot examples from labeled sample (50 articles).
- `lib/ai/tone-classifier.ts` — combines heuristics (all-caps, exclamations, superlative density) with Gemini verifier.
- `lib/ai/shelf-life-classifier.ts` — topic taxonomy + article-type cues (e.g. "breaking", datelines, quote density).
- Run at article-ingest (not story-assembly) so cost amortizes across cluster members.

**Story-level rollup:**
- `stories.establishment_distribution JSONB` — same shape as `spectrum_segments`.
- `stories.tone_avg REAL`, `stories.shelf_life_dominant TEXT`.

**UI:**
- Story detail: new `EstablishmentBar` (mirror of `MonochromeSpectrumBar`) + tone chip + shelf-life badge.
- Filter bar: add Establishment slider alongside Bias filter.
- Settings: add establishment/tone/shelf-life preferences for For-You.
- For-You scoring: add shelf-life × user preference weight (readers who prefer analysis over breaking).

**Files to touch:**
- `supabase/migrations/0XX_new_axes.sql` — new
- `lib/ai/establishment-classifier.ts`, `tone-classifier.ts`, `shelf-life-classifier.ts` — new
- `lib/ai/pipeline-helpers.ts` — wire new stages
- `lib/api/query-helpers.ts` — new filter params
- `components/molecules/EstablishmentBar.tsx`, `ToneChip.tsx`, `ShelfLifeBadge.tsx` — new
- `components/organisms/SettingsForm.tsx` — preference fields
- `lib/api/for-you-scoring.ts` — new weight
- `docs/types.md`, `docs/pipeline.md` — update

**Verify.** Gold-set of 50 hand-labeled articles per dimension; target ≥75% agreement. Cost measurement: Gemini spend before/after. E2E: filter "empirical only" removes flagged sensational article.

---

### Phase 5 — Reader Self-Audit: Blind-Bias Calibration + Bias-Over-Time
**Goal.** Two Ground-News-/AllSides-class features that turn passive readers into calibrated ones.

**Blind-bias calibration micro-survey:**
- Strip brand and URL from a recent headline; show reader a random 3–5 headlines/week; ask them to rate L/C/R.
- Compare their rating to the source's actual rating; compute drift: "you rate center-right headlines as 'left' 60% of the time."
- Surface on dashboard: "Your calibration profile."

**Schema:**
```
blind_bias_responses (
  id uuid PK, user_id uuid FK, article_id uuid FK,
  rater_bias TEXT, actual_bias TEXT, responded_at timestamptz
)
```

**Bias-over-time:**
- Aggregate query: `SELECT date_bucket, bias_bucket, count(*) FROM articles JOIN sources ... GROUP BY source, week`.
- Per-source: `BiasTrendChart.tsx` on source detail page.
- Per-story: "This story started 70/20/10 L/C/R six hours ago, now 40/30/30." Uses `story_articles` timestamped join.
- Both use existing data — no new signal gathering.

**Files to touch:**
- `supabase/migrations/0XX_blind_bias.sql` — new
- `app/api/blind-bias/next/route.ts`, `app/api/blind-bias/respond/route.ts` — new
- `components/organisms/BlindBiasSurvey.tsx`, `BiasTrendChart.tsx` — new
- `lib/api/calibration.ts` — new: compute drift stats
- `app/dashboard/page.tsx` — add calibration card
- `lib/api/bias-history.ts` — new aggregate query
- Story detail: add bias-drift tick to `StoryTimeline`

**Verify.** E2E: complete a survey, see profile update. Query performance: bias-over-time rollup under 200ms on 30-day window (add materialized view if not).

---

### Phase 6 — Advanced UX (Roundups, Leaderboards, Burst, Claim Timeline)
**Goal.** Polish differentiators that depend on prior phases being live.

**Headline Roundups (AllSides-style):**
- Story detail: three-column layout — left-most headline, center headline, right-most headline from the story's cluster, picked by edit-distance from the cluster centroid headline.
- `components/organisms/HeadlineRoundup.tsx` — new.

**Author/reporter leaderboard (Techmeme-style):**
- `articles.byline TEXT`, extracted via readability + HTML meta.
- Aggregate per-author: first-to-publish rate in a topic, citation count (who else quotes/links within N hours).
- `/authors/[slug]` page + topic-filtered leaderboards.

**Burst detection (Kleinberg 2-state):**
- Per-entity time-series from `entities` table; Viterbi pass hourly via Supabase cron.
- Emit `entity_bursts (entity_id, started_at, ended_at, intensity)`.
- Surface as "Rising entities" strip above feed.

**Claim timeline with first-reported-by:**
- Extend `key_claims` with `first_reported_by_article_id` and `contradicted_by_article_ids[]`.
- `StoryTimeline.tsx`: add claim chronology lane — "First reported: Outlet X, 14:22. Contradicted: Outlet Y, 16:05."
- Requires Phase 4's tighter claim extraction.

**Files to touch:**
- `lib/ai/summary-generator.ts` — extend claim extraction schema
- `components/organisms/HeadlineRoundup.tsx`, `AuthorLeaderboard.tsx`, `RisingEntitiesStrip.tsx` — new
- `lib/api/authority-ranking.ts`, `lib/api/burst-detection.ts` — new
- `app/authors/[slug]/page.tsx` — new
- `components/organisms/StoryTimeline.tsx` — claim-chronology lane

**Verify.** For each sub-feature, a gold-standard manual pick vs. algorithm output. E2E: story detail renders three canonical headlines; author page loads; rising-entities strip populates.

---

## Critical files reference

| Path | Role in plan |
|---|---|
| `lib/api/query-helpers.ts` | Feed sort logic — Phase 1 entry point |
| `lib/api/for-you-scoring.ts` | Personalization weights — Phases 3, 4 |
| `lib/ai/story-metrics.ts` | Existing velocity/impact/diversity — reused in Phase 1 |
| `lib/ai/summary-generator.ts` | Extend for Phases 4, 6 |
| `lib/supabase/types.ts` | Regenerate after each migration |
| `components/organisms/NexusCard.tsx` | Card-level surfacing — Phase 1 |
| `components/molecules/MonochromeSpectrumBar.tsx` | Pattern to clone for EstablishmentBar (Phase 4) |
| `components/organisms/StoryTimeline.tsx` | Extend for claim chronology (Phase 6) |
| `app/api/stories/route.ts`, `.../for-you/route.ts` | Consume new sorts and scores |
| `apps/mobile/components/NexusCard.tsx`, `apps/mobile/app/(tabs)/index.tsx` | Mobile parity each phase |
| `docs/types.md`, `docs/pipeline.md`, `docs/components.md`, `docs/architecture.md`, `docs/operations.md` | Updated per phase |

## Reusable utilities to build on (don't reinvent)

- `lib/ai/story-metrics.ts` — velocity + impact already computed, Phase 1 just consumes.
- `lib/ai/blindspot-detector.ts` — pattern for signal-based boolean flags.
- `lib/api/bias-calculator.ts` — aggregation patterns reusable for Phase 5 bias-over-time.
- `lib/api/for-you-scoring.ts` — scoring composition pattern reusable for trending.
- `lib/hooks/use-infinite-scroll.ts` — scroll telemetry integration point for Phase 3.
- `lib/api/auth-helpers.ts` — session_id derivation for Phase 3 anonymous tracking.

---

## Phase sequencing rationale

| Phase | Depends on | New data? | User-visible? | Ship order notes |
|---|---|---|---|---|
| 1 Trending + surfacing | — | No | ✅ cards + sort | ✅ **Shipped** — commit on `feat/trending-score` |
| 2 Ownership | — | Backfill only | ✅ source list + detail | Independent of Phase 1; can run in parallel |
| 3 Engagement capture | 1 | New table | ✅ hot-now card | Unblocks better Trending and better For-You |
| 4 New axes | — | 3 new columns | ✅ filters + slider | Parallel with 3, but costly AI — budget first |
| 5 Self-audit | 4 (for calibration depth) | Survey + aggregates | ✅ dashboard + source page | Ship after 4 so calibration can include establishment |
| 6 Advanced UX | 1, 3, 4 | Enrichments to existing | ✅ roundups, leaderboards | Final polish; depends on all signals |

Milestones: Phase 1 in week 1–2; Phase 2 parallel; Phase 3 in week 3–5; Phase 4 in week 4–7; Phase 5 in week 7–9; Phase 6 open-ended polish.

---

## Verification

End-to-end smoke per phase (runs `npm test`, `npm run test:e2e`, `npm run build`):

- **Phase 1** ✅ — `GET /api/stories?sort=trending` returns stories ordered by the new score, with a known-input unit test matrix. 1992/1992 tests pass; build clean.
- **Phase 2** — Story with 10 sources across 3 owners renders `OwnershipSummary` with correct distribution. `npm run build` zero errors. Supabase query for owner aggregation under 50ms.
- **Phase 3** — Privacy audit: no IP stored, DNT respected. Load test: 100 rps on `/api/events/story`. E2E: open story, scroll, close — exactly one view + one dwell event persisted with correct bucket.
- **Phase 4** — Gold-set ≥75% agreement per axis. Pipeline cost measurement report attached to PR. E2E: filter "empirical only" hides flagged sensational article.
- **Phase 5** — E2E: answer 5 blind-bias headlines, dashboard card updates with drift stats. Bias-over-time chart loads under 200ms on 30-day window.
- **Phase 6** — HeadlineRoundup renders three headlines from cluster; AuthorLeaderboard shows top bylines for a topic; RisingEntitiesStrip populates; story detail shows claim chronology.

Cross-cutting:
- Coverage ≥80% per phase (`npm run test:coverage`).
- Codex `/codex:adversarial-review` run after each phase (per project workflow).
- Docs updated per phase (`docs/types.md`, `docs/components.md`, `docs/pipeline.md`, `docs/architecture.md`, `docs/operations.md`, `TRACKER.md`).
