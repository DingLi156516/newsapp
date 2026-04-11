# Pipeline Architecture

Deep-dive into the news processing pipeline internals. For operational commands and API reference, see `docs/operations.md`.

## Overview

```
Sources (RSS + Crawlers + APIs) ──► Ingest ──► Embed ──► Cluster ──► Assemble ──► Publish / Review
                                      ↑                                              ↑
                                 every 15min                                    every 15min
                                 (cron)                                         (cron, 5min offset)
```

The pipeline transforms raw articles from multiple source types into published stories through four stages. Each stage is idempotent and uses per-row claim locks rather than global mutexes, allowing concurrent runs without data corruption.

## Entry Points

| Trigger | Route | Schedule | Auth |
|---------|-------|----------|------|
| Cron ingest | `GET /api/cron/ingest` | Every 15 min | `Bearer CRON_SECRET` |
| Cron process | `GET /api/cron/process` | Every 15 min (5 min offset) | `Bearer CRON_SECRET` |
| Cron recluster | `GET /api/cron/recluster` | Hourly | `Bearer CRON_SECRET` |
| Admin trigger | `POST /api/admin/pipeline/trigger` | Manual | Supabase auth + admin |

The admin trigger accepts a JSON body with `type: 'ingest' | 'process' | 'full'`. There is no distributed lock between triggers -- cron and admin can overlap freely.

## Stage 1: Ingest

**File:** `lib/ingestion/ingest.ts` (unified orchestrator)  
**Route:** `app/api/cron/ingest/route.ts` (60s runtime limit)

Sources have a `source_type` column: `'rss'`, `'crawler'`, or `'news_api'`. Each type has its own fetcher module:

| Type | Fetcher | Concurrency | Module |
|------|---------|-------------|--------|
| RSS | `lib/ingestion/rss-fetcher.ts` → `lib/rss/parser.ts` | 5 | `lib/rss/` |
| Crawler | `lib/crawler/fetcher.ts` | 2 | `lib/crawler/` |
| News API | `lib/news-api/fetcher.ts` | 1 | `lib/news-api/` |

All fetchers produce the same `ParsedFeedItem[]` format, so the downstream pipeline is unchanged.

1. Fetch all active sources from `sources` table, grouped by `source_type` (`lib/ingestion/source-registry.ts`)
2. For each type: fetch concurrently via registered `SourceFetcher` (`lib/ingestion/fetcher-registry.ts`)
3. RSS: parse feeds via `rss-parser`; Crawler: discover URLs via cheerio + extract via Readability; News API: query provider with rate limiting
4. Normalize URLs to canonical form (`lib/rss/normalization.ts`)
5. Deduplicate against DB by canonical URL + title fingerprint (`lib/rss/dedup.ts`)
6. Per-source cap, then upsert articles in batches of 50 (`lib/ingestion/pipeline-helpers.ts`)
7. Update source health per source (`lib/ingestion/pipeline-helpers.ts`)

New articles are created with:
```
is_embedded = false
clustering_status = 'pending'
clustering_attempts = 0
story_id = null
```

## Stage 2: Embed

**File:** `lib/ai/embeddings.ts`

1. Fetch articles where `is_embedded = false`, scanning 3x the batch size
2. Filter to rows with available claims (claim TTL = 30 min)
3. Claim selected articles (`embedding_claimed_at = now`)
4. Look up cached embeddings by `title_fingerprint` — syndicated wire stories (AP/Reuters) that share titles across sources reuse existing embeddings instead of calling Gemini
5. Generate embeddings via Gemini `gemini-embedding-001` in batches of 100 (env: `EMBED_BATCH_SIZE`) for cache-miss articles only
   - Input: `title + description`
   - Output: 768-dimensional vector
6. Update each article: store `embedding`, set `is_embedded = true`
7. Clear claim on success; clear on error for retry

Result includes `cacheHits` count for observability.

**Batch size:** 200 articles per pass (env: `PIPELINE_PROCESS_EMBED_BATCH_SIZE`)

## Stage 3: Cluster

**File:** `lib/ai/clustering.ts`

The most complex stage. Groups articles by cosine similarity into story clusters.

### Constants

