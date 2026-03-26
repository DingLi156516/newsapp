-- 022_tag_label_trigram_index.sql — Trigram index for tag label search.
--
-- Enables fast ILIKE / similarity queries on tags.label.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_tags_label_trgm
  ON tags USING gin (label gin_trgm_ops);
