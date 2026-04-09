# Pipeline Architecture

Deep-dive into the news processing pipeline internals. For operational commands and API reference, see `docs/operations.md`.

## Overview

```
RSS Feeds ──► Ingest ──► Embed ──► Cluster ──► Assemble ──► Publish / Review
                ↑                                              ↑
           every 15min                                    every 15min
           (cron)                                         (cron, 5min offset)
```

The pipeline transforms raw RSS articles into published stories through four stages. Each stage is idempotent and uses per-row claim locks rather than global mutexes, allowing concurrent runs without data corruption.

## Entry Points

| Trigger | Route | Schedule | Auth |
|---------|-------|----------|------|
| Cron ingest | `GET /api/cron/ingest` | Every 15 min | `Bearer CRON_SECRET` |
| Cron process | `GET /api/cron/process` | Every 15 min (5 min offset) | `Bearer CRON_SECRET` |
| Cron recluster | `GET /api/cron/recluster` | Hourly | `Bearer CRON_SECRET` |
| Admin trigger | `POST /api/admin/pipeline/trigger` | Manual | Supabase auth + admin |

The admin trigger accepts a JSON body with `type: 'ingest' | 'process' | 'full'`. There is no distributed lock between triggers -- cron and admin can overlap freely.

## Stage 1: Ingest

**File:** `lib/rss/ingest.ts`  
**Route:** `app/api/cron/ingest/route.ts` (60s runtime limit)

1. Fetch active sources from `sources` table (`lib/rss/feed-registry.ts`)
2. Fetch RSS feeds concurrently (5 at a time)
3. Parse each feed into `ParsedFeedItem[]` (`lib/rss/parser.ts`)
4. Normalize URLs to canonical form (`lib/rss/normalization.ts`)
5. Deduplicate against DB by canonical URL + title fingerprint (`lib/rss/dedup.ts`)
6. Upsert articles in batches of 50, conflict key = `canonical_url`
7. Update source health: `last_fetch_at`, `last_fetch_status`, `consecutive_failures`

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

## Claim System

**File:** `lib/pipeline/claim-utils.ts`

Instead of a global pipeline lock, each row has a `*_claimed_at` timestamp that acts as a time-limited lease:

| Stage | Claim Field | TTL |
|-------|------------|-----|
| Embed | `embedding_claimed_at` | 30 min |
| Cluster | `clustering_claimed_at` | 30 min |
| Assemble | `assembly_claimed_at` | 60 min |

### Claim Lifecycle

1. **Scan:** Fetch 3x the batch size (to find enough unclaimed rows)
2. **Filter:** Keep rows where claim is `null` or TTL has expired
3. **Slice:** Take first N available
4. **Claim:** Set `*_claimed_at = now`
5. **Process:** Run the stage logic
6. **Release on success:** Set `*_claimed_at = null`
7. **Release on error:** Clear claim immediately for retry

If a worker crashes, another worker can pick up the row after TTL expires. Claims are operational markers only -- readiness is determined by `is_embedded`, `story_id`, and `assembly_status`.

## Concurrency

No distributed lock exists. Concurrent runs are safe because:

1. **Per-row claims** prevent duplicate processing of the same article/story
2. **Idempotent operations** -- upserts on `canonical_url` (ingest), updates by ID (embed/cluster/assemble)
3. **WHERE guards on updates** -- the expiry sweep re-checks `clustering_status = 'pending'` and `story_id IS NULL` before updating, preventing TOCTOU races

Worst case with concurrent runs: some redundant work (two workers claim different articles from the same batch), but no data corruption.

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
