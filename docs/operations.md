# Operations Runbook

## Dev Commands

```bash
npm run dev           # Start dev server (localhost:3000)
npm run build         # Production build (must be zero errors)
npm run lint          # ESLint
npm test              # Vitest run (all tests)
npm run test:watch    # Vitest watch mode
npm run test:coverage # Coverage report (target ≥80%)
```

## Environment Variables

| Variable | Required | Used by |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser + server Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser + server Supabase clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side service client (bypasses RLS) |
| `GEMINI_API_KEY` | Yes | Gemini REST client (`lib/ai/gemini-client.ts`) |
| `CRON_SECRET` | Yes | Auth header for cron endpoints |
| `CLUSTERING_SIMILARITY_THRESHOLD` | No | Cosine similarity threshold for clustering (default 0.70) |
| `CLUSTERING_SPLIT_THRESHOLD` | No | Minimum similarity for recluster split detection (default 0.60) |
| `CLUSTERING_CANDIDATE_COUNT` | No | pgvector RPC candidate count (default 15) |
| `CLUSTERING_PGVECTOR_BATCH_SIZE` | No | Articles per RPC batch in clustering Pass 1 (default 25) |
| `EMBED_BATCH_SIZE` | No | Gemini embedding texts per API call (default 100) |
| `PIPELINE_ASSEMBLY_MODE` | No | Override for tiered routing. Unset (default) = tiered: rich multi-bias clusters use Gemini synthesis, single-source uses the cheap summary path, thin clusters stay deterministic. `deterministic` = force every story through the no-Gemini path. `gemini` = force rich/single Gemini paths (pre-tiered behavior, ignores bucket threshold). |
| `PIPELINE_RICH_CLUSTER_MIN_SOURCES` | No | Minimum source count for a cluster to qualify for the rich Gemini path (default 3) |
| `PIPELINE_RICH_CLUSTER_MIN_BUCKETS` | No | Minimum distinct L/C/R bias buckets for a cluster to qualify for the rich Gemini path (default 2) |
| `PIPELINE_CONCURRENT_STAGES` | No | Run embed+cluster in parallel when `true` (default `false`) |
| `PIPELINE_INGEST_MAX_PER_SOURCE` | No | Max articles per source per ingest run (default 30) |
| `PIPELINE_ASSEMBLY_CONCURRENCY` | No | Assembly concurrency limit (default 12) |
| `RESEND_API_KEY` | For digest | Resend email API key (`lib/email/resend-client.ts`) |
| `RESEND_FROM_EMAIL` | No | Sender address for digest emails (defaults to `onboarding@resend.dev`) |
| `NEXT_PUBLIC_APP_URL` | No | App base URL for email links (defaults to `http://localhost:3000`) |
| `PIPELINE_CRAWLER_CONCURRENCY` | No | Concurrent crawler sources per ingest run (default 2) |
| `PIPELINE_CRAWLER_TIMEOUT_MS` | No | Per-page fetch timeout for crawler (default 15000ms) |
| `CRAWLER_USER_AGENT` | No | User agent for crawler requests (default `AxiomNews/1.0 (News Crawler)`) |
| `NEWSAPI_API_KEY` | For APIs | NewsAPI.org API key |
| `PIPELINE_NEWSAPI_CONCURRENCY` | No | Concurrent news API sources per ingest run (default 1) |
| `PIPELINE_RSS_CONCURRENCY` | No | Concurrent RSS sources per ingest run (default 5) |
Copy `.env.example` to `.env.local` and fill in values. Never commit `.env.local`.

## Data Pipeline Flow

```
News Sources (RSS + Crawlers + APIs)
    │
    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Ingest     │───▶│   Embed      │───▶│   Cluster    │───▶│   Assemble   │───▶│  Publish /   │
│              │    │              │    │              │    │              │    │    Review    │
│ fetch → parse│    │ article text │    │ group by     │    │ headline     │    │              │
│ → normalize  │    │ → Gemini     │    │ embedding    │    │ summary      │    │ published or │
│ → dedup →    │    │ embeddings   │    │ similarity   │    │ spectrum     │    │ needs_review │
│ insert       │    │              │    │              │    │ topic        │    │ by risk      │
└──────────────┘    └──────────────┘    └──────────────┘    │ blindspot    │    └──────────────┘
                                                            │ region       │
  /api/cron/ingest         /api/cron/process                └──────────────┘    /admin/review
```

**Ingest** (`/api/cron/ingest`): Fetches all RSS feeds from the registry, parses articles,
normalizes URLs, deduplicates by canonical URL, fingerprints titles, and inserts new articles into the `articles` table.

Article identity rules:
- `url` = original feed URL exactly as received
- `canonical_url` = normalized dedup key used to collapse tracking/noise variants
- migration `011_articles_canonical_url_cutover.sql` removes the legacy raw-URL uniqueness constraint so ingest can rely on canonical identity without breaking older rows
- migration `012_pipeline_backfill_hardening.sql` backfills `title_fingerprint` and clears stale/non-terminal claim timestamps on existing rows

**Process** (`/api/cron/process`): Orchestrates three bounded stages in freshness-first order and returns backlog counts before and after the run:
1. **Embed** — claims a limited batch of unembedded articles and generates Gemini vector embeddings
2. **Cluster** — claims a limited batch of embedded, unassigned articles and groups them into story clusters by cosine similarity
3. **Assemble** — claims a limited batch of pending stories and writes headline, summary, spectrum, topic, region, blindspot flag, and entity tags. Default routing is tiered: rich multi-bias clusters (≥`PIPELINE_RICH_CLUSTER_MIN_SOURCES` sources spanning ≥`PIPELINE_RICH_CLUSTER_MIN_BUCKETS` L/C/R buckets) go through full Gemini synthesis; single-source clusters use the cheap Gemini summary path; thin clusters (below either threshold) use the deterministic extractive path. Set `PIPELINE_ASSEMBLY_MODE=deterministic` to force the no-Gemini path, or `PIPELINE_ASSEMBLY_MODE=gemini` to force the rich/single Gemini paths for every cluster.

