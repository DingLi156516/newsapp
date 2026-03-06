-- Phase 2a: Initial schema for Axiom News
-- Tables: sources, stories, articles
-- Extensions: pgvector for embedding search

-- ============================================================
-- Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Tables
-- ============================================================

-- News outlet metadata (maps to NewsSource interface in the UI)
CREATE TABLE sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  bias        TEXT NOT NULL CHECK (bias IN (
                'far-left','left','lean-left','center',
                'lean-right','right','far-right')),
  factuality  TEXT NOT NULL CHECK (factuality IN (
                'very-high','high','mixed','low','very-low')),
  ownership   TEXT NOT NULL CHECK (ownership IN (
                'independent','corporate','private-equity',
                'state-funded','telecom','government','non-profit','other')),
  url         TEXT,
  rss_url     TEXT,
  region      TEXT NOT NULL DEFAULT 'us' CHECK (region IN (
                'us','international','uk','canada','europe')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clustered article groups (maps to NewsArticle in the UI)
-- Created before articles so articles can reference stories
CREATE TABLE stories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline          TEXT NOT NULL,
  topic             TEXT NOT NULL CHECK (topic IN (
                      'politics','world','technology','business',
                      'science','health','culture','sports','environment')),
  region            TEXT NOT NULL DEFAULT 'us',
  source_count      INT NOT NULL DEFAULT 0,
  is_blindspot      BOOLEAN NOT NULL DEFAULT false,
  image_url         TEXT,
  factuality        TEXT NOT NULL DEFAULT 'mixed',
  ownership         TEXT NOT NULL DEFAULT 'other',
  spectrum_segments JSONB NOT NULL DEFAULT '[]',
  ai_summary        JSONB NOT NULL DEFAULT '{}',
  cluster_centroid  vector(768),
  first_published   TIMESTAMPTZ NOT NULL,
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Raw ingested articles with pgvector embedding column
CREATE TABLE articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  content       TEXT,
  url           TEXT UNIQUE NOT NULL,
  image_url     TEXT,
  published_at  TIMESTAMPTZ NOT NULL,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  embedding     vector(768),
  is_embedded   BOOLEAN NOT NULL DEFAULT false,
  story_id      UUID REFERENCES stories(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

-- Sources
CREATE INDEX idx_sources_bias ON sources(bias);
CREATE INDEX idx_sources_region ON sources(region);
CREATE INDEX idx_sources_is_active ON sources(is_active);

-- Stories
CREATE INDEX idx_stories_topic ON stories(topic);
CREATE INDEX idx_stories_region ON stories(region);
CREATE INDEX idx_stories_is_blindspot ON stories(is_blindspot);
CREATE INDEX idx_stories_first_published ON stories(first_published DESC);
CREATE INDEX idx_stories_last_updated ON stories(last_updated DESC);

-- Articles
CREATE INDEX idx_articles_source_id ON articles(source_id);
CREATE INDEX idx_articles_story_id ON articles(story_id);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_is_embedded ON articles(is_embedded);
CREATE INDEX idx_articles_url_hash ON articles USING hash(url);

-- HNSW index for cosine similarity search on article embeddings
CREATE INDEX idx_articles_embedding ON articles
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Public read-only access (anon + authenticated users)
CREATE POLICY "sources_read" ON sources
  FOR SELECT USING (true);

CREATE POLICY "stories_read" ON stories
  FOR SELECT USING (true);

CREATE POLICY "articles_read" ON articles
  FOR SELECT USING (true);

-- Write access restricted to service role (cron workers)
CREATE POLICY "sources_service_write" ON sources
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "stories_service_write" ON stories
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "articles_service_write" ON articles
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Updated-at trigger for sources
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sources_updated_at
  BEFORE UPDATE ON sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
