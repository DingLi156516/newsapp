/**
 * Shared TypeScript types and lookup tables.
 * Copied from web app lib/types.ts (minus DB re-exports).
 */

// ---------------------------------------------------------------------------
// Domain union types
// ---------------------------------------------------------------------------

export type BiasCategory =
  | 'far-left'
  | 'left'
  | 'lean-left'
  | 'center'
  | 'lean-right'
  | 'right'
  | 'far-right'

export type FactualityLevel =
  | 'very-high'
  | 'high'
  | 'mixed'
  | 'low'
  | 'very-low'

export type OwnershipType =
  | 'independent'
  | 'corporate'
  | 'private-equity'
  | 'state-funded'
  | 'telecom'
  | 'government'
  | 'non-profit'
  | 'other'

export type Topic =
  | 'politics'
  | 'world'
  | 'technology'
  | 'business'
  | 'science'
  | 'health'
  | 'culture'
  | 'sports'
  | 'environment'

export type PerspectiveFilter = 'all' | 'left' | 'center' | 'right'

export type Region = 'us' | 'international' | 'uk' | 'canada' | 'europe'

export type FeedTab = 'for-you' | 'trending' | 'latest' | 'blindspot'

export type FeedSort = 'most-covered' | 'most-recent'

export const FEED_SORT_LABELS: Record<FeedSort, string> = {
  'most-covered': 'Most Covered',
  'most-recent': 'Most Recent',
}

export const PERSPECTIVE_LABELS: Record<PerspectiveFilter, string> = {
  all: 'All Perspectives',
  left: 'Left-Leaning',
  center: 'Center',
  right: 'Right-Leaning',
}

// ---------------------------------------------------------------------------
// Unified feed tabs
// ---------------------------------------------------------------------------

export type UnifiedTab = FeedTab | Topic

export const FEED_TAB_LABELS: Record<FeedTab, string> = {
  'for-you': 'For You',
  'trending': 'Trending',
  'latest': 'Latest',
  'blindspot': 'Blindspot',
}

export const ALL_FEED_TABS: readonly FeedTab[] = ['for-you', 'trending', 'latest', 'blindspot']

export const ALL_TOPICS: readonly Topic[] = [
  'politics', 'world', 'technology', 'business',
  'science', 'health', 'culture', 'sports', 'environment',
]

export const DEFAULT_VISIBLE_FEEDS: readonly UnifiedTab[] = [
  'for-you', 'trending', 'latest', 'politics', 'technology', 'world',
]

export function isFeedTab(tab: UnifiedTab): tab is FeedTab {
  return (ALL_FEED_TABS as readonly string[]).includes(tab)
}

export function isTopicTab(tab: UnifiedTab): tab is Topic {
  return !isFeedTab(tab)
}

export function getUnifiedTabLabel(tab: UnifiedTab): string {
  return isFeedTab(tab) ? FEED_TAB_LABELS[tab] : TOPIC_LABELS[tab]
}

// ---------------------------------------------------------------------------
// Data model interfaces
// ---------------------------------------------------------------------------

export interface SpectrumSegment {
  bias: BiasCategory
  percentage: number
}

export interface AISummary {
  commonGround: string
  leftFraming: string
  rightFraming: string
}

export interface NewsSource {
  id: string
  name: string
  bias: BiasCategory
  factuality: FactualityLevel
  ownership: OwnershipType
  url?: string
  articleUrl?: string
}

// ---------------------------------------------------------------------------
// Enrichment types
// ---------------------------------------------------------------------------

export type SentimentLabel = 'angry' | 'fearful' | 'hopeful' | 'neutral' | 'critical' | 'celebratory'

export type NarrativePhase = 'breaking' | 'developing' | 'analysis' | 'aftermath'

export type TagType = 'person' | 'organization' | 'location' | 'event' | 'topic'

export interface StoryVelocity {
  readonly articles_24h: number
  readonly articles_48h: number
  readonly articles_7d: number
  readonly phase: NarrativePhase
}

export interface StorySentiment {
  readonly left: SentimentLabel
  readonly right: SentimentLabel
}