The process runner is backlog-aware, multi-pass, and freshness-first:
- embed target per invocation defaults to `1500` articles
- cluster target per invocation defaults to `1500` articles
- assemble target per invocation defaults to `100` stories
- default batch sizes: embed `200`, cluster `300`, assemble `50`
- each invocation works in rounds, refreshing backlog between rounds so newly embedded articles can be clustered before more work starts
- embed reserves time budget for downstream cluster/assembly stages so they are not starved
- assembly is deferred when a freshness backlog exists **and** the remaining time budget is too small to run both freshness stages and assembly; with `Infinity` budget (admin trigger / local), assembly always runs alongside freshness stages
- stage summaries include `passes`, `skipped`, and `skipReason` so operators can tell whether a stage had no backlog, no progress, or was held back to protect freshness work
- concurrent mode: `PIPELINE_CONCURRENT_STAGES=true` runs embed and cluster in `Promise.all` (default: `false`, opt-in)
- env overrides: `PIPELINE_PROCESS_EMBED_TARGET`, `PIPELINE_PROCESS_CLUSTER_TARGET`, `PIPELINE_PROCESS_ASSEMBLE_TARGET`, `PIPELINE_PROCESS_EMBED_BATCH_SIZE`, `PIPELINE_PROCESS_CLUSTER_BATCH_SIZE`, `PIPELINE_PROCESS_ASSEMBLE_BATCH_SIZE`, `PIPELINE_PROCESS_TIME_BUDGET_MS`, `PIPELINE_PROCESS_CLUSTER_RESERVE_MS`, `PIPELINE_PROCESS_ASSEMBLE_RESERVE_MS`, `PIPELINE_CONCURRENT_STAGES`

Current observability is split across two surfaces:
- `/api/admin/pipeline` exposes run history with step timings and stage summaries
- `/api/admin/pipeline/stats` currently exposes coarse live counts only (`publishedStories`, `totalArticles`, `reviewQueue`, `unembedded`, `unclustered`, `expiredArticles`)

The approved throughput redesign in `.omx/plans/prd-pipeline-throughput-scale-20260402.md` expands these surfaces in phases: instrumentation first, then batching/concurrency improvements, then conditional lifecycle/model-routing changes only if telemetry proves they are needed.

Claim timestamp rules:
- `embedding_claimed_at` and `clustering_claimed_at` are 30 minute leases
- `assembly_claimed_at` is a 60 minute lease
- claim timestamps are operational markers only; readiness still comes from `is_embedded`, `story_id`, and `assembly_status`

Stories now use explicit pipeline/publication state:
- `assembly_status`: `pending | processing | completed | failed`
- `publication_status`: `draft | needs_review | published | rejected`
- `story_kind`: always `'standard'` (constrained by migration 016)

The public feed only serves `publication_status = 'published'`.

The pipeline processes all pending articles regardless of age. Clustering handles unmatchable articles via attempt counting (3 attempts → singleton promotion).

Time budget: the process runner defaults to no time budget (`Infinity`) so local and admin-triggered runs drain the queue completely. The cron route (`/api/cron/process`) passes an explicit 100-second budget to fit within Vercel's 120-second serverless timeout. Override via `PIPELINE_PROCESS_TIME_BUDGET_MS` env var.

Publishing is conservative:
- most stories auto-publish (including blindspots and mixed-factuality sources)
- sparse coverage (<2 articles or <2 sources), AI fallbacks, and failed assembly runs go to `needs_review`
- admins review `needs_review` stories via `/admin/review`
- factuality and blindspot status are shown in the UI for user filtering, not used as publication gates

### Backfill Entity Tags

For existing published stories that predate entity extraction, run the backfill script:

```bash
# Dry run — preview what would be tagged
npx tsx scripts/backfill-tags.ts --dry-run

# Run for real (default batch size 50, 500ms delay between batches)
npx tsx scripts/backfill-tags.ts

# Custom batch size
npx tsx scripts/backfill-tags.ts --batch-size 10
```

The script queries published stories with zero `story_tags` rows, runs local deterministic `extractEntities` on their articles, and calls `upsertStoryTags`. A `.backfill-empty-ids` skip file tracks stories that yielded no entities so repeated runs skip them.

### Audit Deterministic Assembly

Before or after switching assembly behavior, compare stored story fields against deterministic output without writing to the database:

```bash
npm run audit:deterministic-assembly -- --limit 100
npm run audit:deterministic-assembly -- --limit 100 --multi-only
```

The audit prints changed-field counts and up to 10 examples. It is read-only and requires `NEXT_PUBLIC_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`.

### Backfill Single-Source Stories

Re-assembles single-source stories to fix AI-rewritten headlines and fabricated cross-spectrum perspectives from the old pipeline. Apply migration 029 first for instant metadata fixes (`is_blindspot`, `controversy_score`, `sentiment`), then run the backfill script to re-generate headlines and summaries via `assembleSingleStory`:

```bash
# Dry run — preview headline changes and fabricated framing
npx tsx scripts/backfill-single-source.ts --dry-run

# Run for real (default batch size 5, 500ms delay between batches)
npx tsx scripts/backfill-single-source.ts

# Custom batch size (lower = safer, each story makes AI calls)
npx tsx scripts/backfill-single-source.ts --batch-size 3
```

The script queries completed single-source stories (`source_count = 1`), calls `assembleSingleStory` to replace AI headlines with the original article title, regenerate summaries via flash-lite, and recompute all metrics. Failed stories are logged but don't stop the batch. Safe to re-run — already-fixed stories will be re-assembled idempotently, though LLM-generated text (summaries) may differ slightly between runs due to non-zero temperature.

### Seed Media Ownership (Wikidata)

Resolves `media_owners` + `sources.owner_id` from Wikidata's SPARQL endpoint. The script is **dry-run only by design** — it never writes to the DB. Review the CSV, then hand-author `supabase/migrations/051_ownership_backfill.sql` from the approved rows.

```bash
# Emits scripts/out/ownership-backfill.csv with proposed inserts/links
npx tsx scripts/seed-ownership.ts --dry-run

# Custom output path and parent-walk depth
npx tsx scripts/seed-ownership.ts --dry-run --out /tmp/ownership.csv --max-hops 4
```

