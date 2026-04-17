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
- `DbPipelineMaintenanceAudit` (Phase 12 maintenance tool, migration 047):
  - `action: DbMaintenanceAction` — one of `purge_unembedded_articles`, `purge_orphan_stories`, `purge_expired_articles`.
  - `dry_run: boolean` — true when the row was written by a dry-run call. Real runs always have `dry_run = false`.
  - `options: Record<string, unknown>` — snapshot of the input options, e.g., `{ olderThanDays: 7 }`.
  - `deleted_count: number | null` — number of rows the purge would remove (dry-run) or did remove (real). Null until finalized.
  - `sample_ids: string[] | null` — up to 20 of the affected ids for operator review.
  - `error: string | null` — populated when the purge threw mid-flight; `completed_at` is still written.
  - `triggered_by: string | null` — FK to `auth.users.id`; null when the audit row was backfilled.
  - `triggered_at: string`, `completed_at: string | null` — row lifecycle timestamps.
  Input type: `DbPipelineMaintenanceAuditInsert`. TS purge helpers: `PurgeOptions`, `PurgeResult` from `@/lib/admin/pipeline-maintenance`.
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

## Ownership Types (`@/lib/types`, `@/lib/api/ownership-aggregator`)

- `OwnerType`: `'public_company' | 'private_company' | 'cooperative' | 'public_broadcaster' | 'trust' | 'individual' | 'state_adjacent' | 'nonprofit'`
- `MediaOwner`: `{ id, name, slug, ownerType, isIndividual, country, wikidataQid, ownerSource, ownerVerifiedAt, sourceCount? }`
- `OwnershipGroup`: `{ ownerId, ownerName, ownerSlug, ownerType, isIndividual, country, sourceCount, percentage }` (percentage is share of total sources, including unknowns)
- `OwnershipDistribution`: `{ groups: OwnershipGroup[], unknownCount, concentrationIndex (0..1, HHI over exact fractional shares), dominantOwner: OwnershipGroup | null }` — `dominantOwner` is count-based (`sourceCount * 2 >= total`), not percentage-based, so 99/200 is not dominant
- `NewsArticle.ownershipUnavailable?: boolean` — set when media_owners enrichment lookup failed for the request; story + sources still valid, owner field simply absent. UI can render a distinct "ownership data temporarily unavailable" hint instead of "no known owners".

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

## Pipeline Claim Types

### Claim ownership (`@/lib/pipeline/claim-utils`)

- `ClaimOwner`: UUID string alias. One owner UUID is minted per pipeline
  run by `generateClaimOwner()` (wraps `crypto.randomUUID`). Threaded
  from the route handler → stage functions → the `p_owner` parameter on
  every claim/release RPC defined in `supabase/migrations/037_atomic_claim_leases.sql`,
  and also used as the `claim_owner` on every stage event emitted by
  that run.
- TTL constants (same file):
  - `ARTICLE_STAGE_CLAIM_TTL_MS` — 30 minutes. Applies to embed
    (`embedding_claimed_at`) and cluster (`clustering_claimed_at`).
  - `ASSEMBLY_CLAIM_TTL_MS` — 60 minutes. Applies to assemble
    (`assembly_claimed_at`).
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

### Retry policy (`@/lib/pipeline/retry-policy`)

- `StageKind`: `'embed' | 'cluster' | 'assemble'` — the three stages
  with per-item retry budgets (note: distinct from the wider
  `StageKind` in `@/lib/pipeline/stage-events` which also includes
  `'ingest'` and `'recluster'`).
- `RETRY_BUDGET: Record<StageKind, number>` — `{ embed: 5, cluster: 5,
  assemble: 3 }`. A retry that would push `retry_count` above the
  stage's budget is treated as exhausted and routed to the DLQ.
- `RetryOutcome`: `{ exhausted: boolean, nextRetryCount: number,
  nextAttemptAt: Date }`. Returned by `computeRetryOutcome(stage,
  previousRetryCount, now?, rand?)`. `exhausted` tells callers
  whether to schedule a retry or push to `pipeline_dead_letter`.