| Name | Value | Purpose |
|------|-------|---------|
| `SIMILARITY_THRESHOLD` | 0.70 | Minimum cosine similarity to join a cluster |
| `STANDARD_MATCH_WINDOW_HOURS` | 168 (7 days) | Only match against stories updated within this window |
| `ARTICLE_EXPIRY_DAYS` | 7 | Articles older than this are swept to `expired` |
| `MAX_CLUSTERING_ATTEMPTS` | 3 | Singletons promoted to stories after this many passes |
| `CLAIM_SCAN_MULTIPLIER` | 3 | Fetch 3x batch size to find unclaimed rows |

### Constants

| Name | Value | Env Override | Purpose |
|------|-------|-------------|---------|
| `SIMILARITY_THRESHOLD` | 0.70 | `CLUSTERING_SIMILARITY_THRESHOLD` | Minimum cosine similarity to join a cluster |
| `SPLIT_THRESHOLD` | 0.60 | `CLUSTERING_SPLIT_THRESHOLD` | Minimum similarity for recluster split detection |
| `PGVECTOR_CANDIDATE_COUNT` | 15 | `CLUSTERING_CANDIDATE_COUNT` | pgvector RPC top-K candidates |
| `PGVECTOR_BATCH_SIZE` | 25 | `CLUSTERING_PGVECTOR_BATCH_SIZE` | Articles per RPC batch in Pass 1 |

### Algorithm (6 composable stages)

1. **fetchUnassignedArticles:** embedded articles with `story_id IS NULL`, `clustering_status = 'pending'`. Scan 3x batch, filter to unclaimed, take up to batch size.

2. **claimArticleBatch:** bulk-claim selected articles (`clustering_claimed_at = now`).

3. **matchAgainstExistingStories (Pass 1 — Hybrid pgvector + JS):** For each article, query the `match_story_centroid` RPC for HNSW-accelerated centroid search (`hnsw.ef_search = 80` for improved recall). Falls back to JS brute-force cosine similarity if RPC is unavailable. If best match >= 0.70, assign article to that story. After assigning articles, the story's centroid is recomputed from all its article embeddings to prevent centroid drift.

4. **clusterUnmatchedArticles (Pass 2 — Union-find):** Remaining articles are compared pairwise. All pairs above threshold are ranked by similarity descending, then merged via union-find with path compression and union-by-rank. Centroid validation ejects outliers connected only via transitive chaining.

6. **Handle new clusters:**
   - **Multi-article clusters (>= 2):** Check if centroid matches an existing story (duplicate detection). If so, merge articles into that story. Otherwise, create a new story.
   - **Singletons (1 article):**
     - `clustering_attempts < 3` -- increment counter, clear claim, release back to `pending` for the next pipeline run
     - `clustering_attempts >= 3` -- **promote**: create a single-article story

7. **Queue reassembly:** All stories that received new articles get `assembly_status = 'pending'` so the assembler regenerates their headline/summary.

8. **Expiry:** Articles older than 7 days are excluded from candidate selection (step 1) by the `ARTICLE_EXPIRY_DAYS` filter. No explicit sweep updates their status — they age out naturally by never being fetched again. `expiredArticles` is reported as `0` in clustering metrics (reserved for a future explicit sweep if needed).

### Singleton Lifecycle

Singletons accumulate attempts across separate pipeline invocations (cron runs ~15 min apart), giving time for matching articles to arrive from later ingestion batches:

```
Run 1: attempts 0→1, released to pending, pipeline stops (no cluster progress)
Run 2: attempts 1→2, released to pending, pipeline stops
Run 3: attempts 2→3, promoted to single-article story
```

The process runner's `clusterMadeProgress` function intentionally does **not** count singletons as progress. This prevents the loop from re-running clustering on the same articles within a single invocation, which would burn all 3 attempts immediately.

**Batch size:** 300 articles per pass (env: `PIPELINE_PROCESS_CLUSTER_BATCH_SIZE`)

## Re-clustering Maintenance

**File:** `lib/ai/recluster.ts`  
**Route:** `app/api/cron/recluster/route.ts` (60s runtime limit)

Runs hourly to correct accumulated clustering drift:

1. **Merge detection:** Finds story pairs with centroid similarity above threshold. Queries article counts for each pair and merges the smaller story into the larger one — recomputes the target's centroid and deletes the source story.
2. **Split detection:** For each story, checks every article's similarity to its story centroid. Articles below the `SPLIT_THRESHOLD` (0.60) are detached and reset to `clustering_status = 'pending'` for re-clustering.

