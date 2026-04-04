-- Fix misleading metadata for existing single-source stories.
-- The pipeline now sets these correctly for new stories; this backfills old ones.
UPDATE stories
SET
  is_blindspot = false,
  controversy_score = 0,
  sentiment = null
WHERE source_count = 1
  AND assembly_status = 'completed';
