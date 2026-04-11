# Data Types (Quick Reference)

All types live in `@/lib/types`:

- `BiasCategory`: `'far-left' | 'left' | 'lean-left' | 'center' | 'lean-right' | 'right' | 'far-right'`
- `FactualityLevel`: `'very-high' | 'high' | 'mixed' | 'low' | 'very-low'`
- `OwnershipType`: `'independent' | 'corporate' | 'private-equity' | 'state-funded' | 'telecom' | 'government' | 'non-profit' | 'other'`
- `Topic`: 9 values (`'politics' | 'world' | 'technology' | ...`)
- `Region`: `'us' | 'international' | 'uk' | 'canada' | 'europe'` (used by DB types and UI region filter in SearchFilters)
- `FeedTab`: `'for-you' | 'trending' | 'latest' | 'blindspot' | 'saved'`
- `PerspectiveFilter`: `'all' | 'left' | 'center' | 'right'` (UI-only — drives `biasRange` param, not sent to API directly)
- `DatePreset`: `'24h' | '7d' | '30d' | 'all'`
- `ReviewStatus`: `'pending' | 'approved' | 'rejected'`
- `DbAssemblyStatus`: `'pending' | 'processing' | 'completed' | 'failed'`
- `DbPublicationStatus`: `'draft' | 'needs_review' | 'published' | 'rejected'`
- `StoryKind`: `'standard'`

Label/class maps: `BIAS_LABELS`, `BIAS_CSS_CLASS`, `FACTUALITY_LABELS`, `OWNERSHIP_LABELS`, `TOPIC_LABELS`, `DATE_PRESET_LABELS`

Constants: `FACTUALITY_RANK` — factuality level ordering for min threshold filtering; `PERSPECTIVE_BIASES` — maps PerspectiveFilter values to BiasCategory arrays for client-side bias range conversion; `REVIEW_STATUS_LABELS` — maps ReviewStatus to display labels (e.g., `'pending'` → `'Pending Review'`); `REGION_LABELS` — maps Region to display labels (e.g., `'us'` → `'United States'`); `ALL_REGIONS` — all Region values as array

Sample data: `sampleArticles` (6 items), `sampleSources` (15 items) in `@/lib/sample-data`

## Source Profile Types

- `NewsSource`: source card/list model; now includes optional `slug` for linking directory cards to source detail pages
- `SourceProfileSource`: `NewsSource` plus `isActive` and optional `rssUrl`
- `SourceProfileStory`: recent clustered story summary for a source profile (`id`, `headline`, `topic`, `region`, `timestamp`, `isBlindspot`, optional `articleUrl`)
- `SourceTopicBreakdownItem`: `{ topic, count }`
- `SourceProfile`: `{ source, recentStories, topicBreakdown, blindspotCount }`

## Source Comparison Types

- `SourceComparisonTopicCount`: `{ topic, leftCount, rightCount }`
- `SourceComparisonStats`: `{ sharedStoryCount, leftExclusiveCount, rightExclusiveCount, leftBlindspotCount, rightBlindspotCount, overlappingTopics, topicImbalances }`
- `SourceComparison`: `{ leftSource, rightSource, sharedStories, leftExclusiveStories, rightExclusiveStories, stats }`

DB schema types (`DbSource`, `DbStory`, `DbArticle`, and their `Insert` variants) live in
`@/lib/supabase/types` and are re-exported from `@/lib/types` for convenience.

Pipeline-specific DB fields:
- `DbStory`: `assembly_status`, `publication_status`, `review_reasons`, `confidence_score`, `processing_error`, `assembled_at`, `published_at`, `assembly_claimed_at`
- `DbArticle`: `canonical_url`, `title_fingerprint`, `embedding_claimed_at`, `clustering_claimed_at`
- `DbSource` (Phase 11 source-health control plane, migration 046):
  - `cooldown_until: string | null` — ISO timestamp; while `> now()` the source is skipped by `isSourceEligible`. Advanced by `increment_source_failure` on an exponential ramp (2^min(consecutive,8) minutes, capped at 240).
  - `auto_disabled_at: string | null` — ISO timestamp set when `consecutive_failures >= 10 AND total_articles_ingested < 20`. While non-null the source is skipped entirely by the eligibility filter.
  - `auto_disabled_reason: string | null` — human-readable explanation stored alongside `auto_disabled_at` (e.g., `"Auto-disabled: 12 consecutive failures"`).
  - All three clear together when an admin hits `POST /api/admin/sources/:id/reactivate`. The TS source of truth for the ramp + predicate is `lib/ingestion/source-policy.ts`.

Story-kind semantics:
- `standard` — clustered story with multi-source comparative treatment (only kind; unclustered singletons expire after 7 days)

Claim timestamp semantics:
- `assembly_claimed_at`, `embedding_claimed_at`, and `clustering_claimed_at` are in-flight lease markers, not readiness flags
- `null` means "currently unclaimed"
- eligibility still comes from `assembly_status`, `is_embedded`, and `story_id`

## Timeline Types

- `TimelineEventKind`: `'source-added' | 'spectrum-shift' | 'milestone'`
- `TimelineEvent`: id, timestamp, kind, sourceName, sourceBias, description,
                   cumulativeSourceCount, cumulativeSpectrum
