-- 051_articles_rss_categories.sql
-- Capture RSS feed <category> tags on articles so the thin-cluster
-- topic classifier can use the feed-supplied category as the first
-- signal in its ladder (RSS → source prior → keyword → default).
--
-- Zero-Gemini path: topic classification for clusters that route to
-- the deterministic (thin) assembler uses rss_categories directly.

ALTER TABLE articles
  ADD COLUMN rss_categories TEXT[];