The CSV columns: `source_slug, source_wikidata_qid, resolved_owner_name, resolved_owner_qid, resolved_owner_type, country, action(insert|link|skip|mismatch|confirmed), confidence(high|medium|low), notes`.

**Action semantics:**
- `insert` — source has no `owner_id` yet; migration should `INSERT ... ON CONFLICT DO NOTHING` on `media_owners`, then `UPDATE sources SET owner_id = ...`
- `confirmed` — source is already linked to an owner whose `wikidata_qid` matches Wikidata; no-op, no SQL needed
- `mismatch` — two cases:
  1. source is already linked but to a *different* owner (or an owner with no QID). **No `UPDATE` is generated.** Review manually; if you want to relink, re-run with `--allow-overwrite`. This prevents silent clobbering of curated ownership data.
  2. Wikidata returned multiple distinct P127 candidates (current + former, competing claims). `notes` lists all candidates. Pick one manually before authoring the migration row.
- `link` — only appears when `--allow-overwrite` is passed. Confidence is clamped to `low` so a reviewer notices.
- `skip` — missing `wikidata_qid`, no P127 claim, or SPARQL lookup failure (reason in `notes`).

**Apply workflow:**
1. Run `--dry-run` against staging DB (needs `SUPABASE_SERVICE_ROLE_KEY`)
2. Review CSV; drop low-confidence or wrong rows. Pay attention to `mismatch` rows — these are pre-existing curated links.
3. Author `supabase/migrations/051_ownership_backfill.sql` using `INSERT ... ON CONFLICT (slug) DO NOTHING` + `UPDATE sources SET owner_id = ... WHERE slug = ...` (only for `insert` / `link` rows, never `mismatch`)
4. `supabase db push` against staging, spot-check 5 stories
5. Repeat against production

## Running the Pipeline Locally

### 1. Start the dev server

```bash
npm run dev
```

### 2. Trigger ingestion

```bash
curl -s http://localhost:3000/api/cron/ingest \
  -H "Authorization: Bearer $CRON_SECRET" | jq .
```

Expected response:
```json
{
  "success": true,
  "data": {
    "totalFeeds": 55,
    "successfulFeeds": 43,
    "failedFeeds": 12,
    "newArticles": 7,
    "errors": [{ "slug": "...", "name": "...", "error": "..." }]
  }
}
```

### 3. Trigger AI processing

Wait ~1 minute after ingestion, then:

```bash
curl -s http://localhost:3000/api/cron/process \
  -H "Authorization: Bearer $CRON_SECRET" | jq .
```

Expected response:
```json
{
  "success": true,
  "data": {
    "backlog": {
      "before": {
        "unembeddedArticles": 42,
        "unclusteredArticles": 15,
        "pendingAssemblyStories": 2,
        "reviewQueueStories": 3
      },
      "after": {
        "unembeddedArticles": 0,
        "unclusteredArticles": 0,
        "pendingAssemblyStories": 0,
        "reviewQueueStories": 4
      }
    },
    "embeddings": {
      "totalProcessed": 42,
      "claimedArticles": 42,
      "errors": [],
      "passes": 2,
      "skipped": false,
      "skipReason": null
    },
    "clustering": {
      "newStories": 2,
      "updatedStories": 1,
      "assignedArticles": 15,
      "unmatchedSingletons": 4,
      "expiredArticles": 0,
      "errors": [],
      "passes": 2,
      "skipped": false,
      "skipReason": null
    },
    "assembly": {
      "storiesProcessed": 2,
      "claimedStories": 2,
      "autoPublished": 1,
      "sentToReview": 1,
      "errors": [],
      "passes": 1,
      "skipped": false,
      "skipReason": null
    }
  }
}
```

### 4. Verify results

```bash
curl -s "http://localhost:3000/api/stories?limit=50" | jq '.data | length'
```

### 5. Fetch a story timeline

```bash
curl -s "http://localhost:3000/api/stories/{story-id}/timeline" | jq .
```

Expected response:
```json
{
  "success": true,
  "data": {
    "storyId": "...",
    "events": [...],
    "totalArticles": 43,
    "timeSpanHours": 72
  }
}
```

### 6. Trigger re-clustering maintenance

```bash
curl -s http://localhost:3000/api/cron/recluster \
  -H "Authorization: Bearer $CRON_SECRET" | jq .
```

Expected response:
```json
{
  "success": true,
  "correlationId": "019d791a-29e5-7c30-aca5-8a239348c7c6",
  "data": {
    "mergedPairs": 1,
    "splitArticles": 2,
    "errors": []
  }
}
```

The `correlationId` is a per-invocation UUID that tags every stage event this run emits. Recluster does not create a `pipeline_runs` row (its run_type does not fit the `ingest|process|full` enum), so drill-down happens directly in `PipelineEventsPanel`: paste the `correlationId` into the run-id filter on `/admin/pipeline` to see this run's `pgvector_fallback` warnings and any other stage events it wrote.

### 7. Trigger blindspot digest email

```bash
curl -s -X POST http://localhost:3000/api/cron/digest \
  -H "Authorization: Bearer $CRON_SECRET" | jq .
```

## Manual Reprocessing

Before reprocessing, admins can preview which assembly path the pipeline will take via the **Routing Preview** panel in `ReviewDetail` on `/admin/review` (or `GET /api/admin/review/[id]/routing-preview` directly). This surfaces the current `sourceCount`, distinct L/C/R buckets, chosen path (`rich`/`single`/`thin`), and any `PIPELINE_ASSEMBLY_MODE` override, so the operator can judge whether a rerun will hit Gemini or stay deterministic before issuing the reset.

If stories have missing or broken headlines/summaries, reset them back to draft/pending and re-run assembly:

### Reset a story's AI-generated fields via Supabase REST

