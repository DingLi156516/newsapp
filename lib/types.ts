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

/**
 * A single news outlet that covered a story.
 * Analogous to a "Source" record in your backend DB.
 */
export interface NewsSource {
  id: string
  name: string
  bias: BiasCategory
  factuality: FactualityLevel
  ownership: OwnershipType
  url?: string   // Root domain without protocol, e.g. "bbc.com"
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

/** Human-readable labels for FactualityLevel, used in tooltips and filters. */
export const FACTUALITY_LABELS: Record<FactualityLevel, string> = {
  'very-high': 'Very High Factuality',
  'high': 'High Factuality',
  'mixed': 'Mixed Factuality',
  'low': 'Low Factuality',
  'very-low': 'Very Low Factuality',
}

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

export type { DbSource, DbArticle, DbStory, DbAdminUser } from '@/lib/supabase/types'