- `StoryTimeline`: storyId, events (TimelineEvent[]), totalArticles, timeSpanHours

## Bias Calculator Types (`@/lib/api/bias-calculator`)

- `BiasDistribution`: `{ bias: BiasCategory, percentage: number }`
- `BiasProfile`: `{ userDistribution, overallDistribution, blindspots, totalStoriesRead, dominantBias }`
- `StoryWithSpectrum`: `{ spectrum_segments: { bias: string, percentage: number }[] | null }`

## For You Types (`@/lib/api/for-you-scoring`, `@/lib/api/validation`)

- `ForYouSignals`: `{ followedTopics, blindspotCategories, readStoryIds, now }`
- `ScoredStory`: `{ id, headline, topic, timestamp, spectrumSegments, score, [key: string]: unknown }`
- `ForYouQuery`: `{ page, limit }` (from `forYouQuerySchema`)

## Phase 5 DB Types (`@/lib/supabase/types`)

- `DbBookmark` / `DbBookmarkInsert`: user_id, story_id, created_at
- `DbReadingHistory` / `DbReadingHistoryInsert`: user_id, story_id, read_at, is_read
- `DbUserPreferences` / `DbUserPreferencesInsert`: user_id, followed_topics, default_region, default_perspective, factuality_minimum, blindspot_digest_enabled
- `DbAdminUser`: user_id, role, created_at

## Review Types (`@/lib/api/review-validation`, `@/lib/api/review-queries`)

- `ReviewStatus`: `'pending' | 'approved' | 'rejected'`
- `ReviewAction`: `{ status: ReviewStatus, reason?: string }` (from `reviewActionSchema`)
- `ReviewStats`: `{ pending: number, approved: number, rejected: number, total: number }`

## Pipeline Decision Types

- `PublicationDecision`: `{ reviewStatus, publicationStatus, confidenceScore, reviewReasons }`
- `LegacyStoryState`: backfill result mapping legacy review rows into explicit assembly/publication states

## Claim Utility Types (`@/lib/pipeline/claim-utils`)

- `OwnershipMoveOutcome` (Phase 10): discriminated union returned by
  `runOwnerScopedUpdate`. Variants: `'applied'` (write landed),
  `'ownership_moved'` (row exists but claim belongs to another owner —
  benign), `'row_missing'` (row deleted — benign), `'policy_drift'`
  (claim still ours but write matched zero rows — LOUD), `'error'`
  (the update itself failed). Callers branch on `outcome.kind` and
  emit `ownership_moved` info events on benign cases / throw on drift.
- `runOwnerScopedUpdate(client, args)` (Phase 10): helper that wraps
  the count+verify pattern from the Phase 7b cleanup fallback.
  Arguments: `{ table: 'articles' | 'stories', id, owner, ownerColumn,
  payload }`. Returns `Promise<OwnershipMoveOutcome>`. NEVER throws.
  Used by every Phase 10 stage write site in `lib/ai/embeddings.ts`,
  `lib/ai/clustering.ts`, and `lib/ai/story-assembler.ts`.

## Cluster Write Types (`@/lib/pipeline/cluster-writes`)

- `CreateStoryOutcome` (Phase 10): discriminated union returned by
  `createStoryWithArticles`. Variants: `'created'` (story row + article
  assignments persisted; carries `storyId`), `'ownership_moved'`
  (RPC raised SQLSTATE P0010 because ownership moved on one or more
  articles — benign skip with `detail` string), `'error'` (any other
  RPC failure with `message` string, including SQLSTATE P0001 from
  the migration's null-validation guards). Callers handle
  `'ownership_moved'` identically to `runOwnerScopedUpdate`'s
  `'ownership_moved'` outcome.

## Pipeline Stage Event Types (`@/lib/pipeline/stage-events`)

- `StageKind`: `'ingest' | 'embed' | 'cluster' | 'assemble' | 'recluster'`
- `StageLevel`: `'debug' | 'info' | 'warn' | 'error'`
- `StageEventInput`: `{ stage, level, eventType, sourceId?, provider?, itemId?, durationMs?, payload? }` — shape passed to the emitter
- `StageEventEmitter`: `(event: StageEventInput) => Promise<void>` — pre-bound to a `(runId, claimOwner)` pair by `logger.makeStageEmitter()`. `claimOwner` accepts `null` for maintenance jobs (e.g. `/api/cron/recluster`) that use a `randomUUID()` correlation id and do not hold a pipeline claim lease.
- `noopStageEmitter`: default used when stages run outside a pipeline (tests, scripts)
- `safeEmit(emitter, input)`: wraps an emitter call in try/catch so a rejecting/throwing emitter never stalls the pipeline. Every stage call site uses this instead of calling the emitter directly.

## Pipeline Stage Event DB Types (`@/lib/supabase/types`)

- `DbStageKind` / `DbStageLevel`: DB-side enum literals mirroring the contract above
- `DbPipelineStageEvent`: row shape for `pipeline_stage_events` — `{ id, run_id, claim_owner, stage, source_id, provider, level, event_type, item_id, duration_ms, payload, created_at }`
- `DbPipelineStageEventInsert`: insert shape used by `PipelineLogger.stageEvent`