```bash
# Find the story ID in the Supabase dashboard or via API
STORY_ID="your-story-uuid"

# PATCH the story to clear AI fields and reset pipeline state
curl -X PATCH \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/stories?id=eq.$STORY_ID" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "headline": "Pending headline generation",
    "ai_summary": null,
    "assembly_status": "pending",
    "publication_status": "draft",
    "review_status": "pending",
    "review_reasons": [],
    "confidence_score": null,
    "processing_error": null,
    "assembled_at": null,
    "published_at": null,
    "assembly_claimed_at": null
  }'
```

Then re-trigger processing:

```bash
curl -s http://localhost:3000/api/cron/process \
  -H "Authorization: Bearer $CRON_SECRET" | jq .
```

### Bulk reset (all draftable stories)

```bash
curl -X PATCH \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/stories?assembly_status=neq.pending&publication_status=neq.rejected" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "headline": "Pending headline generation",
    "ai_summary": null,
    "assembly_status": "pending",
    "publication_status": "draft",
    "review_status": "pending",
    "review_reasons": [],
    "confidence_score": null,
    "processing_error": null,
    "assembled_at": null,
    "published_at": null,
    "assembly_claimed_at": null
  }'
```

## Investigating a Degraded Run

When `PipelineRunHistory` shows a run with `status = failed`, or `pipeline_runs.summary.*.errors` is non-empty, use the stage event stream to find the root cause. See `docs/architecture.md — Observability` for the data model.

If the degradation looks ingest-side (empty feeds, repeated `last_fetch_error` on the same sources), jump to **Source-health interpretation (Phase 11)** below for the cooldown ramp and auto-disable semantics. If a stage event panel shows `dlq_pushed`, see the **Dead Letter Queue Replay Runbook** below for the replay/dismiss workflow.

### 1. Find the run ID

Two ways:

```bash
# From the cron response body
curl -s http://localhost:3000/api/cron/process \
  -H "Authorization: Bearer $CRON_SECRET" | jq '.data.runId'

# Or via the runs table
psql "$DATABASE_URL" -c \
  "SELECT id, run_type, status, started_at FROM pipeline_runs ORDER BY started_at DESC LIMIT 10"
```

### 2. Open the Events panel

Go to `/admin/pipeline`, scroll past `PipelineRunHistory` to the **Stage Events** panel. Paste the `runId` into the Run ID filter and toggle the level chips so only `warn` and `error` are selected. This narrows the view to the events that actually caused the degradation.

### 3. Drill down on the failure head

Click the oldest warn/error row (events are sorted newest-first; scroll to the bottom of the list). A modal opens with the pretty-printed JSONB `payload`. Common event types and what they mean:

| `event_type` | Stage | Level | Meaning |
|--------------|-------|-------|---------|
| `pgvector_fallback` | cluster, recluster | warn | `match_story_centroid` RPC unavailable; fell back to JS brute-force. Check that `extensions.vector` is installed and the SECURITY DEFINER RPC is present. |
| `dlq_pushed` | embed, cluster, assemble | error | A single item exhausted its retry budget and was pushed to `pipeline_dead_letter`. `payload.articleId`/`payload.storyId` + `payload.retryCount` tell you which item. See **Dead Letter Queue Replay Runbook** below for how to replay or dismiss an entry. |
| `embedding_write_failed` | embed | error | `bulkWriteEmbeddings` upsert failed. `payload.batchSize` tells you how many rows were affected. |
| `retry_count_read_failed` | cluster | warn | Couldn't read `clustering_retry_count` before scheduling a failure retry; the run continues with retry count = 0 for affected rows. Non-fatal. |
| `cleanup_fallback_failed` | cluster | error | The cleanup phase could not release claims after a primary failure. `payload.articleIds` lists the stranded rows. Check for `apply_clustering_failure` RPC / migration 043. |
| `tag_extraction_failed` | assemble | warn | `extractEntities` or `upsertStoryTags` rejected; the story still publishes, it just has no tags. |

### 4. Query the table directly (for ad-hoc investigations)

```sql
-- All warn/error events in the last run
SELECT stage, level, event_type, payload, created_at
FROM pipeline_stage_events
WHERE run_id = '<uuid>' AND level IN ('warn', 'error')
ORDER BY created_at ASC;

-- Find the most common failure mode over the last 24 hours
SELECT stage, event_type, count(*)
FROM pipeline_stage_events
WHERE level IN ('warn', 'error')
  AND created_at > now() - interval '24 hours'
GROUP BY stage, event_type
ORDER BY count(*) DESC;

-- All DLQ pushes from a specific run
SELECT item_id, payload->>'retryCount' AS retries, payload->>'error' AS error
FROM pipeline_stage_events
WHERE run_id = '<uuid>' AND event_type = 'dlq_pushed';
```

### 5. Retention

`pipeline_stage_events` has no automated cleanup job. If the table grows unwieldy, run:

```sql
-- Keep 30 days
DELETE FROM pipeline_stage_events WHERE created_at < now() - interval '30 days';
```

This is safe to run while the pipeline is live; the emit path is append-only.

### Dead Letter Queue Replay Runbook

The DLQ (`pipeline_dead_letter`, migration 041) collects single items whose retry budget ran out: embed budget = 5, cluster budget = 5, assemble budget = 3. Items land here instead of being silently abandoned or retried forever. Source of truth: `lib/pipeline/dead-letter.ts` + `app/api/admin/dlq/route.ts`. Admin UI: `/admin/pipeline` → DLQ panel (Phase 13B). For the architectural context — retry policy, backoff formula, and owner-scoped write coupling — see `docs/pipeline.md` → **Claim Leases** → **Retry budget + DLQ**.

**1. Find DLQ entries.**

The primary surface is the UI:

1. Visit `/admin/pipeline` → scroll to the **Dead Letter Queue** panel.
2. Each row shows `itemKind` (`article_embed` | `article_cluster` | `story_assemble`), the underlying `itemId`, `retryCount`, `lastError`, and `failedAt`. Only unreplayed entries appear — replayed/dismissed entries are hidden.

Or query the API directly:

```bash
curl -s "http://localhost:3000/api/admin/dlq" \
  -H "Cookie: <auth-cookies>" | jq .
```

Or the table:

```sql
SELECT id, item_kind, item_id, retry_count, left(last_error, 120) AS error,
       failed_at, replayed_at
FROM pipeline_dead_letter
WHERE replayed_at IS NULL
ORDER BY failed_at DESC
LIMIT 50;
```

**2. Decide: replay vs. dismiss.**

| Symptom | Action |
|---------|--------|
| Transient failure — upstream (Gemini, RPC) was down when the item ran; retrying now should succeed. | **Replay.** Resets the underlying row's retry metadata so the next pipeline pass picks it up. |
| Structural failure — the article is a parsing edge case, the source is broken, or the story was created from bad input. | **Dismiss.** Marks the DLQ entry replayed without touching the underlying row. The item stays in whatever terminal state it reached; it will not be retried. |
| `lastError` looks like a code bug (e.g. `TypeError`) | Neither — fix the code first, deploy, then replay once the fix is in production. Dismissing now will hide the evidence. |

**3. Replay.**

```bash
curl -s -X POST "http://localhost:3000/api/admin/dlq" \
  -H "Cookie: <auth-cookies>" \
  -H "Content-Type: application/json" \
  -d '{"action": "replay", "id": "<dlq-entry-uuid>"}' | jq .
```

Success response:
```json
{ "success": true, "data": { "id": "<dlq-entry-uuid>", "replayed": true } }
```

Under the hood `replayDeadLetterEntry` (a) clears `embedding_retry_count` / `clustering_retry_count` / assembly retry metadata and the claim fields on the underlying row, and (b) marks the DLQ entry `replayed_at = now()`. For `story_assemble` entries the reset goes through the assembly_version CAS (`requeueStoryForReassembly`) to avoid stepping on an in-flight assembler.

**4. 409 conflict on replay.**

If the response is `409 Conflict` with a message containing `currently being assembled or its assembly_version moved`, another admin already replayed this entry (or the underlying story started assembling between your list-call and your replay-call). The DLQ entry is intentionally left visible so you can retry:

- Wait ~60s for the concurrent assembly pass to finish.
- Re-list the DLQ; if the entry is still there, retry the replay call.
- If the same 409 keeps firing, inspect `pipeline_stage_events` for the story id — a runaway assembler may be stuck.

The 409 mapping is in `app/api/admin/dlq/route.ts`: the route regex-matches the distinctive error string thrown by `dead-letter.ts` and returns 409 instead of a generic 500.

**5. Dismiss.**

```bash
curl -s -X POST "http://localhost:3000/api/admin/dlq" \
  -H "Cookie: <auth-cookies>" \
  -H "Content-Type: application/json" \
  -d '{"action": "dismiss", "id": "<dlq-entry-uuid>"}' | jq .
```

Success response:
```json
{ "success": true, "data": { "id": "<dlq-entry-uuid>", "dismissed": true } }
```

Dismiss simply stamps `replayed_at` on the DLQ entry without touching the underlying article/story. Use this for items you've decided are permanently un-processable.

**6. Retention.**

`pipeline_dead_letter` has no automated cleanup. Dismissed/replayed entries stay in the table as an audit trail. If it grows large:

```sql
DELETE FROM pipeline_dead_letter
WHERE replayed_at IS NOT NULL
  AND replayed_at < now() - interval '90 days';
```

### Stale-worker race diagnosis (Phase 10)

A stale-worker race happens when a pipeline worker exceeds its claim
TTL (30 min for embed/cluster, 60 min for assemble) and another worker
re-claims the same row. Phase 10 makes these races visible in the
Events panel.

1. Open `/admin/pipeline` → Events panel.
2. Filter `level=info` and search for `ownership_moved` in the panel.
   One or two per hour is normal (claim TTL churn). Dozens per minute
   indicate either a runaway worker or an under-sized batch budget.
3. For each `ownership_moved` event, click through the payload — it
   includes `{ phase, previousOwner }`. The `phase` field tells you
   whether the race happened on the success path (`success`,
   `singleton_release`, `singleton_promotion`, `new_cluster`,
   `assignment`) or the failure path (`failure`).
4. If you see ANY `[<stage>/policy_drift]` errors in `pipeline_runs.steps`
   for the same run, the write layer is broken: run

   ```sql
   SELECT COUNT(*), clustering_claim_owner
   FROM articles
   WHERE clustering_claimed_at IS NOT NULL
   GROUP BY clustering_claim_owner;
   ```

   and look for unexpected owner UUIDs. Policy drift is a LOUD failure
   because silently dropping a stranded claim masks the real schema or
   RLS issue. Grep cron logs for `\[(embed|assemble|cluster)/policy_drift\]`
   to find the originating stage.