Both phases respect `assembly_claimed_at` TTLs to avoid interfering with concurrent pipeline processing. Uses `match_story_centroid` RPC for merge candidate discovery with JS fallback.

## Stage 4: Assemble

**File:** `lib/ai/story-assembler.ts`

1. Fetch stories where `assembly_status = 'pending'`, scanning 3x batch, filtering to unclaimed (claim TTL = 60 min)
2. Claim stories (`assembly_status = 'processing'`, `assembly_claimed_at = now`)
3. For each story, fetch all articles and source metadata
4. Run model calls with `Promise.all(...)`:
   - **Multi-source path** (≥2 sources): 2 calls — `classifyStory` (generates headline, topic, region), `generateAISummary` (spectrum-aware with `leftFraming`, `rightFraming`, `commonGround`)
   - **Single-source path** (1 source): 2 calls — `classifyStory` (generates topic, region), `generateSingleSourceSummary` (flash-lite). Headline = original article title (no generation). Sets `is_blindspot = false`, `controversy_score = 0`, `sentiment = null`
5. Compute deterministic metadata: spectrum distribution, blindspot flag, factuality, ownership
6. Update story publication status and start background entity tag extraction. Tag extraction promises are collected and awaited at the end of the batch to ensure completion before the function exits. Tagging failures are logged but do not fail the story.
7. **Publication decision:**
   - **Auto-publish** if: >= 2 articles, >= 2 sources, good AI summary, confidence >= 0.25
   - **Needs review** if any condition fails. Review reasons:
     - `sparse_coverage` -- fewer than 2 articles or 2 sources (-0.35 confidence)
     - `ai_fallback` -- AI summary generation failed (-0.25)
     - `processing_anomaly` -- errors during assembly (-0.25)
8. Update story with all generated fields, set final `publication_status`
9. On error: set `assembly_status = 'failed'`, `publication_status = 'needs_review'`

Claiming is batched. Story assembly runs with bounded concurrency (default 12, env: PIPELINE_ASSEMBLY_CONCURRENCY).

**Batch size:** 50 stories per pass (env: `PIPELINE_PROCESS_ASSEMBLE_BATCH_SIZE`)

## Process Runner

**File:** `lib/pipeline/process-runner.ts`  
**Route:** `app/api/cron/process/route.ts` (120s runtime limit)

The process runner orchestrates embed, cluster, and assemble in a budget-constrained loop.

### Loop Structure

```
while (time budget remaining) {
  roundProgress = false

  1. Embedding  -- highest priority (freshness)
  2. Clustering -- medium priority
  3. Assembly   -- lowest priority (deferred when budget is tight and freshness backlog exists)

  if (!roundProgress) break
  refresh backlog counts
}
```

Each iteration attempts all three stages in order. The loop continues as long as at least one stage made progress. Stages are skipped when their backlog is empty or time budget is insufficient.

### Concurrent Mode

When `PIPELINE_CONCURRENT_STAGES=true` (default: `false`), embed and cluster run in `Promise.all` within each round, then assembly runs after both complete. This is safe because they operate on disjoint article sets (`is_embedded=false` vs `is_embedded=true AND story_id IS NULL`). Claims provide row-level isolation. In concurrent mode, embed skips the time-budget reserve check since cluster runs in parallel rather than after.

### Time Budget

| Parameter | Default | Env Override |
|-----------|---------|-------------|
| Total budget | 280s | `PIPELINE_PROCESS_TIME_BUDGET_MS` |
| Cluster reserve | 25s | `PIPELINE_PROCESS_CLUSTER_RESERVE_MS` |
| Assembly reserve | 15s | `PIPELINE_PROCESS_ASSEMBLE_RESERVE_MS` |

Embedding only runs if `remaining_time > cluster_reserve + assembly_reserve`. This ensures downstream stages always get time to complete.

### Targets

| Stage | Default Target | Env Override |
|-------|---------------|-------------|
| Embed | 1500 articles | `PIPELINE_PROCESS_EMBED_TARGET` |
| Cluster | 1500 articles | `PIPELINE_PROCESS_CLUSTER_TARGET` |
| Assemble | 100 stories | `PIPELINE_PROCESS_ASSEMBLE_TARGET` |

