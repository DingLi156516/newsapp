-- Migration 034: Align match_story_centroid RPC defaults with JS constants
-- and tune HNSW recall via ef_search=80 (up from PG default 40).

CREATE OR REPLACE FUNCTION match_story_centroid(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.70,
  match_count int DEFAULT 15,
  cutoff_time timestamptz DEFAULT now() - interval '168 hours'
) RETURNS TABLE (story_id uuid, similarity float)
LANGUAGE sql STABLE
-- SET hnsw.ef_search = 80  -- removed: Supabase hosted does not allow setting this GUC at function level
AS $$
  SELECT s.id, 1 - (s.cluster_centroid <=> query_embedding) AS similarity
  FROM stories s
  WHERE s.cluster_centroid IS NOT NULL
    AND s.last_updated >= cutoff_time
    AND 1 - (s.cluster_centroid <=> query_embedding) >= match_threshold
  ORDER BY s.cluster_centroid <=> query_embedding
  LIMIT match_count;
$$;
