/**
 * lib/types.ts — Shared TypeScript types and lookup tables for the entire app.
 *
 * This file is the single source of truth for all domain types.
 * Think of it like your backend's DTOs/enums combined with utility constants.
 * No business logic lives here — only type definitions and human-readable labels.
 */

// ---------------------------------------------------------------------------
// Domain union types
// ---------------------------------------------------------------------------

/**
 * Political bias classification for a news source or article, ranging from
 * far-left to far-right. Used to color-code the spectrum bar on article cards.
 */
export type BiasCategory =
  | 'far-left'
  | 'left'
  | 'lean-left'
  | 'center'
  | 'lean-right'
  | 'right'
  | 'far-right'

/**
 * How factual/reliable a source is rated (sourced from organizations like
 * Media Bias/Fact Check). Displayed as filled dots (1–5) in the UI.
 */
export type FactualityLevel =
  | 'very-high'
  | 'high'
  | 'mixed'
  | 'low'
  | 'very-low'

/**
 * Who owns or funds a news source. Affects credibility interpretation —
 * e.g., state-funded sources may have government editorial influence.
 */
export type OwnershipType =
  | 'independent'
  | 'corporate'
  | 'private-equity'
  | 'state-funded'
  | 'telecom'
  | 'government'
  | 'non-profit'
  | 'other'

/**
 * Structural ownership type for the media_owners entity (migration 048).
 * Distinct from OwnershipType which is a broad funding/influence category.
 */
export type OwnerType =
  | 'public_company'
  | 'private_company'
  | 'cooperative'
  | 'public_broadcaster'
  | 'trust'
  | 'individual'
  | 'state_adjacent'
  | 'nonprofit'

/** All owner types as an array, for iteration and validation. */
export const ALL_OWNER_TYPES: OwnerType[] = [
  'public_company', 'private_company', 'cooperative', 'public_broadcaster',
  'trust', 'individual', 'state_adjacent', 'nonprofit',
]

/** Human-readable labels for OwnerType, displayed in owner badges. */
export const OWNER_TYPE_LABELS: Record<OwnerType, string> = {
  'public_company': 'Public Company',
  'private_company': 'Private Company',
  'cooperative': 'Cooperative',
  'public_broadcaster': 'Public Broadcaster',
  'trust': 'Trust',
  'individual': 'Individual',
  'state_adjacent': 'State-Adjacent',
  'nonprofit': 'Nonprofit',
}

/** A specific media owner entity (e.g., "Fox Corporation"). */
export interface MediaOwner {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly ownerType: OwnerType
  readonly isIndividual: boolean
  readonly country: string | null
  readonly wikidataQid: string | null
  readonly ownerSource: 'wikidata' | 'manual'
  readonly ownerVerifiedAt: string
  readonly sourceCount?: number
}

/** Top-level category for classifying an article's subject matter. */
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

/**
 * Which side of the political spectrum to filter the news feed by.
 * 'all' means no filtering — left/center/right restricts to articles
 * whose dominant spectrum segment falls in that range.
 */
export type PerspectiveFilter = 'all' | 'left' | 'center' | 'right'

/** Geographic region filter for the news feed. */
export type Region = 'us' | 'international' | 'uk' | 'canada' | 'europe'

/**
 * The four main feed views available in the top tab bar:
 * - trending: default feed (no special sort)
 * - latest: articles sorted by newest timestamp
 * - blindspot: only articles flagged as coverage-skewed
 * - saved: articles the user has bookmarked (stored in local React state)
 */
export type FeedTab = 'for-you' | 'trending' | 'latest' | 'blindspot' | 'saved'
export type StoryKind = 'standard'

/** Entity tag type for classifying extracted entities. */
export type TagType = 'person' | 'organization' | 'location' | 'event' | 'topic'

/** An entity tag associated with a story (person, org, location, event, topic). */
export interface StoryTag {
  readonly slug: string
  readonly label: string
  readonly type: TagType
  readonly relevance: number
  readonly storyCount: number
  readonly description?: string
}

// ---------------------------------------------------------------------------
// Data model interfaces
// ---------------------------------------------------------------------------