### Progress Tracking

Each stage reports whether it made progress:
- **Embedding:** `totalProcessed > 0`
- **Clustering:** `assignedArticles > 0 OR expiredArticles > 0` (singletons intentionally excluded)
- **Assembly:** `storiesProcessed > 0`

If no stage makes progress in a round, the loop exits with skip reason `no_progress`.

### Skip Reasons

| Reason | Meaning |
|--------|---------|
| `no_backlog` | No articles/stories to process in this stage |
| `budget_reserved_for_freshness` | Stage skipped to preserve time budget for freshness stages (embed/cluster) |
| `time_budget_exhausted` | Total time limit reached |
| `no_progress` | No stage made progress; loop exited |

## Backlog System

**File:** `lib/pipeline/backlog.ts`

The `countPipelineBacklog()` function returns 5 metrics checked at the start of each round:

| Metric | DB Query |
|--------|----------|
| `unembeddedArticles` | `is_embedded = false` |
| `unclusteredArticles` | `is_embedded = true AND story_id IS NULL AND clustering_status = 'pending'` |
| `pendingAssemblyStories` | `assembly_status = 'pending'` |
| `reviewQueueStories` | `publication_status = 'needs_review'` |
| `expiredArticles` | `clustering_status = 'expired'` |

Backlog is refreshed after clustering makes progress (so newly created stories can be assembled in the same run) and at the end of every loop iteration.

## Claim Leases

**Files:** `lib/pipeline/claim-utils.ts`, `lib/pipeline/cluster-writes.ts`, `lib/pipeline/reassembly.ts`, `lib/pipeline/retry-policy.ts`, `lib/pipeline/dead-letter.ts`
**Migrations:** `supabase/migrations/037_atomic_claim_leases.sql`, `038_assembly_version_guard.sql`, `041_retry_metadata_and_dlq.sql`, `042_phase_7b_remediation.sql`, `043_atomic_clustering_failure.sql`, `045_claim_safe_cluster_writes.sql`

Instead of a global pipeline lock, each row holds a time-limited lease marked by a `*_claimed_at` timestamp and a `*_claim_owner` UUID. Leases are issued by `SECURITY DEFINER` RPCs so overlapping runners cannot claim the same row and a stale worker cannot release a newer worker's claim.

### ClaimOwner model

- `ClaimOwner` (`lib/pipeline/claim-utils.ts`) is a plain UUID string alias. One owner UUID is minted per pipeline run by `generateClaimOwner()`.
- The route handler mints the owner, then threads it into every stage function and through to the RPC's `p_owner` parameter. Example: `app/api/cron/process/route.ts` — `const claimOwner = generateClaimOwner()` → `embedUnembeddedArticles(client, maxArticles, claimOwner, emitter)` → `claim_articles_for_embedding(p_owner, p_limit, p_ttl_seconds)`.
- The same owner UUID is used as the `claim_owner` on every `pipeline_stage_events` row emitted by that run (`logger.makeStageEmitter(runId, claimOwner)`), so operators can filter the Events panel by ownership when drilling in.

### TTL constants

Named constants live in `lib/pipeline/claim-utils.ts`:

| Constant | Value | Applies to |
|----------|-------|------------|
| `ARTICLE_STAGE_CLAIM_TTL_MS` | 30 min | Embed (`embedding_claimed_at`), Cluster (`clustering_claimed_at`) |
| `ASSEMBLY_CLAIM_TTL_MS` | 60 min | Assemble (`assembly_claimed_at`) |

Each claim RPC takes `p_ttl_seconds` derived from these constants so there is exactly one source of truth for the lease window.

### Atomic claim RPCs (migration 037)

| RPC | Purpose |
|-----|---------|
| `claim_articles_for_embedding` | Atomic batch claim for embed stage |
| `claim_articles_for_clustering` | Atomic batch claim for cluster stage |
| `claim_stories_for_assembly` | Atomic batch claim for assemble stage (also flips `assembly_status` to `'processing'`) |
| `release_embedding_claim` | Owner-scoped release |
| `release_clustering_claim` | Owner-scoped release |
| `release_assembly_claim` | Owner-scoped release |