5. The `create_story_with_articles` RPC raises SQLSTATE P0010 on owner
   mismatch (Phase 10 uses a dedicated SQLSTATE so it doesn't collide
   with the migration's plain P0001 null-validation guards). The JS
   wrapper catches it and returns `{ kind: 'ownership_moved' }`. If
   you see `owner-scoped assignment matched N of M articles
   (ownership moved or row missing)` errors with code P0010 in raw
   RPC logs, that's the ownership-moved path firing — benign, no
   action needed. P0001 errors from this RPC are caller bugs (null
   article ids or null owner) and should be investigated.

### Source-health interpretation (Phase 11)

Phase 11 replaced the manual disable path with a policy-driven control
plane. Every failure bumps `consecutive_failures`, advances
`cooldown_until` along an exponential ramp, and — once the thresholds
are crossed — sets `auto_disabled_at`. Each of these columns feeds the
`/admin/pipeline` Source Health table and the eligibility filter in
`lib/ingestion/source-registry.ts`. Source code of truth:
`lib/ingestion/source-policy.ts`; SQL mirror:
`supabase/migrations/046_source_health_control.sql`.

**Cooldown ramp** (per consecutive failure):

| Consecutive failures | Cooldown |
|----------------------|----------|
| 1                    | 2 minutes |
| 2                    | 4 minutes |
| 3                    | 8 minutes |
| 4                    | 16 minutes |
| 5                    | 32 minutes |
| 6                    | 64 minutes |
| 7                    | 128 minutes |
| 8+                   | 240 minutes (capped) |

A success resets `consecutive_failures` to 0 (`increment_source_success`
in migration 036), which naturally restarts the ramp on the next
failure. The in-memory eligibility filter treats a past
`cooldown_until` as eligible, so stale values do not need to be cleared
on success.

**Auto-disable predicate.** `consecutive_failures >= 10` AND
`total_articles_ingested < 20`. The AND-join shields high-value sources
that have been stable historically — during a transient outage burst
their `consecutive_failures` climbs and surfaces in the dashboard for
an operator to decide whether to intervene. Only low-traffic sources
that were never productive auto-disable on their own.

**Known limitation.** `total_articles_ingested` is a lifetime counter,
not a recent-window ratio. A source that ingested 50k articles a year
ago but is now permanently broken will NOT auto-disable on its own —
its `consecutive_failures` will keep climbing and operators must
intervene via the dashboard. This is acceptable for the first cut of
the control plane and is tracked in the Phase 11 commit notes.

**Interpreting the Source Health panel:**
- **Green (`success`)** — source is eligible, recent fetch succeeded.
- **Amber (`Cooldown Xm`)** — source hit a failure and is paused for
  `X` minutes. Nothing to do unless the cooldown badge keeps appearing
  after each ingest cycle, in which case inspect `last_fetch_error`.
- **Red (`Auto-disabled`)** — threshold crossed. The row shows a
  `Reactivate` button. Click to clear the three health columns and
  reset `consecutive_failures` to 0.

### Maintenance operations (Phase 12)

Phase 12 replaced the destructive cleanups previously baked into
migrations 025 and 026 with an operator-facing purge tool. Schema
history is now additive; the next cleanup must go through this tool,
**not** a new migration.

**Available purges** (all audited in `pipeline_maintenance_audit`,
migration 047):

| Action | Predicate | Replaces |
|--------|-----------|----------|
| `purge_unembedded_articles` | `is_embedded = false AND created_at < now() - INTERVAL '7 days'` (configurable via `olderThanDays`) | migration 025 #1 |
| `purge_orphan_stories` | stories with no referencing `articles.story_id` | migration 025 #5 / 026 #3 |
| `purge_expired_articles` | `clustering_status = 'expired'` | migration 025 #2 |

**Guardrails.**

- Every call writes an audit row BEFORE the delete, finalizes it AFTER,
  and preserves the audit row on failure with the error message. Dry-
  runs also write audit rows so an operator can review planned cleanups
  without executing them.
- Each call is bounded to 1000 rows per invocation so row-level locks
  stay short. Repeat to drain larger backlogs.
- Every button in the UI performs a **dry-run first** and surfaces the
  count + sample IDs in a confirmation modal. The real run fires only
  after the operator clicks **Confirm**.

**How to run a purge.**

1. Visit `/admin/pipeline` → scroll to the **Maintenance** panel.
2. Click the purge button you want. The dry-run call fires immediately.
3. Review the count and sample ids in the confirmation modal.
4. Click **Confirm** to execute the real run, or **Cancel** to abort.
5. The green banner shows the audit id for the successful run — look
   it up in `pipeline_maintenance_audit` if you need to diff plan vs.
   outcome.

**How to query the audit log.**

```sql
-- Last 20 maintenance runs (dry-run + real)
SELECT
  triggered_at,
  action,
  dry_run,
  deleted_count,
  completed_at,
  error,
  triggered_by
FROM pipeline_maintenance_audit
ORDER BY triggered_at DESC
LIMIT 20;
```

**Guardrail box.** Future data cleanups MUST use this tool, not new
migrations. Migrations are for schema only. If you ever need a
cleanup predicate that is not yet in `lib/admin/pipeline-maintenance.ts`,
add the TS function + a new `action` enum value, not a new migration.

**How to manually reactivate a source.**

The primary path is the UI: `/admin/pipeline` → Source Health table →
locate the row → click `Reactivate`. The button appears on any row
where `auto_disabled_at` is set or `cooldown_until` is in the future.
The endpoint is idempotent: repeat clicks on a healthy source return
200 without writing.

The reactivate endpoint is admin-only and delegates to
`getAdminUser()`, which expects the same cookie-based Supabase session
used by the rest of the admin dashboard (with Bearer fallback for
mobile — see `lib/api/auth-helpers.ts`). There is no machine-to-machine
service-role auth for this endpoint, so scripted reactivation is not
supported: run it from a browser signed in as an admin. If you need to
script it, use `psql` directly:

```sql
UPDATE sources
SET
  cooldown_until = NULL,
  auto_disabled_at = NULL,
  auto_disabled_reason = NULL,
  consecutive_failures = 0,
  last_fetch_error = NULL,
  updated_at = now()
WHERE id = '<source-uuid>';
```

Expected API response (from the UI path):
`{ "success": true, "data": { "id": "...", "reactivatedAt": "..." } }`.
When the source was already healthy the response additionally includes
`"noop": true` so you can tell an idempotent no-op from a real change.
404 if the id does not match a row. 400 if the id is not a UUID.

## API Reference

### Public Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stories` | None | Paginated story feed with filtering |
| GET | `/api/stories/[id]` | None | Single story detail |
| GET | `/api/stories/[id]/timeline` | None | Story coverage timeline |
| GET | `/api/sources` | None | Source directory |
| GET | `/api/sources/[slug]` | None | Source profile with 30-day coverage rollups |
| GET | `/api/sources/compare?left=<slug>&right=<slug>` | None | Two-source comparison over a fixed 30-day window |

### /api/stories Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `topic` | string | (all) | Filter by topic (politics, world, technology, etc.) |
| `search` | string | (none) | Full-text search on headline + summary |
| `blindspot` | boolean | (none) | If true, show only blindspot stories |
| `biasRange` | string | (all) | Comma-separated bias values (e.g., `lean-left,center,lean-right`) |
| `minFactuality` | string | (all) | Minimum factuality threshold (very-high, high, mixed, low, very-low) |
| `datePreset` | string | 'all' | Time range: `24h`, `7d`, `30d`, `all` |
| `page` | number | 1 | Page number (1-indexed) |
| `region` | string | (all) | Filter by region (us, international, uk, canada, europe) |
| `owner` | string | (none) | Media-owner slug (e.g. `warner-bros-discovery`). Recent-coverage filter (180-day window, max 1000 story IDs materialized). Not an all-time archive. |
| `limit` | number | 20 | Results per page (max 50) |

### /api/sources/compare Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `left` | string | Yes | Left/source-A slug |
| `right` | string | Yes | Right/source-B slug |

Example:

```bash
curl -s "http://localhost:3000/api/sources/compare?left=reuters&right=fox-news" | jq .
```

### Protected Endpoints (Cron)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cron/ingest` | `Bearer CRON_SECRET` | Trigger RSS ingestion |
| GET | `/api/cron/process` | `Bearer CRON_SECRET` | Trigger AI processing |
| GET | `/api/cron/recluster` | `Bearer CRON_SECRET` | Hourly re-clustering maintenance (merge + split) |
| POST | `/api/cron/digest` | `Bearer CRON_SECRET` | Send weekly blindspot digest email |

### Protected Endpoints (User — Supabase Auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bookmarks` | List user's bookmarked story IDs |
| POST | `/api/bookmarks` | Create bookmark |
| DELETE | `/api/bookmarks/[storyId]` | Remove bookmark |
| GET | `/api/reading-history` | List read story IDs |
| POST | `/api/reading-history/[storyId]` | Mark story as read |
| DELETE | `/api/reading-history/[storyId]` | Mark story as unread |
| GET | `/api/preferences` | Get user preferences |
| PATCH | `/api/preferences` | Update user preferences |
| GET | `/api/dashboard/bias-profile` | Computed bias distribution |
| GET | `/api/dashboard/suggestions` | Bias-aware story recommendations |
| GET | `/api/stories/for-you` | Personalized "For You" feed |
### Protected Endpoints (Admin — Supabase Auth + admin_users required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/review` | Review queue (filterable by status) |
| PATCH | `/api/admin/review/[id]` | Approve or reject a story |
| GET | `/api/admin/review/[id]/routing-preview` | Preview which assembly path (rich/single/thin) the pipeline would pick |
| GET | `/api/admin/review/stats` | Review queue statistics |
| GET | `/api/admin/pipeline` | Pipeline dashboard overview |
| GET | `/api/admin/pipeline/sources` | Source health data |
| GET | `/api/admin/pipeline/stats` | Pipeline statistics |
| POST | `/api/admin/pipeline/trigger` | Trigger pipeline run manually |

#### Admin API Examples

```bash
# Fetch review queue (pending stories)
curl -s "http://localhost:3000/api/admin/review?status=pending&page=1&limit=20" \
  -H "Cookie: <auth-cookies>" | jq .
```

```bash
# Preview which assembly path the pipeline would pick for a review-queue story
curl -s "http://localhost:3000/api/admin/review/{story-id}/routing-preview" \
  -H "Cookie: <auth-cookies>" | jq .
```

Expected response:
```json
{
  "success": true,
  "data": {
    "storyId": "...",
    "sourceCount": 2,
    "biases": ["left", "lean-left"],
    "distinctBiasBuckets": 1,
    "assemblyPath": "thin",
    "appliedThresholds": { "minSources": 3, "minBuckets": 2, "modeOverride": null }
  }
}
```

```bash
# Trigger a manual process run
curl -s -X POST "http://localhost:3000/api/admin/pipeline/trigger" \
  -H "Cookie: <auth-cookies>" \
  -H "Content-Type: application/json" \
  -d '{"type":"process"}' | jq .
```

Process trigger responses mirror the process summary shape documented earlier in this runbook.

Expected response for the review-queue example:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "headline": "...",
      "review_status": "pending",
      "publication_status": "needs_review",
      "confidence_score": 0.48,
      "review_reasons": ["blindspot_detected"],
      "topic": "politics"
    }
  ],
  "meta": { "total": 12, "page": 1, "limit": 20 }
}
```

```bash
# Approve a story
curl -s -X PATCH "http://localhost:3000/api/admin/review/{story-id}" \
  -H "Cookie: <auth-cookies>" \
  -H "Content-Type: application/json" \
  -d '{"action": "approve"}' | jq .