export interface KeyQuote {
  readonly text: string
  readonly sourceName: string
  readonly sourceBias: string
}

export interface KeyClaim {
  readonly claim: string
  readonly side: 'left' | 'right' | 'both'
  readonly disputed: boolean
  readonly counterClaim?: string
}

export interface HeadlineComparison {
  readonly title: string
  readonly sourceName: string
  readonly sourceBias: string
}

export interface StoryTag {
  readonly slug: string
  readonly label: string
  readonly type: TagType
  readonly storyCount: number
  readonly relevance?: number
}

// ---------------------------------------------------------------------------
// Main article interface
// ---------------------------------------------------------------------------

export interface NewsArticle {
  id: string
  headline: string
  topic: Topic
  sourceCount: number
  isBlindspot: boolean
  imageUrl: string | null
  factuality: FactualityLevel
  ownership: OwnershipType
  sources: NewsSource[]
  spectrumSegments: SpectrumSegment[]
  aiSummary: AISummary
  timestamp: string
  region: Region
  storyVelocity?: StoryVelocity | null
  impactScore?: number | null
  sourceDiversity?: number | null
  controversyScore?: number | null
  sentiment?: StorySentiment | null
  keyQuotes?: KeyQuote[] | null
  keyClaims?: KeyClaim[] | null
  headlines?: HeadlineComparison[]
  tags?: StoryTag[]
}

// ---------------------------------------------------------------------------
// Display label lookup tables
// ---------------------------------------------------------------------------

export const ALL_BIASES: BiasCategory[] = [
  'far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right',
]

export const PERSPECTIVE_BIASES: Record<PerspectiveFilter, readonly BiasCategory[]> = {
  all: ALL_BIASES,
  left: ['far-left', 'left', 'lean-left'],
  center: ['center'],
  right: ['lean-right', 'right', 'far-right'],
}

export const BIAS_LABELS: Record<BiasCategory, string> = {
  'far-left': 'Far Left',
  'left': 'Left',
  'lean-left': 'Lean Left',
  'center': 'Center',
  'lean-right': 'Lean Right',
  'right': 'Right',
  'far-right': 'Far Right',
}

/** Maps bias categories to spectrum opacity values (0-1) for RN styling. */
export const BIAS_OPACITY: Record<BiasCategory, number> = {
  'far-left': 0.85,
  'left': 0.65,
  'lean-left': 0.45,
  'center': 0.20,
  'lean-right': 0.12,
  'right': 0.06,
  'far-right': 0.03,
}

/** Maps each bias category to a distinct color — blue gradient (left) → gray (center) → red gradient (right). */
export const BIAS_COLOR: Record<BiasCategory, string> = {
  'far-left': '#3B82F6',
  'left': '#60A5FA',
  'lean-left': '#93C5FD',
  'center': '#A1A1AA',
  'lean-right': '#FCA5A5',
  'right': '#F87171',
  'far-right': '#EF4444',
}

/** Grouped spectrum colors for 3-group display. */
export const BIAS_GROUP_COLOR = {
  left: '#60A5FA',
  center: '#A1A1AA',
  right: '#F87171',
} as const

/** Aggregated spectrum group for 3-group display. */
export interface SpectrumGroup {
  readonly label: string
  readonly percentage: number
  readonly color: string
}

/** Aggregates 7 bias segments into 3 groups (Left/Center/Right). */
export function groupSpectrumSegments(segments: readonly SpectrumSegment[]): SpectrumGroup[] {
  let left = 0
  let center = 0
  let right = 0
  for (const s of segments) {
    if (s.bias === 'far-left' || s.bias === 'left' || s.bias === 'lean-left') {
      left += s.percentage
    } else if (s.bias === 'center') {
      center += s.percentage
    } else {
      right += s.percentage
    }
  }
  return [
    { label: 'Left', percentage: Math.round(left), color: BIAS_GROUP_COLOR.left },
    { label: 'Center', percentage: Math.round(center), color: BIAS_GROUP_COLOR.center },
    { label: 'Right', percentage: Math.round(right), color: BIAS_GROUP_COLOR.right },
  ]
}

