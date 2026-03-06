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
  Region,
  Topic,
  SpectrumSegment,
  AISummary,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// sources table
// ---------------------------------------------------------------------------

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
  created_at: string
  updated_at: string
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
}

// ---------------------------------------------------------------------------
// stories table
// ---------------------------------------------------------------------------

export interface DbStory {
  id: string
  headline: string
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
  review_status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  first_published: string
  last_updated: string
  created_at: string
}

export interface DbStoryInsert {
  headline: string
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
  image_url: string | null
  published_at: string
  ingested_at: string
  embedding: number[] | null
  is_embedded: boolean
  story_id: string | null
  created_at: string
}

export interface DbArticleInsert {
  source_id: string
  title: string
  description?: string | null
  content?: string | null
  url: string
  image_url?: string | null
  published_at: string
  embedding?: number[] | null
  is_embedded?: boolean
  story_id?: string | null
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
  created_at: string
  updated_at: string
}

export interface DbUserPreferencesInsert {
  user_id: string
  followed_topics?: string[]
  default_region?: string
  default_perspective?: string
  factuality_minimum?: string
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
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    Views: {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    Functions: {}
  }
}