/**
 * One segment of the political spectrum bar.
 * The bar is made up of multiple segments whose percentages sum to ~100.
 * E.g., { bias: 'left', percentage: 22 } means 22% of covering sources lean left.
 */
export interface SpectrumSegment {
  bias: BiasCategory
  percentage: number
}

/**
 * AI-generated cross-spectrum summary for an article, broken into three
 * perspectives. In production this would come from an LLM (e.g., GPT-4).
 * Each field is a newline-separated bullet list string.
 */
export interface AISummary {
  commonGround: string  // Facts agreed upon across the political spectrum
  leftFraming: string   // How left-leaning outlets frame/interpret the story
  rightFraming: string  // How right-leaning outlets frame/interpret the story
}

// ---------------------------------------------------------------------------
// Story enrichment types (data intelligence layer)
// ---------------------------------------------------------------------------

/** Sentiment label for political framing analysis. */
export type SentimentLabel =
  | 'angry'
  | 'fearful'
  | 'hopeful'
  | 'neutral'
  | 'critical'
  | 'celebratory'

/** Narrative phase derived from article velocity. */
export type NarrativePhase = 'breaking' | 'developing' | 'analysis' | 'aftermath'

/** Story velocity metrics computed from article timestamps. */
export interface StoryVelocity {
  readonly articles_24h: number
  readonly articles_48h: number
  readonly articles_7d: number
  readonly phase: NarrativePhase
}

/** Left/right sentiment derived from AI summary analysis. */
export interface StorySentiment {
  readonly left: SentimentLabel
  readonly right: SentimentLabel
}

/** A notable quote extracted from article coverage. */
export interface KeyQuote {
  readonly text: string
  readonly sourceName: string
  readonly sourceBias: string
}

/** A factual claim identified across coverage, with dispute tracking. */
export interface KeyClaim {
  readonly claim: string
  readonly side: 'left' | 'right' | 'both'
  readonly disputed: boolean
  readonly counterClaim?: string
}

/** Headline comparison entry showing how different outlets title the same story. */
export interface HeadlineComparison {
  readonly title: string
  readonly sourceName: string
  readonly sourceBias: BiasCategory
}

/**
 * A single news outlet that covered a story.
 * Analogous to a "Source" record in your backend DB.
 */
export interface NewsSource {
  id: string
  slug?: string
  name: string
  bias: BiasCategory
  factuality: FactualityLevel
  ownership: OwnershipType
  region: Region
  url?: string        // Root domain without protocol, e.g. "bbc.com"
  articleUrl?: string  // Direct URL to the specific article on this source
  totalArticlesIngested?: number
  owner?: MediaOwner   // Specific media owner entity (Phase 9B)
}

export interface SourceProfileSource extends NewsSource {
  slug: string
  rssUrl?: string
  isActive: boolean
}

export interface SourceProfileStory {
  id: string
  headline: string
  topic: Topic
  region: Region
  timestamp: string
  isBlindspot: boolean
  articleUrl?: string
}

export interface SourceTopicBreakdownItem {
  topic: Topic
  count: number
}

export interface SourceProfile {
  source: SourceProfileSource
  recentStories: SourceProfileStory[]
  topicBreakdown: SourceTopicBreakdownItem[]
  blindspotCount: number
}

export interface SourceComparisonTopicCount {
  topic: Topic
  leftCount: number
  rightCount: number
}

export interface SourceComparisonStats {
  sharedStoryCount: number
  leftExclusiveCount: number
  rightExclusiveCount: number
  leftBlindspotCount: number
  rightBlindspotCount: number
  overlappingTopics: SourceComparisonTopicCount[]
  topicImbalances: SourceComparisonTopicCount[]
}

export interface SourceComparison {
  leftSource: SourceProfileSource
  rightSource: SourceProfileSource
  sharedStories: SourceProfileStory[]
  leftExclusiveStories: SourceProfileStory[]
  rightExclusiveStories: SourceProfileStory[]
  stats: SourceComparisonStats
}

