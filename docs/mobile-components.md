# Mobile App Components

Component inventory for `apps/mobile/components/`. Organized by atomic design level.

## Atoms (8)

| Component | Import | Props |
|-----------|--------|-------|
| BiasTag | `@/components/atoms/BiasTag` | `bias: BiasCategory`, `compact?: boolean` |
| BlindspotBadge | `@/components/atoms/BlindspotBadge` | (none) |
| BookmarkButton | `@/components/atoms/BookmarkButton` | `isSaved: boolean`, `onPress: () => void` |
| CoverageCount | `@/components/atoms/CoverageCount` | `count: number` |
| FactualityDots | `@/components/atoms/FactualityDots` | `level: FactualityLevel`, `size?: number` |
| OfflineIndicator | `@/components/atoms/OfflineIndicator` | (none) |
| ShareButton | `@/components/atoms/ShareButton` | `url: string`, `title: string`, `size?: number` |
| Skeleton | `@/components/atoms/Skeleton` | `style?: ViewStyle` |

## Molecules (8)

| Component | Import | Props |
|-----------|--------|-------|
| BiasComparisonBar | `@/components/molecules/BiasComparisonBar` | `userDistribution`, `overallDistribution` |
| BiasLegend | `@/components/molecules/BiasLegend` | (none) |
| EmptyStateView | `@/components/molecules/EmptyStateView` | `message: string` |
| ForYouCta | `@/components/molecules/ForYouCta` | `onDismiss: () => void` |
| MonochromeSpectrumBar | `@/components/molecules/MonochromeSpectrumBar` | `segments: SpectrumSegment[]`, `height?: number` |
| NetworkErrorView | `@/components/molecules/NetworkErrorView` | `onRetry: () => void` |
| SourceList | `@/components/molecules/SourceList` | `sources: NewsSource[]` |
| SpectrumBar | `@/components/molecules/SpectrumBar` | `segments: SpectrumSegment[]`, `height?: number`, `showLabels?: boolean` |

## Organisms (11)

| Component | Import | Props |
|-----------|--------|-------|
| AISummaryTabs | `@/components/organisms/AISummaryTabs` | `summary: AISummary` |
| CoverageIntelligence | `@/components/organisms/CoverageIntelligence` | `article: NewsArticle`, `timeline` |
| FeedTabs | `@/components/organisms/FeedTabs` | `value: FeedTab`, `onChange`, `savedCount?`, `blindspotCount?` |
| HeroCard | `@/components/organisms/HeroCard` | `article`, `onClick`, `onSave`, `isSaved`, `isRead?` |
| NexusCard | `@/components/organisms/NexusCard` | `article`, `onClick`, `onSave`, `isSaved`, `isRead?`, `compact?` |
| NexusCardSkeleton | `@/components/organisms/NexusCardSkeleton` | `compact?: boolean` |
| SearchBar | `@/components/organisms/SearchBar` | `value`, `onChange`, `onClear`, `placeholder?` |
| SearchFilters | `@/components/organisms/SearchFilters` | Filter state + onChange callbacks |
| StickyFilterBar | `@/components/organisms/StickyFilterBar` | Active filters + onClear callbacks |
| StoryTimeline | `@/components/organisms/StoryTimeline` | `timeline: StoryTimeline` |
| TopicPills | `@/components/organisms/TopicPills` | `selected: Topic \| null`, `onChange` |

## UI (1)

| Component | Import | Description |
|-----------|--------|-------------|
| GlassView | `@/components/ui/GlassView` | Frosted glass surface (expo-blur). Variants: `default` (24px radius), `sm` (12px), `pill` (full round). Falls back to semi-transparent bg on Android. |

## Design Tokens

Shared design constants at `lib/shared/design.ts`:

| Token | Values |
|-------|--------|
| `SPACING` | xs=4, sm=8, md=12, lg=16, xl=20, xxl=24 |
| `TEXT_OPACITY` | primary=1, secondary=0.6, tertiary=0.4, muted=0.35 |
| `GLASS` | bg, bgSm, bgPill surface colors + border colors |
| `ACCENT` | amber (#f59e0b), amberBg, amberBorder, red (#ef4444) |
| `BADGE` | paddingH=10, paddingV=4, fontSize=11, borderRadius=9999 |
| `FONT` | headline, headlineLg, body, caption, small, tiny |