```

Expected response:
```json
{ "success": true }
```

```bash
# Approve with edits (override headline and/or AI summary)
curl -s -X PATCH "http://localhost:3000/api/admin/review/{story-id}" \
  -H "Cookie: <auth-cookies>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "headline": "Corrected headline text",
    "ai_summary": {
      "commonGround": "Both sides agree on...",
      "leftFraming": "Progressive outlets emphasize...",
      "rightFraming": "Conservative outlets emphasize..."
    }
  }' | jq .
```

```bash
# Reject a story
curl -s -X PATCH "http://localhost:3000/api/admin/review/{story-id}" \
  -H "Cookie: <auth-cookies>" \
  -H "Content-Type: application/json" \
  -d '{"action": "reject"}' | jq .
```

```bash
# Reprocess a story (re-run AI assembly)
curl -s -X PATCH "http://localhost:3000/api/admin/review/{story-id}" \
  -H "Cookie: <auth-cookies>" \
  -H "Content-Type: application/json" \
  -d '{"action": "reprocess"}' | jq .
```

```bash
# Fetch review stats
curl -s "http://localhost:3000/api/admin/review/stats" \
  -H "Cookie: <auth-cookies>" | jq .
```

Expected response:
```json
{
  "success": true,
  "data": { "pending": 12, "approved": 45, "rejected": 3 }
}
```

#### Admin Source Management

```bash
# List all sources (with filters)
curl -s "http://localhost:3000/api/admin/sources?search=reuters&is_active=true&page=1&limit=50" \
  -H "Cookie: <auth-cookies>" | jq .

# Create a new source
curl -s -X POST "http://localhost:3000/api/admin/sources" \
  -H "Cookie: <auth-cookies>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Reuters", "url": "https://reuters.com", "rss_url": "https://feeds.reuters.com/reuters/topNews", "bias": "center", "factuality": "very-high", "ownership": "corporate", "region": "international"}' | jq .