/**
 * The core data model — one news story as aggregated from multiple outlets.
 * In a production system this would be populated by a backend pipeline that:
 *   1. Clusters articles about the same event
 *   2. Scores each source's bias/factuality
 *   3. Generates the AI summary via LLM
 *   4. Computes spectrum segment percentages
 *
 * In the current static prototype, these come from `lib/sample-data.ts`.
 */
export interface NewsArticle {
  id: string
  headline: string
  topic: Topic
  sourceCount: number          // Total number of outlets covering the story
  isBlindspot: boolean         // True when coverage is >80% skewed to one side
  imageUrl: string | null      // Hero image URL (null when DB has no image)
  factuality: FactualityLevel  // Aggregate factuality of the story's sources
  ownership: OwnershipType     // Dominant ownership type among sources
  sources: NewsSource[]        // Subset of outlets shown in the source list
  spectrumSegments: SpectrumSegment[]  // Drives the color bar on each card
  aiSummary: AISummary
  timestamp: string            // ISO 8601 datetime string
  region: Region
  tags?: StoryTag[]            // Entity tags extracted by AI
  storyVelocity?: StoryVelocity | null
  impactScore?: number | null
  sourceDiversity?: number | null
  controversyScore?: number | null
  sentiment?: StorySentiment | null
  keyQuotes?: KeyQuote[] | null
  keyClaims?: KeyClaim[] | null
  headlines?: HeadlineComparison[]
  /**
   * True when the `media_owners` enrichment lookup failed during this
   * request. The story payload is still valid; `source.owner` will be
   * absent for all sources even if some have `owner_id` in the DB. UI can
   * render a small "ownership data temporarily unavailable" hint instead
   * of misleading "no known owners" empty state.
   */
  ownershipUnavailable?: boolean
}

/** All tag types as an array, for iteration and validation. */
export const ALL_TAG_TYPES: TagType[] = [
  'person', 'organization', 'location', 'event', 'topic',
]

/** Human-readable labels for TagType, displayed in tag pills. */
export const TAG_TYPE_LABELS: Record<TagType, string> = {
  'person': 'Person',
  'organization': 'Organization',
  'location': 'Location',
  'event': 'Event',
  'topic': 'Topic',
}

/** Colors for each tag type, used in tag pill accents. */
export const TAG_TYPE_COLORS: Record<TagType, string> = {
  person: '#8B5CF6',
  organization: '#3B82F6',
  location: '#10B981',
  event: '#F59E0B',
  topic: '#6B7280',
}

// ---------------------------------------------------------------------------
// Display label lookup tables
// The Record<EnumType, string> pattern maps every enum value to a UI label,
// giving you a compile-time guarantee that no value is left unmapped.
// ---------------------------------------------------------------------------

/** All bias categories as an array, for iteration and validation. */
export const ALL_BIASES: BiasCategory[] = [
  'far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right',
]

/** All factuality levels as an array, for iteration and validation. */
export const ALL_FACTUALITIES: FactualityLevel[] = [
  'very-high', 'high', 'mixed', 'low', 'very-low',
]

/** All ownership types as an array, for iteration and validation. */
export const ALL_OWNERSHIPS: OwnershipType[] = [
  'independent', 'corporate', 'non-profit', 'state-funded',
  'private-equity', 'telecom', 'government', 'other',
]

/** Bias categories for each perspective preset (All/Left/Center/Right). */
export const PERSPECTIVE_BIASES: Record<PerspectiveFilter, readonly BiasCategory[]> = {
  all: ALL_BIASES,
  left: ['far-left', 'left', 'lean-left'],
  center: ['center'],
  right: ['lean-right', 'right', 'far-right'],
}

/** Human-readable labels for BiasCategory, used in tooltips and the legend. */
export const BIAS_LABELS: Record<BiasCategory, string> = {
  'far-left': 'Far Left',
  'left': 'Left',
  'lean-left': 'Lean Left',
  'center': 'Center',
  'lean-right': 'Lean Right',
  'right': 'Right',
  'far-right': 'Far Right',
}