Each claim RPC runs an `UPDATE ... WHERE (owner IS NULL OR claim expired) RETURNING id` with `FOR UPDATE SKIP LOCKED`, so two overlapping runners are guaranteed disjoint result sets. Releases match on `(id, owner)` so a stale worker cannot clear a successor's claim. All RPCs are callable by `service_role` only.

Claims are operational markers — readiness is still determined by `is_embedded`, `story_id`, and `assembly_status`.

### Owner-scoped stage writes (Phase 10)

After a claim lands, every stage-state write goes through `runOwnerScopedUpdate` in `lib/pipeline/claim-utils.ts`. The helper issues an `UPDATE ... WHERE id = ? AND <owner column> = ?` with `{ count: 'exact' }`, then performs a verify read when the count is zero, and returns an `OwnershipMoveOutcome` discriminated union:

| Variant | Meaning | Caller action |
|---------|---------|---------------|
| `applied` | Update matched one row — the claim is still ours and the write landed. | Continue. |
| `ownership_moved` | Row exists but its `*_claim_owner` now belongs to a different worker (stale-worker race past TTL). | **Benign.** Emit `ownership_moved` info stage event and skip follow-up writes (no DLQ push, no version bump). |
| `row_missing` | Row was deleted between claim and write. | Benign, skip follow-up. |
| `policy_drift` | Zero-match update **and** the verify read says the claim is still ours. A schema/RLS regression. | **LOUD failure.** Throws `[<stage>/policy_drift]` tagged error. Operators grep cron logs for `\[(embed|assemble|cluster)/policy_drift\]`. |
| `error` | The update itself errored. | Bubble up to normal retry path. |

Callers live in `lib/ai/embeddings.ts`, `lib/ai/clustering.ts`, and `lib/ai/story-assembler.ts`. The `ownership_moved` path NEVER maps to policy drift — silently masking a stale-owner race was the root cause of the Phase 10 audit.

The parallel path for new-cluster writes is `createStoryWithArticles` in `lib/pipeline/cluster-writes.ts`, which wraps the `create_story_with_articles` RPC (migration 045). When the RPC raises `SQLSTATE P0010`, the wrapper returns `{ kind: 'ownership_moved' }`. `P0001` errors remain caller bugs (null article ids, null owner) and surface as `{ kind: 'error' }`.

### assembly_version CAS (migration 038)

Reassembly transitions use a compare-and-set against the story's `assembly_version`:

1. Reader calls `fetchAssemblyVersions(client, storyIds)` (`lib/pipeline/reassembly.ts`) to snapshot the current version per story.
2. Reader calls `requeueStoryForReassembly(client, storyId, expectedVersion)` which invokes the `requeue_story_for_reassembly` RPC. The RPC atomically resets retry/backoff metadata and flips state back to `pending` **only if** `assembly_version = expectedVersion`.
3. When the RPC returns `false` the caller skips: either the story is currently being assembled or a concurrent requeue already bumped the version. Clustering surfaces this to the stage summary as `"Story X requeue guarded: ..."` in `errors[]`; recluster logs a warning; `replayDeadLetterEntry` (see below) surfaces it as a distinctive error string the DLQ route maps to HTTP 409.
4. After a successful assembly write, `bumpAssemblyVersion(client, storyId)` increments the version so any concurrent requeue caller with a stale snapshot will mismatch and skip its now out-of-date reset.

### Retry budget + DLQ (migrations 041, 042)

Per-item failures are routed through `lib/pipeline/retry-policy.ts`:

- `RETRY_BUDGET`: embed `5`, cluster `5`, assemble `3`.
- `computeRetryOutcome(stage, previousRetryCount)` returns a `RetryOutcome`:
  - `exhausted: boolean` — `true` when the next attempt would exceed the stage's budget.
  - `nextRetryCount: number`
  - `nextAttemptAt: Date` — computed by `nextAttemptAfter`: base 60s × 2^retryCount, ±25% jitter, capped at 60 min.
- Migration 041 adds `{embedding,clustering,assembly}_{retry_count,next_attempt_at,last_error}` columns. The claim RPCs were extended (041) to skip rows whose `next_attempt_at > now()` so retries naturally defer.
- When `exhausted === true`, the stage calls `pushToDeadLetter(client, { itemKind, itemId, retryCount, lastError })` (`lib/pipeline/dead-letter.ts`) and emits a `dlq_pushed` stage event. `DlqItemKind` is `'article_embed' | 'article_cluster' | 'story_assemble'`.

