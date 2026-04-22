# Component Inventory

## Atoms (`components/atoms/`)

| Component | Import |
|-----------|--------|
| `FactualityDots` | `@/components/atoms/FactualityDots` |
| `BiasTag` | `@/components/atoms/BiasTag` |
| `CoverageCount` | `@/components/atoms/CoverageCount` |
| `BlindspotBadge` | `@/components/atoms/BlindspotBadge` |
| `BookmarkButton` | `@/components/atoms/BookmarkButton` |
| `Skeleton` | `@/components/atoms/Skeleton` |
| `ReviewStatusBadge` | `@/components/atoms/ReviewStatusBadge` — Colored badge showing review status (pending/approved/rejected) |
| `OfflineIndicator` | `@/components/atoms/OfflineIndicator` — Shows offline/online connectivity status |
| `ShareButton` | `@/components/atoms/ShareButton` — Native Web Share API on mobile, clipboard + Toast fallback on desktop |
| `Toast` | `@/components/atoms/Toast` — Ephemeral notification toast with auto-dismiss |

## Molecules (`components/molecules/`)

| Component | Import |
|-----------|--------|
| `MonochromeSpectrumBar` | `@/components/molecules/MonochromeSpectrumBar` |
| `BiasLegend` | `@/components/molecules/BiasLegend` |
| `SourceList` | `@/components/molecules/SourceList` |
| `BiasComparisonBar` | `@/components/molecules/BiasComparisonBar` |
| `StatsRow` | `@/components/molecules/StatsRow` |
| `MetricsRow` | `@/components/molecules/MetricsRow` — Compact inline chips for impact / 24h velocity / source diversity. Rendered by `NexusCard` and `HeroCard` when `showMetrics` is true (e.g. Trending feed). |
| `ForYouCta` | `@/components/molecules/ForYouCta` |
| `ReviewListItem` | `@/components/molecules/ReviewListItem` — Row in the review queue showing headline, status badge, topic, source count |
| `ReviewDetail` | `@/components/molecules/ReviewDetail` — Expanded detail panel for reviewing AI summary, spectrum, and blindspot data |
| `AdminSourceListItem` | `@/components/molecules/AdminSourceListItem` — Single row in admin source list showing name, bias badge, region, active status, and health indicators |
| `OwnershipBar` | `@/components/molecules/OwnershipBar` — Horizontal segmented bar showing proportional source ownership for a story; colors segments by `OwnerType` and trails an unknown slice |
| `RoutingPreviewPanel` | `@/components/molecules/RoutingPreviewPanel` — Admin routing-preview panel inside `ReviewDetail`; shows chosen assembly path (rich/single/thin), source count, distinct bias buckets, and applied thresholds via `useRoutingPreview` |
| `ActiveOwnerChip` | `@/components/molecules/ActiveOwnerChip` — Visible pill rendered on the home feed when `?owner=…` is set; shows a title-cased display of the slug (fallback) or an explicit `displayName`, with an × to clear. Exports `formatOwnerSlugForDisplay` helper. |

## Organisms (`components/organisms/`)