/**
 * Tailwind/CSS class names that apply the color for each bias tier.
 * These classes are defined in globals.css and apply a CSS background color.
 * The pattern avoids string interpolation of dynamic class names, which
 * Tailwind's purge/JIT cannot statically analyze.
 */
export const BIAS_CSS_CLASS: Record<BiasCategory, string> = {
  'far-left': 'spectrum-far-left',
  'left': 'spectrum-left',
  'lean-left': 'spectrum-lean-left',
  'center': 'spectrum-center',
  'lean-right': 'spectrum-lean-right',
  'right': 'spectrum-right',
  'far-right': 'spectrum-far-right',
}

export const BIAS_COLOR: Record<BiasCategory, string> = {
  'far-left': '#3B82F6',
  'left': '#60A5FA',
  'lean-left': '#93C5FD',
  'center': '#A1A1AA',
  'lean-right': '#FCA5A5',
  'right': '#F87171',
  'far-right': '#EF4444',
}

/** Human-readable labels for FactualityLevel, used in tooltips and filters. */
export const FACTUALITY_LABELS: Record<FactualityLevel, string> = {
  'very-high': 'Very High Factuality',
  'high': 'High Factuality',
  'mixed': 'Mixed Factuality',
  'low': 'Low Factuality',
  'very-low': 'Very Low Factuality',
}

/** Color, background, border, and fill percentage for each factuality level. */
export const FACTUALITY = {
  'very-high': { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)', fill: 1.0 },
  'high':      { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.25)', fill: 0.8 },
  'mixed':     { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', fill: 0.6 },
  'low':       { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)', fill: 0.4 },
  'very-low':  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', fill: 0.2 },
} as const

/** Human-readable labels for OwnershipType, displayed in the source list. */
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

/** Human-readable labels for Topic, displayed in article cards and pill filters. */
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
// Search & filter types (PRD F-10)
// ---------------------------------------------------------------------------

/** Preset time ranges for the advanced search date filter. */
export type DatePreset = '24h' | '7d' | '30d' | 'all'

/** Numeric rank for each factuality level, used to compute "at or above" thresholds. */
export const FACTUALITY_RANK: Record<FactualityLevel, number> = {
  'very-low': 0, 'low': 1, 'mixed': 2, 'high': 3, 'very-high': 4,
}

/** Human-readable labels for DatePreset, displayed in filter pills. */
export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  '24h': '24 Hours', '7d': '7 Days', '30d': '30 Days', 'all': 'All Time',
}

// ---------------------------------------------------------------------------
// Timeline types (PRD F-11)
// ---------------------------------------------------------------------------

/** The kind of event that appears on a story's coverage timeline. */
export type TimelineEventKind = 'source-added' | 'spectrum-shift' | 'milestone'

/** A single node on the story coverage timeline. */
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

/** Full timeline data for a story, computed from its articles on-read. */
export interface StoryTimeline {
  readonly storyId: string
  readonly events: readonly TimelineEvent[]
  readonly totalArticles: number
  readonly timeSpanHours: number
}

// ---------------------------------------------------------------------------
// Database row type aliases (re-exported from lib/supabase/types)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Review gate types (F-05)
// ---------------------------------------------------------------------------

/** Review status for AI-generated story content. */
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

/** Human-readable labels for ReviewStatus, displayed in admin UI. */
export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  'pending': 'Pending',
  'approved': 'Approved',
  'rejected': 'Rejected',
}

// ---------------------------------------------------------------------------
// Database row type aliases (re-exported from lib/supabase/types)
// ---------------------------------------------------------------------------

/** Human-readable labels for Region, displayed in filter pills. */
export const REGION_LABELS: Record<Region, string> = {
  'us': 'United States',
  'international': 'International',
  'uk': 'United Kingdom',
  'canada': 'Canada',
  'europe': 'Europe',
}

/** All region values as an array, for iteration and validation. */
export const ALL_REGIONS: Region[] = ['us', 'international', 'uk', 'canada', 'europe']

export type { DbSource, DbArticle, DbStory, DbAdminUser, DbTag, DbStoryTag, DbMediaOwner } from '@/lib/supabase/types'