export const FACTUALITY_LABELS: Record<FactualityLevel, string> = {
  'very-high': 'Very High Factuality',
  'high': 'High Factuality',
  'mixed': 'Mixed Factuality',
  'low': 'Low Factuality',
  'very-low': 'Very Low Factuality',
}

export const OWNERSHIP_LABELS: Record<OwnershipType, string> = {
  'independent': 'Independent',
  'corporate': 'Corporate',
  'private-equity': 'Private Equity',
  'state-funded': 'State-Funded',
  'telecom': 'Telecom',
  'government': 'Government',
  'non-profit': 'Non-Profit',
  'other': 'Other',
}

export const TOPIC_LABELS: Record<Topic, string> = {
  'politics': 'Politics',
  'world': 'World',
  'technology': 'Technology',
  'business': 'Business',
  'science': 'Science',
  'health': 'Health',
  'culture': 'Culture',
  'sports': 'Sports',
  'environment': 'Environment',
}

// ---------------------------------------------------------------------------
// Search & filter types
// ---------------------------------------------------------------------------

export type DatePreset = '24h' | '7d' | '30d' | 'all'

export const FACTUALITY_RANK: Record<FactualityLevel, number> = {
  'very-low': 0, 'low': 1, 'mixed': 2, 'high': 3, 'very-high': 4,
}

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  '24h': '24 Hours', '7d': '7 Days', '30d': '30 Days', 'all': 'All Time',
}

// ---------------------------------------------------------------------------
// Timeline types
// ---------------------------------------------------------------------------

export type TimelineEventKind = 'source-added' | 'spectrum-shift' | 'milestone'

export interface TimelineEvent {
  readonly id: string
  readonly timestamp: string
  readonly kind: TimelineEventKind
  readonly sourceName: string
  readonly sourceBias: BiasCategory
  readonly description: string
  readonly cumulativeSourceCount: number
  readonly cumulativeSpectrum: SpectrumSegment[]
}

export interface StoryTimeline {
  readonly storyId: string
  readonly events: readonly TimelineEvent[]
  readonly totalArticles: number
  readonly timeSpanHours: number
}

// ---------------------------------------------------------------------------
// Review types
// ---------------------------------------------------------------------------

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  'pending': 'Pending',
  'approved': 'Approved',
  'rejected': 'Rejected',
}

export const REGION_LABELS: Record<Region, string> = {
  'us': 'United States',
  'international': 'International',
  'uk': 'United Kingdom',
  'canada': 'Canada',
  'europe': 'Europe',
}

export const ALL_REGIONS: Region[] = ['us', 'international', 'uk', 'canada', 'europe']

export const ALL_FACTUALITIES: FactualityLevel[] = [
  'very-high', 'high', 'mixed', 'low', 'very-low',
]

export const ALL_OWNERSHIPS: OwnershipType[] = [
  'independent', 'corporate', 'non-profit', 'state-funded',
  'private-equity', 'telecom', 'government', 'other',
]

// ---------------------------------------------------------------------------
// Enrichment display lookup tables
// ---------------------------------------------------------------------------

export const SENTIMENT_EMOJI: Record<SentimentLabel, string> = {
  angry: '\u{1F620}', fearful: '\u{1F628}', hopeful: '\u{1F31F}',
  neutral: '\u{1F610}', critical: '\u{1F50D}', celebratory: '\u{1F389}',
}

export const SENTIMENT_LABELS: Record<SentimentLabel, string> = {
  angry: 'Angry', fearful: 'Fearful', hopeful: 'Hopeful',
  neutral: 'Neutral', critical: 'Critical', celebratory: 'Celebratory',
}

export const PHASE_LABELS: Record<NarrativePhase, string> = {
  breaking: 'Breaking', developing: 'Developing', analysis: 'Analysis', aftermath: 'Aftermath',
}

export const PHASE_COLORS: Record<NarrativePhase, string> = {
  breaking: '#EF4444', developing: '#F59E0B', analysis: '#3B82F6', aftermath: '#6B7280',
}

export const TAG_TYPE_COLORS: Record<TagType, string> = {
  person: '#8B5CF6', organization: '#3B82F6', location: '#10B981', event: '#F59E0B', topic: '#6B7280',
}