DLQ entries are listed unreplayed-first via `listUnreplayed()`. The admin dashboard (`/admin/pipeline` → DLQ panel) calls `POST /api/admin/dlq { action: 'replay'|'dismiss', id }`:
- **Replay** — `replayDeadLetterEntry` resets the underlying row's retry metadata and (for `story_assemble`) goes through `requeueStoryForReassembly` under the assembly_version CAS. A failed CAS throws an error that the route maps to HTTP 409; the DLQ entry stays visible so the operator can retry after the concurrent assembler finishes.
- **Dismiss** — `dismissDeadLetterEntry` marks the entry replayed without touching the underlying row. Used for known-bad items.

See `docs/operations.md` → **Dead Letter Queue Replay Runbook** for the operator workflow.

### Adaptive batch sizing (Phase 13A)

**File:** `lib/pipeline/batch-tuner.ts`

`STAGE_BUDGETS` is the canonical per-stage configuration — the numeric values live in one place so docs and tests can reference them:

| Stage | `min` | `ceiling` | `targetMs` | `stepPrefix` |
|-------|-------|-----------|------------|--------------|
| `embed` | 25 | 200 | 15000 | `embed_pass_` |
| `cluster` | 50 | 300 | 20000 | `cluster_pass_` |
| `assemble` | 10 | 50 | 25000 | `assemble_pass_` |

At the start of each process run the runner reads the last 5 completed runs' step durations (`fetchRecentStageDurations`) and folds them into an EMA (`EMA_ALPHA = 0.4`, oldest-first). `recommendBatchSize(stage, durations, previousBatch, budget)` then emits a `StageRecommendation`:

