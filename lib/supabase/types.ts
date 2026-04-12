/**
 * lib/supabase/types.ts — Database row types for Supabase tables.
 *
 * These types mirror the SQL schema in supabase/migrations/001_initial_schema.sql.
 * They represent the raw shapes returned by Supabase queries before any
 * transformation into the frontend NewsArticle/NewsSource interfaces.
 *
 * Note: Properties are mutable (no `readonly`) for Supabase client compatibility.
 * Immutability is enforced at the application layer, not the type layer.
 */

import type {
  BiasCategory,
  FactualityLevel,
  OwnershipType,
  OwnerType,
  Region,
  Topic,
  SpectrumSegment,
  AISummary,
  StoryVelocity,
  StorySentiment,
  KeyQuote,
  KeyClaim,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// sources table
// ---------------------------------------------------------------------------

export type SourceType = 'rss' | 'crawler' | 'news_api'
export type FetchStatus = 'success' | 'timeout' | 'http_error' | 'parse_error' | 'dns_error' | 'robots_blocked' | 'extraction_failed' | 'rate_limited' | 'api_auth_error' | 'unknown'
export type DbAssemblyStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type DbPublicationStatus = 'draft' | 'needs_review' | 'published' | 'rejected'
export type DbStoryKind = 'standard'

export interface DbSource {
  id: string
  slug: string
  name: string
  bias: BiasCategory
  factuality: FactualityLevel
  ownership: OwnershipType
  url: string | null
  rss_url: string | null
  region: Region
  is_active: boolean
  last_fetch_at: string | null
  last_fetch_status: FetchStatus
  last_fetch_error: string | null
  consecutive_failures: number
  total_articles_ingested: number
  created_at: string
  updated_at: string
  bias_mbfc: BiasCategory | null
  bias_allsides: BiasCategory | null
  bias_adfm: BiasCategory | null
  factuality_mbfc: FactualityLevel | null
  factuality_allsides: FactualityLevel | null
  bias_override: boolean
  bias_sources_synced_at: string | null
  source_type: SourceType
  ingestion_config: Record<string, unknown>
  // Media ownership (migration 048):
  owner_id: string | null
  // Source-health control plane (migration 046):
  cooldown_until: string | null
  auto_disabled_at: string | null
  auto_disabled_reason: string | null
}

export interface DbSourceInsert {
  slug: string
  name: string
  bias: BiasCategory
  factuality: FactualityLevel
  ownership: OwnershipType
  url?: string | null
  rss_url?: string | null
  region?: Region
  is_active?: boolean
  bias_mbfc?: BiasCategory | null
  bias_allsides?: BiasCategory | null
  bias_adfm?: BiasCategory | null
  factuality_mbfc?: FactualityLevel | null
  factuality_allsides?: FactualityLevel | null
  bias_override?: boolean
  bias_sources_synced_at?: string | null
  source_type?: SourceType
  ingestion_config?: Record<string, unknown>
  owner_id?: string | null
  cooldown_until?: string | null
  auto_disabled_at?: string | null
  auto_disabled_reason?: string | null
}

// ---------------------------------------------------------------------------
// stories table
// ---------------------------------------------------------------------------

export interface DbStory {
  id: string
  headline: string
  story_kind: DbStoryKind
  topic: Topic
  region: string
  source_count: number
  is_blindspot: boolean
  image_url: string | null
  factuality: FactualityLevel
  ownership: OwnershipType
  spectrum_segments: SpectrumSegment[]
  ai_summary: AISummary
  cluster_centroid: number[] | null
  assembly_status: DbAssemblyStatus
  publication_status: DbPublicationStatus
  review_reasons: string[]
  confidence_score: number | null
  processing_error: string | null
  assembled_at: string | null
  published_at: string | null
  assembly_claimed_at: string | null
  assembly_claim_owner: string | null
  assembly_version: number
  assembly_retry_count: number
  assembly_next_attempt_at: string | null
  assembly_last_error: string | null
  review_status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  story_velocity: StoryVelocity | null
  impact_score: number | null
  source_diversity: number | null
  controversy_score: number | null
  sentiment: StorySentiment | null
  key_quotes: KeyQuote[] | null
  key_claims: KeyClaim[] | null
  first_published: string
  last_updated: string
  created_at: string
}

export interface DbStoryInsert {
  headline: string
  story_kind?: DbStoryKind
  topic: Topic
  region?: string
  source_count?: number
  is_blindspot?: boolean
  image_url?: string | null
  factuality?: FactualityLevel
  ownership?: OwnershipType
  spectrum_segments?: SpectrumSegment[]
  ai_summary?: AISummary
  cluster_centroid?: number[] | null
  assembly_status?: DbAssemblyStatus
  publication_status?: DbPublicationStatus
  review_reasons?: string[]
  confidence_score?: number | null
  processing_error?: string | null
  assembled_at?: string | null
  published_at?: string | null
  assembly_claimed_at?: string | null
  assembly_claim_owner?: string | null
  assembly_version?: number
  story_velocity?: StoryVelocity | null
  impact_score?: number | null
  source_diversity?: number | null
  controversy_score?: number | null
  sentiment?: StorySentiment | null
  key_quotes?: KeyQuote[] | null
  key_claims?: KeyClaim[] | null
  first_published: string
}

// ---------------------------------------------------------------------------
// articles table
// ---------------------------------------------------------------------------

export interface DbArticle {
  id: string
  source_id: string
  title: string
  description: string | null
  content: string | null
  url: string
  canonical_url: string | null
  title_fingerprint: string | null
  image_url: string | null
  published_at: string | null
  ingested_at: string
  embedding: number[] | null
  is_embedded: boolean
  embedding_claimed_at: string | null
  embedding_claim_owner: string | null
  embedding_retry_count: number
  embedding_next_attempt_at: string | null
  embedding_last_error: string | null
  clustering_claimed_at: string | null
  clustering_claim_owner: string | null
  clustering_retry_count: number
  clustering_next_attempt_at: string | null
  clustering_last_error: string | null
  story_id: string | null
  clustering_attempts: number
  clustering_status: 'pending' | 'clustered' | 'expired'
  created_at: string
  fetched_at: string
  published_at_estimated: boolean
}

export interface DbArticleInsert {
  source_id: string
  title: string
  description?: string | null
  content?: string | null
  url: string
  canonical_url?: string | null
  title_fingerprint?: string | null
  image_url?: string | null
  // Null when the upstream source omitted or gave us an unparseable date.
  // When null, `published_at_estimated` should be set to true so downstream
  // consumers can fall back to `fetched_at` for ordering.
  published_at?: string | null
  fetched_at?: string
  published_at_estimated?: boolean
  embedding?: number[] | null
  is_embedded?: boolean
  embedding_claimed_at?: string | null
  embedding_claim_owner?: string | null
  clustering_claimed_at?: string | null
  clustering_claim_owner?: string | null
  story_id?: string | null
  clustering_attempts?: number
  clustering_status?: 'pending' | 'clustered' | 'expired'
}

// ---------------------------------------------------------------------------
// bookmarks table
// ---------------------------------------------------------------------------

export interface DbBookmark {
  id: string
  user_id: string
  story_id: string
  created_at: string
}

export interface DbBookmarkInsert {
  user_id: string
  story_id: string
}

// ---------------------------------------------------------------------------
// reading_history table
// ---------------------------------------------------------------------------

export interface DbReadingHistory {
  id: string
  user_id: string
  story_id: string
  read_at: string
  is_read: boolean
}

export interface DbReadingHistoryInsert {
  user_id: string
  story_id: string
  read_at?: string
  is_read?: boolean
}

// ---------------------------------------------------------------------------
// user_preferences table
// ---------------------------------------------------------------------------

export interface DbUserPreferences {
  id: string
  user_id: string
  followed_topics: string[]
  default_region: string
  default_perspective: string
  factuality_minimum: string
  blindspot_digest_enabled: boolean
  created_at: string
  updated_at: string
}

export interface DbUserPreferencesInsert {
  user_id: string
  followed_topics?: string[]
  default_region?: string
  default_perspective?: string
  factuality_minimum?: string
  blindspot_digest_enabled?: boolean
}

// ---------------------------------------------------------------------------
// pipeline_runs table
// ---------------------------------------------------------------------------

export interface DbPipelineStep {
  step: string
  status: 'success' | 'error' | 'skipped'
  duration_ms: number
  result?: Record<string, unknown>
  error?: string
}

export interface DbPipelineRun {
  id: string
  run_type: 'ingest' | 'process' | 'full'
  triggered_by: string
  status: 'running' | 'completed' | 'failed'
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  steps: DbPipelineStep[]
  summary: Record<string, unknown> | null
  error: string | null
  created_at: string
}

export interface DbPipelineRunInsert {
  run_type: 'ingest' | 'process' | 'full'
  triggered_by?: string
  status?: 'running' | 'completed' | 'failed'
}

// ---------------------------------------------------------------------------
// pipeline_stage_events table (migration 044)
// ---------------------------------------------------------------------------

export type DbStageKind = 'ingest' | 'embed' | 'cluster' | 'assemble' | 'recluster'
export type DbStageLevel = 'debug' | 'info' | 'warn' | 'error'

export interface DbPipelineStageEvent {
  id: string
  run_id: string
  claim_owner: string | null
  stage: DbStageKind
  source_id: string | null
  provider: string | null
  level: DbStageLevel
  event_type: string
  item_id: string | null
  duration_ms: number | null
  payload: Record<string, unknown>
  created_at: string
}

export interface DbPipelineStageEventInsert {
  run_id: string
  claim_owner?: string | null
  stage: DbStageKind
  source_id?: string | null
  provider?: string | null
  level: DbStageLevel
  event_type: string
  item_id?: string | null
  duration_ms?: number | null
  payload?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// pipeline_maintenance_audit table (migration 047)
// ---------------------------------------------------------------------------

export type DbMaintenanceAction =
  | 'purge_unembedded_articles'
  | 'purge_orphan_stories'
  | 'purge_expired_articles'

export interface DbPipelineMaintenanceAudit {
  id: string
  action: DbMaintenanceAction
  dry_run: boolean
  options: Record<string, unknown>
  deleted_count: number | null
  sample_ids: string[] | null
  error: string | null
  triggered_by: string | null
  triggered_at: string
  completed_at: string | null
}

export interface DbPipelineMaintenanceAuditInsert {
  action: DbMaintenanceAction
  dry_run: boolean
  options?: Record<string, unknown>
  deleted_count?: number | null
  sample_ids?: string[] | null
  error?: string | null
  triggered_by?: string | null
}

// ---------------------------------------------------------------------------
// admin_users table
// ---------------------------------------------------------------------------

export interface DbAdminUser {
  id: string
  user_id: string
  created_at: string
}

// ---------------------------------------------------------------------------
// tags table
// ---------------------------------------------------------------------------

export type DbTagType = 'person' | 'organization' | 'location' | 'event' | 'topic'

export interface DbTag {
  id: string
  slug: string
  label: string
  description: string | null
  tag_type: DbTagType
  story_count: number
  created_at: string
}

export interface DbTagInsert {
  slug: string
  label: string
  description?: string | null
  tag_type: DbTagType
}

// ---------------------------------------------------------------------------
// story_tags join table
// ---------------------------------------------------------------------------

export interface DbStoryTag {
  story_id: string
  tag_id: string
  relevance: number
}

export interface DbStoryTagInsert {
  story_id: string
  tag_id: string
  relevance?: number
}

// ---------------------------------------------------------------------------
// media_owners table (migration 048)
// ---------------------------------------------------------------------------

export type DbOwnerSource = 'wikidata' | 'manual'

export interface DbMediaOwner {
  id: string
  name: string
  slug: string
  owner_type: OwnerType
  is_individual: boolean
  country: string | null
  wikidata_qid: string | null
  parent_owner_id: string | null
  owner_source: DbOwnerSource
  owner_verified_at: string
  created_at: string
  updated_at: string
}

export interface DbMediaOwnerInsert {
  name: string
  slug: string
  owner_type: OwnerType
  is_individual?: boolean
  country?: string | null
  wikidata_qid?: string | null
  parent_owner_id?: string | null
  owner_source?: DbOwnerSource
}

// ---------------------------------------------------------------------------
// Database type map (used with Supabase client generic)
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      sources: {
        Row: DbSource
        Insert: DbSourceInsert
        Update: Partial<DbSourceInsert>
        Relationships: [
          {
            foreignKeyName: 'articles_source_id_fkey'
            columns: ['id']
            isOneToOne: false
            referencedRelation: 'articles'
            referencedColumns: ['source_id']
          },
          {
            foreignKeyName: 'sources_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'media_owners'
            referencedColumns: ['id']
          },
        ]
      }
      stories: {
        Row: DbStory
        Insert: DbStoryInsert
        Update: Partial<DbStoryInsert>
        Relationships: [
          {
            foreignKeyName: 'articles_story_id_fkey'
            columns: ['id']
            isOneToOne: false
            referencedRelation: 'articles'
            referencedColumns: ['story_id']
          },
        ]
      }
      articles: {
        Row: DbArticle
        Insert: DbArticleInsert
        Update: Partial<DbArticleInsert>
        Relationships: [
          {
            foreignKeyName: 'articles_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'articles_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'stories'
            referencedColumns: ['id']
          },
        ]
      }
      bookmarks: {
        Row: DbBookmark
        Insert: DbBookmarkInsert
        Update: Partial<DbBookmarkInsert>
        Relationships: [
          {
            foreignKeyName: 'bookmarks_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'stories'
            referencedColumns: ['id']
          },
        ]
      }
      reading_history: {
        Row: DbReadingHistory
        Insert: DbReadingHistoryInsert
        Update: Partial<DbReadingHistoryInsert & { is_read: boolean }>
        Relationships: [
          {
            foreignKeyName: 'reading_history_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'stories'
            referencedColumns: ['id']
          },
        ]
      }
      user_preferences: {
        Row: DbUserPreferences
        Insert: DbUserPreferencesInsert
        Update: Partial<DbUserPreferencesInsert>
        Relationships: []
      }
      admin_users: {
        Row: DbAdminUser
        Insert: { user_id: string }
        Update: Partial<{ user_id: string }>
        Relationships: []
      }
      pipeline_runs: {
        Row: DbPipelineRun
        Insert: DbPipelineRunInsert
        Update: Partial<DbPipelineRunInsert & {
          status: 'running' | 'completed' | 'failed'
          completed_at: string
          duration_ms: number
          steps: DbPipelineStep[]
          summary: Record<string, unknown>
          error: string
        }>
        Relationships: []
      }
      pipeline_stage_events: {
        Row: DbPipelineStageEvent
        Insert: DbPipelineStageEventInsert
        Update: Partial<DbPipelineStageEventInsert>
        Relationships: []
      }
      pipeline_maintenance_audit: {
        Row: DbPipelineMaintenanceAudit
        Insert: DbPipelineMaintenanceAuditInsert
        Update: Partial<DbPipelineMaintenanceAuditInsert>
        Relationships: []
      }
      tags: {
        Row: DbTag
        Insert: DbTagInsert
        Update: Partial<DbTagInsert>
        Relationships: [
          {
            foreignKeyName: 'story_tags_tag_id_fkey'
            columns: ['id']
            isOneToOne: false
            referencedRelation: 'story_tags'
            referencedColumns: ['tag_id']
          },
        ]
      }
      media_owners: {
        Row: DbMediaOwner
        Insert: DbMediaOwnerInsert
        Update: Partial<DbMediaOwnerInsert>
        Relationships: []
      }
      story_tags: {
        Row: DbStoryTag
        Insert: DbStoryTagInsert
        Update: Partial<DbStoryTagInsert>
        Relationships: [
          {
            foreignKeyName: 'story_tags_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'stories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'story_tags_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'tags'
            referencedColumns: ['id']
          },
        ]
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    Views: {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    Functions: {}
  }
}