| Component | Import |
|-----------|--------|
| `NexusCard` | `@/components/organisms/NexusCard` |
| `FeedTabs` | `@/components/organisms/FeedTabs` |
| `TopicPills` | `@/components/organisms/TopicPills` |
| `SearchBar` | `@/components/organisms/SearchBar` |
| `SearchFilters` | `@/components/organisms/SearchFilters` — Topic, bias range, factuality, date range, and perspective preset filters (expandable panel) |
| `AISummaryTabs` | `@/components/organisms/AISummaryTabs` |
| `NexusCardSkeleton`, `NexusCardSkeletonList` | `@/components/organisms/NexusCardSkeleton` |
| `StoryTimeline` | `@/components/organisms/StoryTimeline` |
| `AuthForm` | `@/components/organisms/AuthForm` |
| `UserMenu` | `@/components/organisms/UserMenu` |
| `HeroCard` | `@/components/organisms/HeroCard` |
| `ViewSwitcher` | `@/components/organisms/ViewSwitcher` — Inline pill tab switcher (Feed / Sources) that lives in the page header; controlled via `view` + `onChange` props; animates active tab with Framer Motion `layoutId="view-switcher-pill"` |
| `SourcesView` | `@/components/organisms/SourcesView` — Self-contained sources directory view with search, multi-select filters (bias/factuality/ownership/region), and source card grid; rendered inline on the home page when view=sources |
| `BiasProfileChart` | `@/components/organisms/BiasProfileChart` |
| `SettingsForm` | `@/components/organisms/SettingsForm` |
| `StickyFilterBar` | `@/components/organisms/StickyFilterBar` — FeedTabs (view-mode controls, always visible) |
| `SuggestionsList` | `@/components/organisms/SuggestionsList` |
| `ReviewQueue` | `@/components/organisms/ReviewQueue` — Full review queue page component with status filter tabs, list, and detail panel |
| `CoverageIntelligence` | `@/components/organisms/CoverageIntelligence` — Story detail analysis panel with coverage momentum, coverage gaps, framing delta, methodology, and ownership context |
| `OwnershipSummary` | `@/components/organisms/OwnershipSummary` — Above-the-fold story-detail block announcing dominant owners and rendering `OwnershipBar`; returns null when <3 sources or no known owners |
| `SourceDirectoryInsights` | `@/components/organisms/SourceDirectoryInsights` — Summary card for the current source-directory result set, including source count, leading ownership type, and represented regions |
| `PipelineControls` | `@/components/organisms/PipelineControls` — Admin pipeline control panel with manual ingest/process triggers |
| `PipelineRunHistory` | `@/components/organisms/PipelineRunHistory` — Inline run metrics with backlog deltas and per-stage skip/pass diagnostics |
| `PipelineSummaryStats` | `@/components/organisms/PipelineSummaryStats` — Live DB counts (published, articles, review, unembedded, unclustered) for pipeline admin |
| `SourceHealthTable` | `@/components/organisms/SourceHealthTable` — Source health monitoring table for pipeline admin dashboard |
| `PipelineEventsPanel` | `@/components/organisms/PipelineEventsPanel` — Stage event drill-down with runId / stage / level filters and JSON payload modal; reads `GET /api/admin/pipeline/events` |
| `SourceAdminManager` | `@/components/organisms/SourceAdminManager` — Main orchestrator for admin sources split-panel (list + detail/create/import) |
| `AdminSourceList` | `@/components/organisms/AdminSourceList` — Left panel: search, filter pills, paginated source list with action buttons |
| `AdminSourceDetail` | `@/components/organisms/AdminSourceDetail` — Right panel: view/edit source with health metrics and form fields |
| `AdminSourceCreate` | `@/components/organisms/AdminSourceCreate` — Right panel: new source form with RSS auto-discovery |
| `AdminSourceImport` | `@/components/organisms/AdminSourceImport` — Right panel: CSV upload → preview → import flow |
| `HeadlineRoundup` | `@/components/organisms/HeadlineRoundup` — AllSides-style L/C/R headline roundup on story detail; picks one representative headline per side via `lib/utils/headline-roundup`, hides empty columns, returns null when fewer than 2 sides have a headline |
| `BiasDriftChart` | `@/components/organisms/BiasDriftChart` — Per-story bias drift over time; stacked-spectrum bar per timeline event rendering `cumulativeSpectrum` from the existing story timeline payload (no new endpoint); dedupes events, floors elapsed-time labels, and shows a truncation note when `article.sourceCount` exceeds the last drift row (drift weighting is per-unique-source, so no synthetic "now" bar is fabricated from `article.spectrumSegments`); returns null for <3 distinct events |

## Pages (`components/pages/`)

| Component | Import |
|-----------|--------|
| `SourceProfilePage` | `@/components/pages/SourceProfilePage` — Source detail page shell for snapshot metadata, recent coverage, topic mix, and methodology |
| `SourceComparisonPage` | `@/components/pages/SourceComparisonPage` — Outlet-vs-outlet comparison page shell with a second-source picker, shared coverage, coverage gaps, and methodology |
| `OwnerProfilePage` | `@/components/pages/OwnerProfilePage` — Owner detail page shell for owner snapshot, controlled sources grid, bias distribution, topic mix, recent 180-day coverage, and methodology |