- `no_history` — fewer than 1 observation, keep `previousBatch`.
- `over_budget` — EMA exceeds `targetMs`; shrink towards `min` using `targetMs / ema` as a linear ratio.
- `under_budget` — EMA ≤ 60% of target; grow towards `ceiling` by `ceil(previousBatch * 1.25)`.
- `at_ceiling` — growth clipped by `budget.ceiling` (or the caller's per-run override, whichever is smaller).

The runner re-clamps the recommendation against the caller-supplied per-run ceiling (env-var defaults) and emits a `batch_tuner_recommendation` info stage event before each stage's first pass. The payload includes `{ stage, ema, reason, recommendedBatch, ceiling, historyCount }` so operators can see the tuner's decision in the `/admin/pipeline` Events panel without polluting `pipeline_runs.steps`. A tuner failure (Supabase outage, bug) is logged once and falls back to the static ceiling — it never fails the run.

## Concurrency

No distributed lock exists. Concurrent runs are safe because:

1. **Atomic per-row claims** — migration 037 RPCs use `FOR UPDATE SKIP LOCKED` so two overlapping runners get disjoint result sets. A stale worker past its TTL cannot clobber a newer worker because every stage-state write goes through `runOwnerScopedUpdate` with an owner-scoped `WHERE` clause (Phase 10).
2. **CAS on reassembly transitions** — `assembly_version` guards requeue paths (Phase 7) so a late reclustering run cannot step on an in-flight assembler.
3. **Idempotent operations** — upserts on `canonical_url` (ingest), updates by ID (embed/cluster/assemble).
4. **WHERE guards on updates** — the expiry sweep re-checks `clustering_status = 'pending'` and `story_id IS NULL` before updating, preventing TOCTOU races.
5. **Retry budget + DLQ** — single-item failures retry with exponential backoff until their budget is exhausted, then land in `pipeline_dead_letter` instead of being silently abandoned or retried forever.

Worst case with concurrent runs: some redundant work (two workers each read stale `pipeline_runs.steps` and recommend slightly different batch sizes), but no data corruption and no stranded claims.

## Article Status Flow

```
[Ingested]                     [Embedded]                      [Clustered]
is_embedded=false  ───embed──► is_embedded=true   ───cluster──► clustering_status='clustered'
                               clustering_status='pending'      story_id=<uuid>
                                      │
                                      ├── singleton (attempts<3) → released to pending, attempts++
                                      ├── singleton (attempts>=3) → promoted to story
                                      └── expired (>7 days old)  → clustering_status='expired'
```

## Story Status Flow

```
[Created by clustering]
assembly_status='pending'  ───assemble──► assembly_status='completed'
publication_status='draft'                publication_status='published' | 'needs_review'
                                          review_status='pending' (if needs_review)
                                                    │
                                                    ├── admin approves → publication_status='published'
                                                    └── admin rejects → publication_status='rejected'
```

## Run Logging

**File:** `lib/pipeline/logger.ts`

Every run creates a record in the `pipeline_runs` table:

| Field | Description |
|-------|-------------|
| `run_type` | `'ingest'`, `'process'`, or `'full'` |
| `triggered_by` | `'cron'` or `'admin:{userId}'` |
| `status` | `'running'`, `'completed'`, or `'failed'` |
| `steps` | Array of step timings/results (e.g., `embed_pass_1`, `cluster_pass_2`) |
| `summary` | Final counts from all stages |
| `duration_ms` | Total run duration |

The admin dashboard at `/admin/pipeline` surfaces these logs via `PipelineRunHistory`.

Today the logger persists step timings and per-run summaries, while `/api/admin/pipeline/stats` still returns coarse live counts only. The approved throughput redesign expands this evidence with backlog-age and rate telemetry before any higher-risk scheduling/state changes roll out.

## Throughput Redesign Roadmap

The approved plan in `.omx/plans/prd-pipeline-throughput-scale-20260402.md` keeps the current publication contract unless telemetry proves a broader lifecycle change is necessary:

1. **Phase 0 — Instrumentation:** add rate, latency, and backlog-age evidence to process runs and admin surfaces.
2. **Phase 1 — Throughput fixes:** keep the current story lifecycle, but remove row-by-row DB hotspots and verify freshness improves enough on its own.
3. **Phase 2 — Conditional lifecycle split:** only if Phase 1 still misses the target, introduce an explicit freshness/enrichment contract across DB types, API transformers, and review flows.
4. **Phase 3 — Cheap-model routing:** downshift low-risk generation tasks only if review-queue and fallback rates stay within the PRD quality gates.
5. **Phase 4 — Queue/worker escalation:** consider heavier architecture only if measured throughput still fails after earlier phases.

## Key Source Files

| File | Purpose |
|------|---------|
| `lib/rss/ingest.ts` | RSS feed fetching, parsing, dedup, insert |
| `lib/rss/feed-registry.ts` | Active source list from DB |
| `lib/rss/parser.ts` | RSS XML parsing via rss-parser |
| `lib/rss/normalization.ts` | URL canonicalization |
| `lib/rss/dedup.ts` | Canonical URL + fingerprint dedup |
| `lib/ai/embeddings.ts` | Gemini embedding generation |
| `lib/ai/clustering.ts` | Cosine similarity clustering + singleton/expiry logic |
| `lib/ai/story-assembler.ts` | AI headline/summary/topic/region generation |
| `lib/pipeline/story-state.ts` | Publication decision logic |
| `lib/ai/region-classifier.ts` | Region classification via Gemini |
| `lib/pipeline/process-runner.ts` | Budget-constrained multi-pass orchestrator |
| `lib/pipeline/backlog.ts` | Backlog count queries |
| `lib/pipeline/claim-utils.ts` | Claim TTL helpers |
| `lib/pipeline/logger.ts` | Run logging to `pipeline_runs` table |
| `lib/pipeline/telemetry-utils.ts` | Shared telemetry helpers (toPerMinute rate calculation) |
| `lib/ai/recluster.ts` | Re-clustering maintenance: merge + split detection |
| `app/api/cron/ingest/route.ts` | Ingest cron endpoint |
| `app/api/cron/process/route.ts` | Process cron endpoint |
| `app/api/cron/recluster/route.ts` | Recluster cron endpoint (hourly) |
| `app/api/admin/pipeline/trigger/route.ts` | Admin manual trigger |
| `scripts/backfill-single-source.ts` | Re-assemble single-source stories (fix headlines + fabricated perspectives) |
| `supabase/migrations/031_pgvector_story_matching.sql` | HNSW index + `match_story_centroid` RPC for clustering Pass 1 |
