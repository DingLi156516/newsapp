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
| `RESEND_API_KEY` | For digest | Resend email API key (`lib/email/resend-client.ts`) |
| `RESEND_FROM_EMAIL` | No | Sender address for digest emails (defaults to `onboarding@resend.dev`) |
| `NEXT_PUBLIC_APP_URL` | No | App base URL for email links (defaults to `http://localhost:3000`) |
Copy `.env.example` to `.env.local` and fill in values. Never commit `.env.local`.

## Data Pipeline Flow

```
RSS Feeds
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
3. **Assemble** — claims a limited batch of pending stories and generates headline, summary, spectrum, topic, region, blindspot flag, and entity tags

The process runner is backlog-aware, multi-pass, and freshness-first:
- embed target per invocation defaults to `1500` articles
- cluster target per invocation defaults to `1500` articles
- assemble target per invocation defaults to `100` stories
- default batch sizes: embed `50`, cluster `75`, assemble `25`
- each invocation works in rounds, refreshing backlog between rounds so newly embedded articles can be clustered before more work starts
- embed reserves time budget for downstream cluster/assembly stages so they are not starved
- assembly is deferred when a freshness backlog exists **and** the remaining time budget is too small to run both freshness stages and assembly; with `Infinity` budget (admin trigger / local), assembly always runs alongside freshness stages
- stage summaries include `passes`, `skipped`, and `skipReason` so operators can tell whether a stage had no backlog, no progress, or was held back to protect freshness work
- env overrides: `PIPELINE_PROCESS_EMBED_TARGET`, `PIPELINE_PROCESS_CLUSTER_TARGET`, `PIPELINE_PROCESS_ASSEMBLE_TARGET`, `PIPELINE_PROCESS_EMBED_BATCH_SIZE`, `PIPELINE_PROCESS_CLUSTER_BATCH_SIZE`, `PIPELINE_PROCESS_ASSEMBLE_BATCH_SIZE`, `PIPELINE_PROCESS_TIME_BUDGET_MS`, `PIPELINE_PROCESS_CLUSTER_RESERVE_MS`, `PIPELINE_PROCESS_ASSEMBLE_RESERVE_MS`

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

# Run for real (default batch size 25, 500ms delay between batches)
npx tsx scripts/backfill-tags.ts

# Custom batch size
npx tsx scripts/backfill-tags.ts --batch-size 10
```

The script queries published stories with zero `story_tags` rows, runs `extractEntities` on their articles, and calls `upsertStoryTags`. A `.backfill-empty-ids` skip file tracks stories that yielded no entities so repeated runs skip them.

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

### 6. Trigger blindspot digest email

```bash
curl -s -X POST http://localhost:3000/api/cron/digest \
  -H "Authorization: Bearer $CRON_SECRET" | jq .
```

## Manual Reprocessing

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
| `stories` | Clustered story groups with AI-generated summaries and explicit publication state — migration 010 |
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