- `nextAttemptAfter(retryCount, now?, rand?)`: pure helper behind
  `computeRetryOutcome`. Backoff = base 60s × 2^retryCount, ±25%
  jitter, capped at 60 minutes. The claim RPCs (migration 041) skip
  rows whose `*_next_attempt_at > now()` so retries naturally defer.

> **Note.** There is no `RetryMetadata` TS type. Per-item retry state
> lives in DB columns (`embedding_retry_count`, `clustering_retry_count`,
> `assembly_retry_count`, and the matching `*_next_attempt_at` /
> `*_last_error` columns) added by
> `supabase/migrations/041_retry_metadata_and_dlq.sql`.

### Dead letter queue (`@/lib/pipeline/dead-letter`)

- `DlqItemKind`: `'article_embed' | 'article_cluster' | 'story_assemble'`.
- `DlqEntry`: `{ id, itemKind, itemId, retryCount, lastError, failedAt,
  replayedAt }` — the shape returned by `listUnreplayed()` and consumed
  by the `/admin/pipeline` DLQ panel.
- `DlqInsert`: `{ itemKind, itemId, retryCount, lastError }` — the
  payload `pushToDeadLetter()` writes when a stage exhausts an item's
  retry budget. `pushToDeadLetter` is best-effort: it logs a warning on
  write failure and never fails the stage.
- `replayDeadLetterEntry(client, dlqId)` resets the underlying row and
  stamps `replayed_at`. For `'story_assemble'` it routes through
  `requeueStoryForReassembly` so the assembly_version CAS guards against
  replaying into an in-flight assembler — failure throws a distinctive
  error string that `app/api/admin/dlq/route.ts` maps to HTTP 409.
- `dismissDeadLetterEntry(client, dlqId)` stamps `replayed_at` without
  touching the underlying row.

### Adaptive batch sizing (`@/lib/pipeline/batch-tuner`)

- `StageKind` (local to this module): `'embed' | 'cluster' | 'assemble'`.
- `StageBudget`: `{ min: number, ceiling: number, targetMs: number,
  stepPrefix: string }` — `min` = absolute floor, `ceiling` = env-var
  default (never recommend larger), `targetMs` = target wall-time per
  pass (shrink when breached), `stepPrefix` = key used to fish this
  stage's entries out of `pipeline_runs.steps`.
- `StageRecommendation`: `{ stage, recommendedBatch, reason, emaMs }`
  where `reason` is `'no_history' | 'under_budget' | 'over_budget' |
  'at_ceiling'`. Returned by `recommendBatchSize(stage, durations,
  previousBatch, budget)`.
- `STAGE_BUDGETS: Record<StageKind, StageBudget>` — canonical per-stage
  config, the source of truth referenced by `docs/pipeline.md`:
  - `embed` → `{ min: 25, ceiling: 200, targetMs: 15000, stepPrefix:
    'embed_pass_' }`
  - `cluster` → `{ min: 50, ceiling: 300, targetMs: 20000, stepPrefix:
    'cluster_pass_' }`
  - `assemble` → `{ min: 10, ceiling: 50, targetMs: 25000, stepPrefix:
    'assemble_pass_' }`
- `fetchRecentStageDurations(client, stepPrefix, limit?)` reads the
  last N completed runs from `pipeline_runs` and extracts every step
  whose name starts with `stepPrefix`. Used once per process run at
  the start of the loop; a `batch_tuner_recommendation` info stage
  event is emitted per stage before its first pass so operators can
  see the tuner's decision in the `/admin/pipeline` Events panel.

### Extraction failures (`@/lib/ingestion/types`)

- `ExtractionFailureKind`: `'fetch_error' | 'extraction_failed' |
  'robots_blocked' | 'parse_error' | 'ssrf_blocked'`.
- `ExtractionFailure`: `{ url: string, kind: ExtractionFailureKind,
  message: string }` — carried on `FetchResult.failedUrls` so the
  orchestrator can persist per-item ingest failures to the
  `pipeline_extraction_failures` table instead of silently dropping
  them.

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
