-- 035_source_type_and_ingestion_config.sql
-- Adds source_type and ingestion_config columns to support web crawling
-- and third-party news API ingestion alongside existing RSS feeds.

ALTER TABLE sources
  ADD COLUMN source_type TEXT NOT NULL DEFAULT 'rss'
    CHECK (source_type IN ('rss', 'crawler', 'news_api'));

ALTER TABLE sources
  ADD COLUMN ingestion_config JSONB NOT NULL DEFAULT '{}';

CREATE INDEX idx_sources_source_type ON sources(source_type);

-- Expand last_fetch_status CHECK to cover new error types
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_last_fetch_status_check;
ALTER TABLE sources ADD CONSTRAINT sources_last_fetch_status_check
  CHECK (last_fetch_status IN (
    'success', 'timeout', 'http_error', 'parse_error', 'dns_error',
    'robots_blocked', 'extraction_failed', 'rate_limited', 'api_auth_error', 'unknown'
  ));