# Update a source
curl -s -X PATCH "http://localhost:3000/api/admin/sources/{source-id}" \
  -H "Cookie: <auth-cookies>" \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}' | jq .

# Discover RSS feeds from a website
curl -s -X POST "http://localhost:3000/api/admin/sources/discover-rss" \
  -H "Cookie: <auth-cookies>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' | jq .

# Bulk import sources (pre-parsed CSV rows)
curl -s -X POST "http://localhost:3000/api/admin/sources/import" \
  -H "Cookie: <auth-cookies>" \
  -H "Content-Type: application/json" \
  -d '{"rows": [{"name": "Source A", "bias": "center", "factuality": "high", "ownership": "corporate"}]}' | jq .
```

### Admin Setup

To grant admin access, add the user's UUID to the `admin_users` table:

```sql
-- Find the user's ID
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Grant admin access
INSERT INTO admin_users (user_id) VALUES ('<user-uuid>');
```

### Testing the Review Process

1. **Add yourself as admin** — run the SQL insert above with your user UUID
2. **Run the pipeline** — trigger ingestion then processing (new stories start as `pending`):
   ```bash
   curl -s http://localhost:3000/api/cron/ingest \
     -H "Authorization: Bearer $CRON_SECRET" | jq .
   curl -s http://localhost:3000/api/cron/process \
     -H "Authorization: Bearer $CRON_SECRET" | jq .
   ```
3. **Visit `/admin/review`** — pending stories appear in the queue
4. **Test actions** — approve, reject, edit + approve, and reprocess stories
5. **Verify** — approved stories appear in the public feed at `/`; pending and rejected stories do not

See `docs/architecture.md` for full parameter and response shapes.

## Database

### Tables

| Table | Purpose |
|-------|---------|
| `sources` | News sources with bias, factuality, ownership metadata |
| `articles` | Individual articles fetched from RSS feeds |
| `stories` | Clustered story groups with deterministic or AI-generated summaries and explicit publication state — migration 010 |
| `bookmarks` | User bookmarks (user_id, story_id) — migration 003 |
| `reading_history` | User reading history (user_id, story_id, read_at, is_read) — migration 003 |
| `user_preferences` | User preferences (topics, region, perspective, factuality, digest flag) — migrations 004, 009 |
| `admin_users` | Admin user registry (user_id, role) — migration 006 |

### Seeding Sources

The sources table is seeded via `lib/supabase/seed-sources.ts`. Run as a one-time operation
after setting up the Supabase project:

```bash
npx tsx lib/supabase/seed-sources.ts
```

### Schema Migrations

Migration files live in `supabase/migrations/` and follow the naming convention `NNN_name.sql` (e.g., `003_bookmarks.sql`, `004_user_preferences.sql`).

#### Creating a new migration

1. Add a new SQL file in `supabase/migrations/` with the next sequence number
2. Update `lib/supabase/types.ts` to reflect any schema changes — types must stay in sync with the database

#### Applying migrations

```bash
npx supabase db push --linked
```

This is the **canonical method** for applying local migration files to the linked Supabase project.

#### Checking migration status

```bash
npx supabase migration list --linked
```

Shows which migrations have been applied and which are pending.

#### Dry run (preview without applying)

```bash
npx supabase db push --dry-run --linked
```

#### Repairing migration drift

If the remote database has changes that were applied outside the normal migration flow, mark a migration as already applied:

```bash
npx supabase migration repair --status applied NNN --linked
```

Replace `NNN` with the migration sequence number (e.g., `003`).

> **Warning:** Do NOT use the MCP `apply_migration` tool for local migration files. It creates migrations on the remote with a different timestamp-based name, causing version mismatch between local files and the remote migration history. Always use `npx supabase db push --linked` instead.

---

## Owner Data Backfill (Wikidata)

`media_owners` was hand-seeded with ≈20 entries in migration 048. Broader coverage comes from `scripts/seed-ownership.ts`, which queries Wikidata P127 ("owned by") for each active source and emits a reviewable CSV. A follow-up migration is written by hand from the approved CSV rows — the script never writes to the database directly (per the "No MCP migrations" policy).

### Regenerating the backfill CSV

```bash
set -a && . ./.env.local && set +a
mkdir -p scripts/out
npx tsx scripts/seed-ownership.ts --dry-run --out scripts/out/ownership-backfill.csv
```

The script is CSV-only: it refuses to run without `--dry-run`. Output is sorted by confidence (`high` → `medium` → `low` → `skip`). Review each row before promoting it into a migration.

### Prerequisite: `sources.wikidata_qid`

The script reads `sources.wikidata_qid` to drive SPARQL lookups. **As of 2026-04-21 that column does not exist** in the `sources` schema (not present in `lib/supabase/types.ts` and not created by any migration). Running the script currently fails with:

```
Failed to fetch sources: column sources.wikidata_qid does not exist
```

Before any owner backfill can happen, a preparatory migration must:
1. Add `wikidata_qid TEXT` to the `sources` table.
2. Populate it per outlet (operator research; QIDs are small — e.g. NYT=`Q9684`, BBC News=`Q9531`).

Until then `migration 052_ownership_backfill.sql` cannot be authored. The Part B CSV/migration commits for the 2026-04-21 owner-profile PR were intentionally skipped per the plan's gating logic; Part A (owner profile page + `/api/owners/by-slug/[slug]`) ships independently and operates on the existing 20 hand-seeded owners.

### Authoring the migration (once the prerequisite lands)

1. Run the dry-run command above.
2. Open the CSV, review every row; keep only `action = 'insert'` or `'link'` with `confidence = 'high'` for the first pass.
3. Create `supabase/migrations/052_ownership_backfill.sql` (or next available number) using migration 048 as a format reference: `INSERT INTO media_owners (...)` for new owners (always `owner_source = 'wikidata'`, `owner_verified_at = now()`), then `UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = ?) WHERE slug = ?` for each link. Do not touch existing `owner_source = 'manual'` rows.
4. Apply via `npx supabase db push --linked` and update `lib/supabase/types.ts` if any new enum values or columns were added.
