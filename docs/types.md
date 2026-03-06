# Data Types (Quick Reference)

All types live in `@/lib/types`:

- `BiasCategory`: `'far-left' | 'left' | 'lean-left' | 'center' | 'lean-right' | 'right' | 'far-right'`
- `FactualityLevel`: `'very-high' | 'high' | 'mixed' | 'low' | 'very-low'`
- `OwnershipType`: `'independent' | 'corporate' | 'private-equity' | 'state-funded' | 'telecom' | 'government' | 'non-profit' | 'other'`
- `Topic`: 9 values (`'politics' | 'world' | 'technology' | ...`)
- `Region`: `'us' | 'international' | 'uk' | 'canada' | 'europe'` (used by DB types; UI region filter removed — see F-08 in PRD)
- `FeedTab`: `'for-you' | 'trending' | 'latest' | 'blindspot' | 'saved'`
- `PerspectiveFilter`: `'all' | 'left' | 'center' | 'right'` (UI-only — drives `biasRange` param, not sent to API directly)
- `DatePreset`: `'24h' | '7d' | '30d' | 'all'`
- `ReviewStatus`: `'pending' | 'approved' | 'rejected'`

Label/class maps: `BIAS_LABELS`, `BIAS_CSS_CLASS`, `FACTUALITY_LABELS`, `OWNERSHIP_LABELS`, `TOPIC_LABELS`, `DATE_PRESET_LABELS`

Constants: `FACTUALITY_RANK` — factuality level ordering for min threshold filtering; `PERSPECTIVE_BIASES` — maps PerspectiveFilter values to BiasCategory arrays for client-side bias range conversion; `REVIEW_STATUS_LABELS` — maps ReviewStatus to display labels (e.g., `'pending'` → `'Pending Review'`)

Sample data: `sampleArticles` (6 items), `sampleSources` (15 items) in `@/lib/sample-data`

DB schema types (`DbSource`, `DbStory`, `DbArticle`, and their `Insert` variants) live in
`@/lib/supabase/types` and are re-exported from `@/lib/types` for convenience.

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
- `DbUserPreferences` / `DbUserPreferencesInsert`: user_id, followed_topics, default_region, default_perspective, factuality_minimum
- `DbAdminUser`: user_id, role, created_at

## Review Types (`@/lib/api/review-validation`, `@/lib/api/review-queries`)

- `ReviewStatus`: `'pending' | 'approved' | 'rejected'`
- `ReviewAction`: `{ status: ReviewStatus, reason?: string }` (from `reviewActionSchema`)
- `ReviewStats`: `{ pending: number, approved: number, rejected: number, total: number }`
